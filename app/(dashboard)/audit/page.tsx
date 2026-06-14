"use client";
import React, { useState } from "react";
import { Plus, Check, Trash2, Smile, Meh, Frown, Heart, ChevronDown, ChevronRight } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { AuditEntry, AuditItem, TeamMember } from "@/app/types";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";
import Modal from "@/app/components/Modal";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import toast from "react-hot-toast";

export default function AuditPage() {
  const { data: audits, loading } = useCollection<AuditEntry>("audits");
  const { data: members } = useCollection<TeamMember>("users");
  const { add, remove } = useFirestore("audits");
  const { profile: currentUserProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    summary: "",
    mood: "good" as AuditEntry["mood"],
    items: [{ id: "1", category: "Development", description: "", completed: false, notes: "", time: "" }] as AuditItem[]
  });

  const addItem = () => setForm({ ...form, items: [...form.items, { id: Date.now().toString(), category: "General", description: "", completed: false, notes: "", time: "" }] });

  // FIX: Cast element to 'any' to safely allow dynamic bracket notation assignments
  const updateItem = (idx: number, field: string, value: string | boolean) => {
    const items = [...form.items];
    (items[idx] as any)[field] = value;
    setForm({ ...form, items });
  };

  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const handleSave = async () => {
    try {
      if (!canPerformAction(currentUserProfile?.role, "audits", "create")) {
        toast.error("Unauthorized action");
        return;
      }
      const completed = form.items.filter((i) => i.completed).length;
      await add({ ...form, date: new Date().toISOString().slice(0, 10), completionRate: form.items.length > 0 ? Math.round((completed / form.items.length) * 100) : 0, createdBy: currentUserProfile?.id || "admin" });
      toast.success("Audit saved"); setShowModal(false);
      setForm({ summary: "", mood: "good", items: [{ id: "1", category: "Development", description: "", completed: false, notes: "", time: "" }] });
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    const audit = audits.find((a) => a.id === id);
    if (!audit || !canPerformAction(currentUserProfile?.role, "audits", "delete", audit)) {
      toast.error("Unauthorized action");
      return;
    }
    if (!confirm("Delete this audit?")) return;
    try { await remove(id); toast.success("Deleted"); } catch { toast.error("Failed"); }
  };

  const moodIcon = (mood?: string) => {
    switch (mood) {
      case "excellent": return <Heart className="w-5 h-5 text-pink-500" />;
      case "good": return <Smile className="w-5 h-5 text-emerald-500" />;
      case "neutral": return <Meh className="w-5 h-5 text-amber-500" />;
      case "poor": return <Frown className="w-5 h-5 text-red-500" />;
      default: return <Meh className="w-5 h-5 text-slate-400" />;
    }
  };

  if (loading) return <LoadingSpinner size="lg" message="Loading audits..." />;

  const visibleAudits = audits.filter(a => canPerformAction(currentUserProfile?.role, "audits", "read", a, currentUserProfile?.id));
  const canAdd = canPerformAction(currentUserProfile?.role, "audits", "create");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{visibleAudits.length} audit entries</p>
        {canAdd && (
          <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Audit</button>
        )}
      </div>

      {visibleAudits.length === 0 ? (
        <EmptyState title="No audit entries" message="Start your daily audit to track work and progress." action={canAdd ? <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Audit</button> : undefined} />
      ) : (
        <div className="space-y-3">
          {visibleAudits.sort((a, b) => b.date.localeCompare(a.date)).map((audit) => {
            const creator = members.find((m) => m.id === audit.createdBy);
            return (
              <div key={audit.id} className="card overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => setExpanded(expanded === audit.id ? null : audit.id)}>
                  {expanded === audit.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-slate-800">{audit.date}</p>
                      {creator && <span className="text-[10px] font-semibold bg-indigo-50 border border-indigo-150 text-indigo-700 px-2 py-0.5 rounded-md">👤 {creator.name}</span>}
                      {moodIcon(audit.mood)}
                    </div>
                    {audit.summary && <p className="text-xs text-slate-500 mt-0.5">{audit.summary}</p>}
                  </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${audit.completionRate >= 80 ? "bg-emerald-500" : audit.completionRate >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${audit.completionRate}%` }} />
                    </div>
                    <span className="text-xs font-medium text-slate-600">{audit.completionRate}%</span>
                  </div>
                  <span className="text-xs text-slate-400">{audit.items.length} items</span>
                  {canPerformAction(currentUserProfile?.role, "audits", "delete", audit) && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(audit.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
              {expanded === audit.id && (
                <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/30 space-y-2 animate-fade-in">
                  {audit.items.map((item, i) => (
                    <div key={item.id} className="flex items-start gap-3 py-2">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${item.completed ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                        {item.completed && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${item.completed ? "line-through text-slate-400" : "text-slate-700"}`}>{item.description || "Untitled item"}</span>
                          <span className="badge bg-slate-100 text-slate-500 border-slate-200">{item.category}</span>
                        </div>
                        {item.notes && <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>}
                        {item.time && <p className="text-xs text-slate-400">{item.time}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Daily Audit" size="lg"
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save Audit</button></>}>
        <div className="space-y-5">
          <div><label className="label">Summary</label><input className="input-field" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="How was your day?" /></div>
          <div>
            <label className="label">Mood</label>
            <div className="flex items-center gap-3">
              {(["excellent", "good", "neutral", "poor"] as const).map((m) => (
                <button key={m} onClick={() => setForm({ ...form, mood: m })} className={`p-3 rounded-xl border-2 transition-colors ${form.mood === m ? "border-primary-500 bg-primary-50" : "border-slate-200 hover:border-slate-300"}`}>
                  {moodIcon(m)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Checklist Items</label>
              <button onClick={addItem} className="text-sm text-primary-600 font-medium hover:text-primary-700">+ Add Item</button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, i) => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <button onClick={() => updateItem(i, "completed", !item.completed)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${item.completed ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                    {item.completed && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <div className="flex-1 space-y-2">
                    <input className="input-field" placeholder="What did you work on?" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                    <div className="grid grid-cols-3 gap-2">
                      <select className="input-field text-xs" value={item.category} onChange={(e) => updateItem(i, "category", e.target.value)}>
                        {["Development", "Design", "Marketing", "SEO", "Sales", "Writing", "Meeting", "Review", "Admin", "Learning", "General"].map((c) => <option key={c}>{c}</option>)}
                      </select>
                      <input className="input-field text-xs" placeholder="Time spent" value={item.time || ""} onChange={(e) => updateItem(i, "time", e.target.value)} />
                      <input className="input-field text-xs" placeholder="Notes" value={item.notes || ""} onChange={(e) => updateItem(i, "notes", e.target.value)} />
                    </div>
                  </div>
                  <button onClick={() => removeItem(i)} className="p-1 text-slate-400 hover:text-red-500 mt-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}