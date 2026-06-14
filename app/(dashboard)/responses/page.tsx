"use client";
import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Mail, Star, Archive, Reply } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { Response, TeamMember } from "@/app/types";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import { timeAgo } from "@/app/lib/data";
import toast from "react-hot-toast";

export default function ResponsesPage() {
  const { data: responses, loading } = useCollection<Response>("responses");
  const { data: users } = useCollection<TeamMember>("users");
  const { add, update, remove } = useFirestore("responses");
  const { profile: currentUserProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Response | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "", source: "website" as Response["source"], priority: "medium" as Response["priority"], assignedTo: "" });

  const isRestricted = currentUserProfile?.role === "member";

  const openAdd = () => { setSelected(null); setForm({ name: "", email: "", phone: "", subject: "", message: "", source: "website", priority: "medium", assignedTo: "" }); setShowModal(true); };
  
  const openView = (r: Response) => { 
    setSelected(r); 
    if (r.status === "new" && canPerformAction(currentUserProfile?.role, "responses", "update", r, currentUserProfile?.id)) { 
      update(r.id, { status: "read" }); 
      setSelected((prev) => prev ? { ...prev, status: "read" } : null);
    } 
  };

  const handleSave = async () => {
    try {
      if (!canPerformAction(currentUserProfile?.role, "responses", "create")) {
        toast.error("Unauthorized action");
        return;
      }
      await add({ ...form, status: "new" }); toast.success("Response added"); setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      if (!canPerformAction(currentUserProfile?.role, "responses", "update", selected || undefined, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }
      await update(id, { status }); 
      toast.success(`Marked as ${status}`); 
      if (selected && selected.id === id) {
        setSelected({ ...selected, status: status as any });
      }
    } catch { toast.error("Failed to update"); }
  };

  const handleDelete = async (id: string) => {
    if (!canPerformAction(currentUserProfile?.role, "responses", "delete", selected || undefined, currentUserProfile?.id)) {
      toast.error("Unauthorized action");
      return;
    }
    if (!confirm("Delete this response?")) return;
    try { await remove(id); toast.success("Deleted"); setSelected(null); } catch { toast.error("Failed to delete"); }
  };

  const userResponses = useMemo(() => {
    if (!isRestricted) return responses;
    return responses.filter(r => r.assignedTo === currentUserProfile?.id || r.assignedTo === currentUserProfile?.name);
  }, [responses, isRestricted, currentUserProfile]);

  const filtered = filter === "all" ? userResponses : userResponses.filter((r) => r.status === filter);

  if (loading) return <LoadingSpinner size="lg" message="Loading responses..." />;

  const canAdd = canPerformAction(currentUserProfile?.role, "responses", "create");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "new", "read", "replied", "archived"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)} {s !== "all" && <span className="text-xs opacity-70">({userResponses.filter((r) => r.status === s).length})</span>}
            </button>
          ))}
        </div>
        {canAdd && (
          <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-1 card divide-y divide-slate-100 max-h-[calc(100vh-220px)] overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState title="No responses" message="Responses will appear here." />
          ) : (
            filtered.map((r) => (
              <div key={r.id} onClick={() => openView(r)} className={`px-4 py-3.5 cursor-pointer hover:bg-slate-50/80 transition-colors ${selected?.id === r.id ? "bg-primary-50/50 border-l-2 border-l-primary-500" : ""} ${r.status === "new" ? "bg-blue-50/30" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {r.status === "new" && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                      <p className={`text-sm truncate ${r.status === "new" ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>{r.name}</p>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{r.subject || r.message.slice(0, 50)}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0 ml-2">{timeAgo(r.createdAt as Date)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusBadge status={r.source} />
                  <StatusBadge status={r.priority} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 card">
          {selected ? (
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{selected.subject || "No Subject"}</h2>
                  <p className="text-sm text-slate-500 mt-1">From: <span className="font-medium text-slate-700">{selected.name}</span> · {selected.email}</p>
                  {selected.phone && <p className="text-sm text-slate-500">Phone: {selected.phone}</p>}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assignee:</span>
                    <select
                      className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-slate-600 font-medium focus:border-primary-400"
                      value={selected.assignedTo || ""}
                      onChange={async (e) => {
                        const newAssignee = e.target.value;
                        try {
                          await update(selected.id, { assignedTo: newAssignee });
                          setSelected({ ...selected, assignedTo: newAssignee });
                          toast.success("Assignee updated");
                        } catch {
                          toast.error("Failed to assign response");
                        }
                      }}
                      disabled={isRestricted}
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={selected.status} />
                  <StatusBadge status={selected.priority} />
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-5 mb-6">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
              </div>
              <div className="flex items-center gap-2">
                {canPerformAction(currentUserProfile?.role, "responses", "update", selected || undefined, currentUserProfile?.id) && (
                  <>
                    <button onClick={() => updateStatus(selected.id, "replied")} className="btn-primary"><Reply className="w-4 h-4" /> Mark Replied</button>
                    <button onClick={() => updateStatus(selected.id, "archived")} className="btn-secondary"><Archive className="w-4 h-4" /> Archive</button>
                  </>
                )}
                {canPerformAction(currentUserProfile?.role, "responses", "delete", selected || undefined, currentUserProfile?.id) && (
                  <button onClick={() => handleDelete(selected.id)} className="btn-ghost text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /> Delete</button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-sm text-slate-400">
              <Mail className="w-5 h-5 mr-2" /> Select a response to view details
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Response"
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save</button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Source</label><select className="input-field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as Response["source"] })}><option value="website">Website</option><option value="email">Email</option><option value="social">Social</option><option value="referral">Referral</option><option value="direct">Direct</option><option value="web3-form">Web3 Form</option></select></div>
            <div><label className="label">Priority</label><select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Response["priority"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Subject</label><input className="input-field" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div>
              <label className="label">Assigned To</label>
              <select
                className="input-field"
                value={form.assignedTo || ""}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                disabled={isRestricted}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div><label className="label">Message</label><textarea className="input-field" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}
