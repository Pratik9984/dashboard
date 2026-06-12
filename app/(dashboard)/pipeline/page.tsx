"use client";
import React, { useState } from "react";
import { Plus, Edit2, Trash2, ArrowRight, DollarSign } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { PipelineLead } from "@/app/types";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import { PIPELINE_STAGES, formatCurrency, timeAgo } from "@/app/lib/data";
import toast from "react-hot-toast";
import { Timestamp } from "firebase/firestore";

export default function PipelinePage() {
  const { data: leads, loading } = useCollection<PipelineLead>("pipeline");
  const { add, update, remove } = useFirestore("pipeline");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PipelineLead | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", source: "", stage: "new" as PipelineLead["stage"], value: "", notes: "" });

  const openAdd = () => { setEditing(null); setForm({ name: "", company: "", email: "", phone: "", source: "", stage: "new", value: "", notes: "" }); setShowModal(true); };
  const openEdit = (l: PipelineLead) => { setEditing(l); setForm({ name: l.name, company: l.company || "", email: l.email, phone: l.phone || "", source: l.source, stage: l.stage, value: l.value?.toString() || "", notes: l.notes || "" }); setShowModal(true); };

  const handleSave = async () => {
    try {
      const data = { ...form, value: form.value ? parseFloat(form.value) : 0, updatedAt: Timestamp.now() };
      if (editing) { await update(editing.id, data); toast.success("Lead updated"); }
      else { await add(data); toast.success("Lead added"); }
      setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const moveStage = async (lead: PipelineLead, newStage: string) => {
    try { await update(lead.id, { stage: newStage, updatedAt: Timestamp.now() }); toast.success(`Moved to ${newStage}`); }
    catch { toast.error("Failed to move"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    try { await remove(id); toast.success("Lead deleted"); } catch { toast.error("Failed to delete"); }
  };

  if (loading) return <LoadingSpinner size="lg" message="Loading pipeline..." />;

  const stageLabels: Record<string, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost" };
  const stageColors: Record<string, string> = { new: "border-t-blue-400", contacted: "border-t-violet-400", qualified: "border-t-cyan-400", proposal: "border-t-amber-400", negotiation: "border-t-orange-400", won: "border-t-emerald-400", lost: "border-t-red-400" };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setView("board")} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${view === "board" ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>Board</button>
          <button onClick={() => setView("list")} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${view === "list" ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>List</button>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Lead</button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-slate-800">{leads.length}</p><p className="text-xs text-slate-500">Total Leads</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{leads.filter((l) => l.stage === "won").length}</p><p className="text-xs text-slate-500">Won</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-amber-600">{leads.filter((l) => !["won", "lost"].includes(l.stage)).length}</p><p className="text-xs text-slate-500">In Progress</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-primary-600">{formatCurrency(leads.reduce((s, l) => s + (l.value || 0), 0))}</p><p className="text-xs text-slate-500">Pipeline Value</p></div>
      </div>

      {view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className={`min-w-[260px] flex-1 card border-t-4 ${stageColors[stage]} p-0`}>
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">{stageLabels[stage]}</h3>
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                </div>
                <div className="p-3 space-y-2 min-h-[200px]">
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className="bg-white rounded-lg border border-slate-100 p-3 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openEdit(lead)}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{lead.name}</p>
                          {lead.company && <p className="text-xs text-slate-400">{lead.company}</p>}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(lead.id); }} className="p-1 rounded text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      {lead.value && <div className="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-600"><DollarSign className="w-3 h-3" />{formatCurrency(lead.value)}</div>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-slate-400">{lead.source}</span>
                        <span className="text-[11px] text-slate-400">{timeAgo(lead.updatedAt as Date)}</span>
                      </div>
                      {stage !== "won" && stage !== "lost" && (
                        <button onClick={(e) => { e.stopPropagation(); const idx = PIPELINE_STAGES.indexOf(stage); if (idx < PIPELINE_STAGES.length - 2) moveStage(lead, PIPELINE_STAGES[idx + 1]); }}
                          className="mt-2 w-full flex items-center justify-center gap-1 py-1 text-xs text-primary-600 bg-primary-50 rounded hover:bg-primary-100 transition-colors">
                          Move <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {leads.length === 0 ? (
            <EmptyState title="No leads yet" message="Add your first lead to start tracking." />
          ) : (
            leads.map((l) => (
              <div key={l.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => openEdit(l)}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{l.name}</p>
                    {l.company && <span className="text-xs text-slate-400">· {l.company}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{l.email} · {l.source}</p>
                </div>
                <StatusBadge status={l.stage} />
                {l.value && <span className="text-sm font-semibold text-slate-700">{formatCurrency(l.value)}</span>}
                <button onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Lead" : "Add Lead"}
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save</button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Company</label><input className="input-field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Email</label><input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Source</label><input className="input-field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Website, Referral..." /></div>
            <div><label className="label">Stage</label><select className="input-field" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as PipelineLead["stage"] })}>{PIPELINE_STAGES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></div>
            <div><label className="label">Value (₹)</label><input className="input-field" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input-field" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}
