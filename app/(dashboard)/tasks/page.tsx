"use client";
import React, { useState } from "react";
import { Plus, Edit2, Trash2, Check, Circle, Clock, AlertCircle } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { Task, TeamMember } from "@/app/types";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import { formatDate } from "@/app/lib/data";
import toast from "react-hot-toast";
import { Timestamp } from "firebase/firestore";

export default function TasksPage() {
  const { data: tasks, loading } = useCollection<Task>("tasks");
  const { data: members } = useCollection<TeamMember>("users");
  const { add, update, remove } = useFirestore("tasks");
  const { profile: currentUserProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", projectName: "", assigneeName: "", assignedTo: "", status: "todo" as Task["status"], priority: "medium" as Task["priority"], tags: "", dueDate: "" });

  const openAdd = () => {
    setEditing(null);
    const isRestricted = currentUserProfile?.role !== "admin";
    setForm({
      title: "",
      description: "",
      projectName: "",
      assigneeName: isRestricted ? currentUserProfile?.name || "" : "",
      assignedTo: isRestricted ? currentUserProfile?.id || "" : "",
      status: "todo",
      priority: "medium",
      tags: "",
      dueDate: ""
    });
    setShowModal(true);
  };
  const openEdit = (t: Task) => {
    const getFormDate = (d: any) => {
      if (!d) return "";
      const dateObj = d instanceof Date ? d : (typeof d.toDate === "function" ? d.toDate() : new Date(d));
      return isNaN(dateObj.getTime()) ? "" : dateObj.toISOString().slice(0, 10);
    };
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || "",
      projectName: t.projectName,
      assigneeName: t.assigneeName || "",
      assignedTo: t.assignedTo || "",
      status: t.status,
      priority: t.priority,
      tags: t.tags.join(", "),
      dueDate: getFormDate(t.dueDate)
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const action = editing ? "update" : "create";
      if (!canPerformAction(currentUserProfile?.role, "tasks", action, editing || undefined, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }

      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        projectName: form.projectName.trim(),
        assigneeName: form.assigneeName,
        assignedTo: form.assignedTo,
        status: form.status,
        priority: form.priority,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        projectId: editing ? editing.projectId : "",
        dueDate: form.dueDate ? Timestamp.fromDate(new Date(form.dueDate)) : null,
        createdBy: editing ? editing.createdBy : (currentUserProfile?.id || "admin"),
        createdAt: editing ? editing.createdAt : Timestamp.now(),
      };
      if (editing) { await update(editing.id, data); toast.success("Task updated"); }
      else { await add(data); toast.success("Task created"); }
      setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const toggleDone = async (t: Task) => {
    const canEdit = canPerformAction(currentUserProfile?.role, "tasks", "update", t, currentUserProfile?.id) ||
      (currentUserProfile?.role === "member" && t.assigneeName?.toLowerCase() === currentUserProfile?.name?.toLowerCase());
    
    if (!canEdit) {
      toast.error("Unauthorized to modify this task");
      return;
    }

    const newStatus = t.status === "done" ? "todo" : "done";
    try { await update(t.id, { status: newStatus, completedAt: newStatus === "done" ? Timestamp.now() : null }); toast.success(newStatus === "done" ? "Task completed! ✓" : "Task reopened"); } catch { toast.error("Failed to update"); }
  };

  const handleDelete = async (id: string) => {
    const t = tasks.find((item) => item.id === id);
    if (!t || !canPerformAction(currentUserProfile?.role, "tasks", "delete", t)) {
      toast.error("Unauthorized action");
      return;
    }

    if (!confirm("Delete this task?")) return;
    try { await remove(id); toast.success("Task deleted"); } catch { toast.error("Failed to delete"); }
  };

  const isMemberOrViewer = currentUserProfile?.role === "member";
  const userTasks = isMemberOrViewer
    ? tasks.filter((t) => t.assignedTo === currentUserProfile?.id || t.assigneeName?.toLowerCase() === currentUserProfile?.name?.toLowerCase() || t.createdBy === currentUserProfile?.id)
    : tasks;

  const filtered = filter === "all" ? userTasks : userTasks.filter((t) => t.status === filter);
  const statusCounts = {
    all: userTasks.length,
    todo: userTasks.filter((t) => t.status === "todo").length,
    in_progress: userTasks.filter((t) => t.status === "in_progress").length,
    review: userTasks.filter((t) => t.status === "review").length,
    done: userTasks.filter((t) => t.status === "done").length
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case "done": return <Check className="w-4 h-4 text-emerald-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-blue-500" />;
      case "review": return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Circle className="w-4 h-4 text-slate-300" />;
    }
  };

  if (loading) return <LoadingSpinner size="lg" message="Loading tasks..." />;

  const canAdd = canPerformAction(currentUserProfile?.role, "tasks", "create");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Status tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "todo", "in_progress", "review", "done"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            {s === "all" ? "All" : s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            <span className="ml-1.5 text-xs opacity-70">({statusCounts[s]})</span>
          </button>
        ))}
        <div className="flex-1" />
        {canAdd && (
          <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Task</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No tasks" message="Create your first task to start tracking work." action={canAdd ? <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Task</button> : undefined} />
      ) : (
        <div className="card divide-y divide-slate-100">
          {filtered.map((t) => {
            const canEdit = canPerformAction(currentUserProfile?.role, "tasks", "update", t, currentUserProfile?.id) ||
              (currentUserProfile?.role === "member" && t.assigneeName?.toLowerCase() === currentUserProfile?.name?.toLowerCase());
            const canDelete = canPerformAction(currentUserProfile?.role, "tasks", "delete", t);

            return (
              <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors group">
                <button 
                  disabled={!canEdit}
                  onClick={() => toggleDone(t)} 
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${!canEdit ? "opacity-60 cursor-not-allowed" : ""} ${t.status === "done" ? "bg-emerald-500 border-emerald-500" : "border-slate-300 hover:border-primary-400"}`}
                >
                  {t.status === "done" && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${t.status === "done" ? "line-through text-slate-400" : "text-slate-800"}`}>{t.title}</p>
                    <StatusBadge status={t.priority} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    {t.projectName && <span>{t.projectName}</span>}
                    {t.assigneeName && <span>→ {t.assigneeName}</span>}
                    {t.dueDate && <span>Due: {formatDate(t.dueDate as Date)}</span>}
                  </div>
                </div>
                {statusIcon(t.status)}
                {(canEdit || canDelete) && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEdit && (
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 className="w-3.5 h-3.5" /></button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Task" : "New Task"}
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save</button></>}>
        <div className="space-y-4">
          <div><label className="label">Title</label><input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Project</label><input className="input-field" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} /></div>
            <div>
              <label className="label">Assignee</label>
              <select
                className="input-field"
                value={form.assignedTo}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const member = members.find((m) => m.id === selectedId);
                  setForm({ ...form, assignedTo: selectedId, assigneeName: member ? member.name : "" });
                }}
              >
                <option value="">Unassigned</option>
                {members
                  .filter((m) => {
                    const isRestricted = currentUserProfile?.role !== "admin";
                    if (isRestricted) {
                      return m.id === currentUserProfile?.id;
                    }
                    return true;
                  })
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.position})
                    </option>
                  ))
                }
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Status</label><select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="done">Done</option></select></div>
            <div><label className="label">Priority</label><select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            <div><label className="label">Due Date</label><input className="input-field" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <div><label className="label">Tags</label><input className="input-field" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="frontend, bug, feature" /></div>
        </div>
      </Modal>
    </div>
  );
}
