"use client";
import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Globe, Mail, Phone } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { Client, Project } from "@/app/types";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";
import DataTable, { Column } from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { formatCurrency } from "@/app/lib/data";
import toast from "react-hot-toast";

export default function ClientsPage() {
  const { data: clients, loading } = useCollection<Client>("clients");
  const { data: projects } = useCollection<Project>("projects");
  const { add, update, remove } = useFirestore("clients");
  const { profile: currentUserProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", website: "", industry: "", status: "active" as Client["status"], totalProjects: 0, totalValue: 0, notes: "" });

  const openAdd = () => { setEditing(null); setForm({ name: "", company: "", email: "", phone: "", website: "", industry: "", status: "active", totalProjects: 0, totalValue: 0, notes: "" }); setShowModal(true); };
  const openEdit = (c: Client) => { setEditing(c); setForm({ name: c.name, company: c.company, email: c.email, phone: c.phone || "", website: c.website || "", industry: c.industry || "", status: c.status, totalProjects: c.totalProjects, totalValue: c.totalValue, notes: c.notes || "" }); setShowModal(true); };

  const handleSave = async () => {
    try {
      const action = editing ? "update" : "create";
      if (!canPerformAction(currentUserProfile?.role, "clients", action, editing || undefined, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }

      if (editing) { await update(editing.id, form); toast.success("Client updated"); }
      else { 
        await add({ ...form, createdBy: currentUserProfile?.id || "admin" }); 
        toast.success("Client added"); 
      }
      setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (!client || !canPerformAction(currentUserProfile?.role, "clients", "delete", client, currentUserProfile?.id)) {
      toast.error("Unauthorized action");
      return;
    }

    if (!confirm("Delete this client?")) return;
    try { await remove(id); toast.success("Client deleted"); } catch { toast.error("Failed to delete"); }
  };

  const isMemberOrViewer = currentUserProfile?.role === "member";
  const userClients = useMemo(() => {
    if (!isMemberOrViewer) return clients;
    
    const assignedClientNames = new Set(
      projects
        .filter((p) => p.assignees?.includes(currentUserProfile?.id || "") || p.createdBy === currentUserProfile?.id)
        .map((p) => p.clientName?.toLowerCase().trim())
    );

    return clients.filter((c) => 
      c.createdBy === currentUserProfile?.id ||
      assignedClientNames.has(c.name?.toLowerCase().trim()) || 
      assignedClientNames.has(c.company?.toLowerCase().trim())
    );
  }, [clients, projects, isMemberOrViewer, currentUserProfile]);

  const filtered = filter === "all" ? userClients : userClients.filter((c) => c.status === filter);

  const columns = useMemo<Column<Client>[]>(() => [
    {
      key: "name", label: "Client", sortable: true, render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary-600">{c.name.charAt(0)}</span>
          </div>
          <div><p className="font-medium text-slate-800">{c.name}</p><p className="text-xs text-slate-400">{c.company}</p></div>
        </div>
      )
    },
    {
      key: "email", label: "Contact", render: (c) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm text-slate-600"><Mail className="w-3.5 h-3.5 text-slate-400" />{c.email}</div>
          {c.phone && <div className="flex items-center gap-1.5 text-sm text-slate-500"><Phone className="w-3.5 h-3.5 text-slate-400" />{c.phone}</div>}
        </div>
      )
    },
    { key: "industry", label: "Industry", render: (c) => <span className="text-sm text-slate-600">{c.industry || "—"}</span> },
    { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "totalProjects", label: "Projects", sortable: true, render: (c) => <span className="text-sm font-medium text-slate-700">{c.totalProjects}</span> },
    { key: "totalValue", label: "Value", sortable: true, render: (c) => <span className="text-sm font-semibold text-slate-800">{formatCurrency(c.totalValue)}</span> },
    {
      key: "actions", label: "", render: (c) => {
        const canEdit = canPerformAction(currentUserProfile?.role, "clients", "update", c, currentUserProfile?.id);
        const canDelete = canPerformAction(currentUserProfile?.role, "clients", "delete", c, currentUserProfile?.id);

        return (
          <div className="flex items-center gap-1">
            {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-500"><Globe className="w-3.5 h-3.5" /></a>}
            {canEdit && (
              <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 className="w-3.5 h-3.5" /></button>
            )}
            {canDelete && (
              <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
        );
      }
    },
  ], [currentUserProfile?.role, currentUserProfile?.id]);

  if (loading) return <LoadingSpinner size="lg" message="Loading clients..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "active", "inactive", "prospect", "churned"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)} {s !== "all" && <span className="text-xs opacity-70">({userClients.filter((c) => c.status === s).length})</span>}
          </button>
        ))}
      </div>

      {/* FIX: Cast data collections to any[] layout variants to satisfy explicit generic validation blocks */}
      <DataTable
        columns={columns as any[]}
        data={filtered as any[]}
        searchKeys={["name", "company", "email", "industry"]}
        searchPlaceholder="Search clients..."
        actions={canPerformAction(currentUserProfile?.role, "clients", "create") ? <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Client</button> : undefined}
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Client" : "Add Client"} size="lg"
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save</button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="company label">Company</label><input className="input-field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Email</label><input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Website</label><input className="input-field" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
            <div><label className="label">Industry</label><input className="input-field" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Status</label><select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Client["status"] })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="prospect">Prospect</option><option value="churned">Churned</option></select></div>
            {/* FIX: Add zero value fallbacks on parsing numeric form properties */}
            <div><label className="label">Projects</label><input className="input-field" type="number" value={form.totalProjects || ""} onChange={(e) => setForm({ ...form, totalProjects: parseInt(e.target.value) || 0 })} /></div>
            <div><label className="label">Value (₹)</label><input className="input-field" type="number" value={form.totalValue || ""} onChange={(e) => setForm({ ...form, totalValue: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input-field" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}