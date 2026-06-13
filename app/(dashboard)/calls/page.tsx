"use client";
import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, PhoneCall, PhoneIncoming, PhoneOutgoing, MessageSquare, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { CallLog, Project } from "@/app/types";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";
import DataTable, { Column } from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { formatDate } from "@/app/lib/data";
import toast from "react-hot-toast";

export default function CallsPage() {
  const { data: calls, loading } = useCollection<CallLog>("calls");
  const { data: projects } = useCollection<Project>("projects");
  const { add, update, remove } = useFirestore("calls");
  const { profile: currentUserProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CallLog | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ type: "call" as CallLog["type"], contactName: "", contactEmail: "", contactPhone: "", direction: "outbound" as CallLog["direction"], status: "answered" as CallLog["status"], duration: "", notes: "", recordedBy: "" });

  const openAdd = () => { setEditing(null); setForm({ type: "call", contactName: "", contactEmail: "", contactPhone: "", direction: "outbound", status: "answered", duration: "", notes: "", recordedBy: currentUserProfile?.name || "" }); setShowModal(true); };
  const openEdit = (c: CallLog) => { setEditing(c); setForm({ type: c.type, contactName: c.contactName, contactEmail: c.contactEmail || "", contactPhone: c.contactPhone || "", direction: c.direction, status: c.status, duration: c.duration?.toString() || "", notes: c.notes || "", recordedBy: c.recordedBy }); setShowModal(true); };

  const handleSave = async () => {
    try {
      const action = editing ? "update" : "create";
      if (!canPerformAction(currentUserProfile?.role, "calls", action, editing || undefined, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }

      const data = { ...form, duration: form.duration ? parseInt(form.duration) : undefined, date: new Date(), recordedBy: form.recordedBy || currentUserProfile?.name || "admin" };
      if (editing) { await update(editing.id, data); toast.success("Updated"); }
      else { await add(data); toast.success("Log added"); }
      setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    const call = calls.find((c) => c.id === id);
    if (!call || !canPerformAction(currentUserProfile?.role, "calls", "delete", call)) {
      toast.error("Unauthorized action");
      return;
    }

    if (!confirm("Delete this log?")) return;
    try { await remove(id); toast.success("Deleted"); } catch { toast.error("Failed"); }
  };

  const isMemberOrViewer = currentUserProfile?.role === "member" || currentUserProfile?.role === "viewer";
  const userCalls = useMemo(() => {
    if (!isMemberOrViewer) return calls;

    const assignedClientNames = new Set(
      projects
        .filter((p) => p.assignees?.includes(currentUserProfile?.id || "") || p.createdBy === currentUserProfile?.id)
        .map((p) => p.clientName?.toLowerCase().trim())
    );

    return calls.filter((c) => {
      const isRecordedByMe = c.recordedBy?.toLowerCase() === currentUserProfile?.name?.toLowerCase() ||
                             c.recordedBy?.toLowerCase() === currentUserProfile?.email?.toLowerCase();
      const isRelatedToMyClient = assignedClientNames.has(c.contactName?.toLowerCase().trim());
      return isRecordedByMe || isRelatedToMyClient;
    });
  }, [calls, projects, isMemberOrViewer, currentUserProfile]);

  const filtered = filter === "all" ? userCalls : userCalls.filter((c) => c.type === filter);

  const typeIcon = (type: string) => {
    switch (type) {
      case "call": return <PhoneCall className="w-4 h-4 text-blue-500" />;
      case "sms": return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case "whatsapp": return <MessageSquare className="w-4 h-4 text-green-500" />;
      case "telegram": return <MessageSquare className="w-4 h-4 text-sky-500" />;
      default: return <PhoneCall className="w-4 h-4 text-slate-400" />;
    }
  };

  const columns = useMemo<Column<CallLog>[]>(() => [
    {
      key: "type", label: "Type", render: (c) => (
        <div className="flex items-center gap-2">{typeIcon(c.type)}<span className="text-sm capitalize font-medium text-slate-700">{c.type}</span></div>
      )
    },
    {
      key: "contactName", label: "Contact", sortable: true, render: (c) => (
        <div><p className="text-sm font-medium text-slate-800">{c.contactName}</p>{c.contactPhone && <p className="text-xs text-slate-400">{c.contactPhone}</p>}</div>
      )
    },
    {
      key: "direction", label: "Direction", render: (c) => (
        <div className="flex items-center gap-1.5">
          {c.direction === "inbound" ? <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" /> : <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />}
          <span className="text-sm text-slate-600 capitalize">{c.direction}</span>
        </div>
      )
    },
    { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "duration", label: "Duration", render: (c) => <span className="text-sm text-slate-600">{c.duration ? `${Math.floor(c.duration / 60)}m ${c.duration % 60}s` : "—"}</span> },
    { key: "date", label: "Date", render: (c) => <span className="text-sm text-slate-500">{formatDate(c.date as Date)}</span> },
    {
      key: "actions", label: "", render: (c) => {
        const canEdit = canPerformAction(currentUserProfile?.role, "calls", "update", c, currentUserProfile?.id);
        const canDelete = canPerformAction(currentUserProfile?.role, "calls", "delete", c);
        if (!canEdit && !canDelete) return null;
        return (
          <div className="flex items-center gap-1">
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

  if (loading) return <LoadingSpinner size="lg" message="Loading call logs..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "call", "sms", "whatsapp", "telegram"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* FIX: Explicitly cast columns and data array properties to bypass the strict Record generic enforcement */}
      <DataTable
        columns={columns as any[]}
        data={filtered as any[]}
        searchKeys={["contactName", "contactPhone", "notes"]}
        searchPlaceholder="Search calls..."
        actions={canPerformAction(currentUserProfile?.role, "calls", "create") ? <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Log Call</button> : undefined}
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Log" : "Log Call/Message"}
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>{canPerformAction(currentUserProfile?.role, "calls", editing ? "update" : "create", editing || undefined, currentUserProfile?.id) && <button onClick={handleSave} className="btn-primary">Save</button>}</>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Type</label><select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CallLog["type"] })}><option value="call">Call</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="telegram">Telegram</option></select></div>
            <div><label className="label">Direction</label><select className="input-field" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as CallLog["direction"] })}><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Contact Name</label><input className="input-field" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input-field" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Status</label><select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CallLog["status"] })}><option value="answered">Answered</option><option value="missed">Missed</option><option value="voicemail">Voicemail</option><option value="sent">Sent</option></select></div>
            <div><label className="label">Duration (sec)</label><input className="input-field" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
            <div><label className="label">Recorded By</label><input className="input-field" value={form.recordedBy} onChange={(e) => setForm({ ...form, recordedBy: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input-field" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}