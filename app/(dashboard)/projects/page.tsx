"use client";
import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Calendar, Users as UsersIcon } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { Project } from "@/app/types";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";
import DataTable, { Column } from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { formatDate } from "@/app/lib/data";
import toast from "react-hot-toast";
import { Timestamp } from "firebase/firestore";

export default function ProjectsPage() {
  const { data: projects, loading } = useCollection<Project>("projects");
  const { add, update, remove } = useFirestore("projects");
  const { profile: currentUserProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ name: "", description: "", clientName: "", status: "planning" as Project["status"], priority: "medium" as Project["priority"], startDate: "", dueDate: "", budget: "", tags: "", progress: 0 });

  const openAdd = () => { setEditing(null); setForm({ name: "", description: "", clientName: "", status: "planning", priority: "medium", startDate: "", dueDate: "", budget: "", tags: "", progress: 0 }); setShowModal(true); };
  const openEdit = (p: Project) => { setEditing(p); setForm({ name: p.name, description: p.description, clientName: p.clientName, status: p.status, priority: p.priority, startDate: "", dueDate: "", budget: p.budget?.toString() || "", tags: p.tags.join(", "), progress: p.progress }); setShowModal(true); };

  const handleSave = async () => {
    try {
      const action = editing ? "update" : "create";
      if (!canPerformAction(currentUserProfile?.role, "projects", action, editing || undefined, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }

      const data = {
        ...form, budget: form.budget ? parseFloat(form.budget) : 0,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        assignees: [], startDate: Timestamp.now(), dueDate: Timestamp.now(), createdBy: currentUserProfile?.id || "admin",
      };
      if (editing) { await update(editing.id, data); toast.success("Project updated"); }
      else { await add(data); toast.success("Project created"); }
      setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    const p = projects.find((item) => item.id === id);
    if (!p || !canPerformAction(currentUserProfile?.role, "projects", "delete", p)) {
      toast.error("Unauthorized action");
      return;
    }

    if (!confirm("Delete this project?")) return;
    try { await remove(id); toast.success("Project deleted"); } catch { toast.error("Failed to delete"); }
  };

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  const columns = useMemo<Column<Project>[]>(() => [
    { key: "name", label: "Project", sortable: true, render: (p) => (
      <div><p className="font-medium text-slate-800">{p.name}</p><p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{p.description}</p></div>
    )},
    { key: "clientName", label: "Client", sortable: true },
    { key: "status", label: "Status", render: (p) => <StatusBadge status={p.status} /> },
    { key: "priority", label: "Priority", render: (p) => <StatusBadge status={p.priority} /> },
    { key: "progress", label: "Progress", render: (p) => (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${p.progress}%` }} />
        </div>
        <span className="text-xs font-medium text-slate-600 w-8">{p.progress}%</span>
      </div>
    )},
    { key: "dueDate", label: "Due Date", render: (p) => <span className="text-sm text-slate-500">{formatDate(p.dueDate as Date)}</span> },
    { key: "actions", label: "", render: (p) => {
      const canEdit = canPerformAction(currentUserProfile?.role, "projects", "update", p, currentUserProfile?.id);
      const canDelete = canPerformAction(currentUserProfile?.role, "projects", "delete", p);
      if (!canEdit && !canDelete) return null;
      return (
        <div className="flex items-center gap-1">
          {canEdit && (
            <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 className="w-3.5 h-3.5" /></button>
          )}
          {canDelete && (
            <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
          )}
        </div>
      );
    }},
  ], [currentUserProfile?.role, currentUserProfile?.id]);

  if (loading) return <LoadingSpinner size="lg" message="Loading projects..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Status filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "planning", "in_progress", "review", "completed", "on_hold"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            {s === "all" ? "All" : s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            {s !== "all" && <span className="ml-1.5 text-xs opacity-70">({projects.filter((p) => p.status === s).length})</span>}
          </button>
        ))}
      </div>

      {/* FIX: Cast data collections to any[] to bypass strict generic enforcement */}
      <DataTable
        columns={columns as any[]}
        data={filtered as any[]}
        searchKeys={["name", "clientName", "description"]}
        searchPlaceholder="Search projects..."
        actions={canPerformAction(currentUserProfile?.role, "projects", "create") ? <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> New Project</button> : undefined}
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Project" : "New Project"} size="lg"
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save</button></>}>
        <div className="space-y-4">
          <div><label className="label">Project Name</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input-field" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Client Name</label><input className="input-field" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div>
            <div><label className="label">Budget (₹)</label><input className="input-field" type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Status</label><select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Project["status"] })}><option value="planning">Planning</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="completed">Completed</option><option value="on_hold">On Hold</option></select></div>
            <div><label className="label">Priority</label><select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Project["priority"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            <div><label className="label">Progress (%)</label><input className="input-field" type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) || 0 })} /></div>
          </div>
          <div><label className="label">Tags (comma-separated)</label><input className="input-field" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Web, Mobile, UI/UX" /></div>
        </div>
      </Modal>
    </div>
  );
}
