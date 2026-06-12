"use client";
import React, { useState, useMemo } from "react";
import { Eye, Trash2, Archive, ExternalLink } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { Web3FormResponse } from "@/app/types";
import DataTable, { Column } from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { timeAgo } from "@/app/lib/data";
import toast from "react-hot-toast";

export default function Web3FormsPage() {
  const { data: submissions, loading } = useCollection<Web3FormResponse>("web3forms");
  const { update, remove } = useFirestore("web3forms");
  const [selected, setSelected] = useState<Web3FormResponse | null>(null);
  const [filter, setFilter] = useState("all");

  const updateStatus = async (id: string, status: string) => {
    try { await update(id, { status }); toast.success(`Marked as ${status}`); } catch { toast.error("Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this submission?")) return;
    try { await remove(id); setSelected(null); toast.success("Deleted"); } catch { toast.error("Failed"); }
  };

  const filtered = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);

  const columns = useMemo<Column<Web3FormResponse>[]>(() => [
    { key: "formName", label: "Form", sortable: true, render: (s) => (
      <div><p className="font-medium text-slate-800">{s.formName}</p><p className="text-xs text-slate-400">ID: {s.formId.slice(0, 8)}</p></div>
    )},
    { key: "submitterName", label: "Submitted By", sortable: true, render: (s) => (
      <div><p className="text-sm text-slate-700">{s.submitterName || "Anonymous"}</p><p className="text-xs text-slate-400">{s.submitterEmail || "—"}</p></div>
    )},
    { key: "status", label: "Status", render: (s) => <StatusBadge status={s.status} /> },
    { key: "submittedAt", label: "Submitted", render: (s) => <span className="text-sm text-slate-500">{timeAgo(s.submittedAt as Date)}</span> },
    { key: "data", label: "Fields", render: (s) => <span className="text-sm text-slate-500">{Object.keys(s.data).length} fields</span> },
    { key: "actions", label: "", render: (s) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); setSelected(s); if (s.status === "new") updateStatus(s.id, "read"); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); updateStatus(s.id, "archived"); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600"><Archive className="w-3.5 h-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    )},
  ], []);

  if (loading) return <LoadingSpinner size="lg" message="Loading submissions..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "new", "read", "processed", "archived"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)} {s !== "all" && <span className="text-xs opacity-70">({submissions.filter((sub) => sub.status === s).length})</span>}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-slate-800">{submissions.length}</p><p className="text-xs text-slate-500">Total Submissions</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-blue-600">{submissions.filter((s) => s.status === "new").length}</p><p className="text-xs text-slate-500">New</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{submissions.filter((s) => s.status === "processed").length}</p><p className="text-xs text-slate-500">Processed</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-slate-500">{new Set(submissions.map((s) => s.formId)).size}</p><p className="text-xs text-slate-500">Unique Forms</p></div>
      </div>

      {/* FIX: Cast data collections to any[] to bypass strict generic enforcement */}
      <DataTable columns={columns as any[]} data={filtered as any[]} searchKeys={["formName", "submitterName", "submitterEmail"]} searchPlaceholder="Search submissions..." />

      {/* Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Submission Details" size="lg"
        footer={<>
          <button onClick={() => { if (selected) updateStatus(selected.id, "processed"); setSelected(null); }} className="btn-primary">Mark Processed</button>
          <button onClick={() => setSelected(null)} className="btn-secondary">Close</button>
        </>}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Form</p><p className="text-sm font-medium text-slate-800">{selected.formName}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Status</p><StatusBadge status={selected.status} /></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Submitter</p><p className="text-sm text-slate-700">{selected.submitterName || "Anonymous"}</p><p className="text-xs text-slate-400">{selected.submitterEmail}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">IP Address</p><p className="text-sm text-slate-700">{selected.ipAddress || "—"}</p></div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Form Data</h4>
              <div className="bg-slate-50 rounded-lg divide-y divide-slate-100">
                {Object.entries(selected.data).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between px-4 py-2.5">
                    <span className="text-sm font-medium text-slate-600">{key}</span>
                    <span className="text-sm text-slate-800 text-right max-w-[60%]">{Array.isArray(value) ? value.join(", ") : String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
