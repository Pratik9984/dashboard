"use client";
import React, { useState } from "react";
import { Plus, Edit2, Trash2, Send, Inbox, FileText, AlertCircle, Tag } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { EmailRecord } from "@/app/types";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import { formatDate, timeAgo } from "@/app/lib/data";
import toast from "react-hot-toast";

export default function EmailsPage() {
  const { data: emails, loading } = useCollection<EmailRecord>("emails");
  const { add, update, remove } = useFirestore("emails");
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<EmailRecord | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ from: "", to: "", cc: "", subject: "", body: "", status: "draft" as EmailRecord["status"], tags: "" });

  const openCompose = () => { setForm({ from: "", to: "", cc: "", subject: "", body: "", status: "draft", tags: "" }); setShowModal(true); };

  const handleSave = async () => {
    try {
      await add({ ...form, to: form.to.split(",").map((e) => e.trim()).filter(Boolean), cc: form.cc ? form.cc.split(",").map((e) => e.trim()).filter(Boolean) : [], tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean), date: new Date() });
      toast.success(form.status === "sent" ? "Email sent" : "Draft saved"); setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this email?")) return;
    try { await remove(id); if (selected?.id === id) setSelected(null); toast.success("Deleted"); } catch { toast.error("Failed"); }
  };

  const filtered = filter === "all" ? emails : emails.filter((e) => e.status === filter);

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <Send className="w-3.5 h-3.5 text-emerald-500" />;
      case "received": return <Inbox className="w-3.5 h-3.5 text-blue-500" />;
      case "draft": return <FileText className="w-3.5 h-3.5 text-slate-400" />;
      case "failed": return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return null;
    }
  };

  if (loading) return <LoadingSpinner size="lg" message="Loading emails..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {["all", "sent", "received", "draft", "failed"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={openCompose} className="btn-primary"><Plus className="w-4 h-4" /> Compose</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email List */}
        <div className="lg:col-span-1 card divide-y divide-slate-100 max-h-[calc(100vh-220px)] overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState title="No emails" message="Emails will appear here." />
          ) : (
            filtered.map((email) => (
              <div key={email.id} onClick={() => setSelected(email)} className={`px-4 py-3.5 cursor-pointer hover:bg-slate-50/80 transition-colors ${selected?.id === email.id ? "bg-primary-50/50 border-l-2 border-l-primary-500" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon(email.status)}
                    <p className="text-sm font-medium text-slate-800 truncate">{email.subject || "(No subject)"}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 ml-2 flex-shrink-0">{timeAgo(email.date as Date)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate">{email.status === "sent" ? `To: ${email.to.join(", ")}` : `From: ${email.from}`}</p>
                {email.tags.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {email.tags.slice(0, 3).map((tag) => <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded">{tag}</span>)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Email Detail */}
        <div className="lg:col-span-2 card">
          {selected ? (
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{selected.subject || "(No subject)"}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StatusBadge status={selected.status} />
                    <span className="text-xs text-slate-400">{formatDate(selected.date as Date)}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(selected.id)} className="btn-ghost text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="space-y-1.5 mb-4 text-sm">
                <p className="text-slate-600"><span className="font-medium text-slate-500 mr-2">From:</span>{selected.from}</p>
                <p className="text-slate-600"><span className="font-medium text-slate-500 mr-2">To:</span>{selected.to.join(", ")}</p>
                {selected.cc && selected.cc.length > 0 && <p className="text-slate-600"><span className="font-medium text-slate-500 mr-2">CC:</span>{selected.cc.join(", ")}</p>}
              </div>
              <div className="bg-slate-50 rounded-xl p-5 mb-4">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.body}</p>
              </div>
              {selected.tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  {selected.tags.map((tag) => <span key={tag} className="badge bg-slate-50 text-slate-600 border-slate-200">{tag}</span>)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-sm text-slate-400">
              <Inbox className="w-5 h-5 mr-2" /> Select an email to view
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Compose Email" size="lg"
        footer={<>
          <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={() => { setForm({ ...form, status: "draft" }); handleSave(); }} className="btn-secondary">Save Draft</button>
          <button onClick={() => { setForm({ ...form, status: "sent" }); handleSave(); }} className="btn-primary"><Send className="w-4 h-4" /> Send</button>
        </>}>
        <div className="space-y-4">
          <div><label className="label">From</label><input className="input-field" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></div>
          <div><label className="label">To (comma-separated)</label><input className="input-field" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></div>
          <div><label className="label">CC (comma-separated)</label><input className="input-field" value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input-field" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="label">Body</label><textarea className="input-field" rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <div><label className="label">Tags</label><input className="input-field" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="client, invoice, follow-up" /></div>
        </div>
      </Modal>
    </div>
  );
}
