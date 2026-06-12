"use client";
import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Video, MapPin, Clock, Users as UsersIcon, ExternalLink } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { Meeting } from "@/app/types";
import DataTable, { Column } from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { formatDate } from "@/app/lib/data";
import toast from "react-hot-toast";
import { Timestamp } from "firebase/firestore";

export default function MeetingsPage() {
  const { data: meetings, loading } = useCollection<Meeting>("meetings");
  const { add, update, remove } = useFirestore("meetings");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", type: "internal" as Meeting["type"], status: "scheduled" as Meeting["status"], duration: 30, location: "", meetingUrl: "", notes: "", attendeeNames: "", actionItems: "" });

  const openAdd = () => { setEditing(null); setForm({ title: "", description: "", type: "internal", status: "scheduled", duration: 30, location: "", meetingUrl: "", notes: "", attendeeNames: "", actionItems: "" }); setShowModal(true); };
  const openEdit = (m: Meeting) => { setEditing(m); setForm({ title: m.title, description: m.description || "", type: m.type, status: m.status, duration: m.duration, location: m.location || "", meetingUrl: m.meetingUrl || "", notes: m.notes || "", attendeeNames: m.attendeeNames.join(", "), actionItems: m.actionItems?.join("\n") || "" }); setShowModal(true); };

  const handleSave = async () => {
    try {
      const data = { ...form, attendees: [], attendeeNames: form.attendeeNames.split(",").map((n) => n.trim()).filter(Boolean), actionItems: form.actionItems.split("\n").filter(Boolean), date: Timestamp.now(), createdBy: "admin" };
      if (editing) { await update(editing.id, data); toast.success("Meeting updated"); }
      else { await add(data); toast.success("Meeting scheduled"); }
      setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this meeting?")) return;
    try { await remove(id); toast.success("Deleted"); } catch { toast.error("Failed"); }
  };

  const filtered = filter === "all" ? meetings : meetings.filter((m) => m.status === filter);

  const columns = useMemo<Column<Meeting>[]>(() => [
    { key: "title", label: "Meeting", sortable: true, render: (m) => (
      <div>
        <p className="font-medium text-slate-800">{m.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{m.description?.slice(0, 60)}</p>
      </div>
    )},
    { key: "type", label: "Type", render: (m) => <StatusBadge status={m.type} /> },
    { key: "status", label: "Status", render: (m) => <StatusBadge status={m.status} /> },
    { key: "attendeeNames", label: "Attendees", render: (m) => (
      <div className="flex items-center gap-1">
        <UsersIcon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-sm text-slate-600">{m.attendeeNames.length}</span>
      </div>
    )},
    { key: "duration", label: "Duration", render: (m) => <span className="text-sm text-slate-600">{m.duration}min</span> },
    { key: "date", label: "Date", render: (m) => <span className="text-sm text-slate-500">{formatDate(m.date as Date)}</span> },
    { key: "meetingUrl", label: "Link", render: (m) => m.meetingUrl ? <a href={m.meetingUrl} target="_blank" className="text-primary-600 hover:text-primary-700"><ExternalLink className="w-4 h-4" /></a> : <span className="text-slate-300">—</span> },
    { key: "actions", label: "", render: (m) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(m); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 className="w-3.5 h-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    )},
  ], []);

  if (loading) return <LoadingSpinner size="lg" message="Loading meetings..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "scheduled", "completed", "cancelled", "rescheduled"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {/* FIX: Cast data collections to any[] to bypass strict generic enforcement */}
      <DataTable columns={columns as any[]} data={filtered as any[]} searchKeys={["title", "description"]} searchPlaceholder="Search meetings..."
        actions={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Schedule</button>} />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Meeting" : "Schedule Meeting"} size="lg"
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save</button></>}>
        <div className="space-y-4">
          <div><label className="label">Title</label><input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Type</label><select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Meeting["type"] })}><option value="internal">Internal</option><option value="client">Client</option><option value="discovery">Discovery</option><option value="review">Review</option><option value="demo">Demo</option></select></div>
            <div><label className="label">Status</label><select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Meeting["status"] })}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="rescheduled">Rescheduled</option></select></div>
            <div><label className="label">Duration (min)</label><input className="input-field" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 30 })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Location</label><input className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Office, Zoom, etc." /></div>
            <div><label className="label">Meeting URL</label><input className="input-field" value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} placeholder="https://..." /></div>
          </div>
          <div><label className="label">Attendees (comma-separated names)</label><input className="input-field" value={form.attendeeNames} onChange={(e) => setForm({ ...form, attendeeNames: e.target.value })} /></div>
          <div><label className="label">Notes</label><textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div><label className="label">Action Items (one per line)</label><textarea className="input-field" rows={3} value={form.actionItems} onChange={(e) => setForm({ ...form, actionItems: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}
