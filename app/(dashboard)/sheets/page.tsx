"use client";
import React, { useState } from "react";
import { Plus, Download, Trash2, Upload, Table as TableIcon } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { SheetData } from "@/app/types";
import Modal from "@/app/components/Modal";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import toast from "react-hot-toast";

export default function SheetsPage() {
  const { data: sheets, loading } = useCollection<SheetData>("sheets");
  const { add, update, remove } = useFirestore("sheets");
  const [showModal, setShowModal] = useState(false);
  const [activeSheet, setActiveSheet] = useState<SheetData | null>(null);
  const [form, setForm] = useState({ name: "", description: "", type: "custom" as SheetData["type"], columns: "Name, Email, Status" });

  const openAdd = () => { setForm({ name: "", description: "", type: "custom", columns: "Name, Email, Status" }); setShowModal(true); };

  const handleCreate = async () => {
    try {
      const cols = form.columns.split(",").map((c) => c.trim()).filter(Boolean);
      await add({ name: form.name, description: form.description, type: form.type, columns: cols, rows: [], createdBy: "admin", updatedAt: new Date() });
      toast.success("Sheet created"); setShowModal(false);
    } catch { toast.error("Failed to create"); }
  };

  const handleExport = (sheet: SheetData) => {
    try {
      const XLSX = require("xlsx");
      const ws = XLSX.utils.json_to_sheet(sheet.rows.length > 0 ? sheet.rows : [Object.fromEntries(sheet.columns.map((c) => [c, ""]))]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
      XLSX.writeFile(wb, `${sheet.name.replace(/\s+/g, "_")}.xlsx`);
      toast.success("Exported!");
    } catch { toast.error("Export failed. Make sure xlsx is installed."); }
  };

  const addRow = async (sheet: SheetData) => {
    const newRow = Object.fromEntries(sheet.columns.map((c) => [c, ""]));
    const updatedRows = [...sheet.rows, newRow];
    try { await update(sheet.id, { rows: updatedRows }); toast.success("Row added"); } catch { toast.error("Failed"); }
  };

  const updateCell = async (sheet: SheetData, rowIndex: number, col: string, value: string) => {
    const rows = [...sheet.rows];
    rows[rowIndex] = { ...rows[rowIndex], [col]: value };
    try { await update(sheet.id, { rows }); } catch { console.error("Failed to save"); }
  };

  const deleteRow = async (sheet: SheetData, rowIndex: number) => {
    const rows = sheet.rows.filter((_, i) => i !== rowIndex);
    try { await update(sheet.id, { rows }); toast.success("Row deleted"); } catch { toast.error("Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sheet?")) return;
    try { await remove(id); if (activeSheet?.id === id) setActiveSheet(null); toast.success("Deleted"); } catch { toast.error("Failed"); }
  };

  if (loading) return <LoadingSpinner size="lg" message="Loading sheets..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{sheets.length} sheet{sheets.length !== 1 ? "s" : ""}</p>
        <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> New Sheet</button>
      </div>

      {/* Sheet List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sheets.length === 0 ? (
          <div className="col-span-full">
            <EmptyState title="No sheets yet" message="Create a sheet to organize and export your data." action={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> New Sheet</button>} />
          </div>
        ) : (
          sheets.map((sheet) => (
            <div key={sheet.id} className={`card-hover p-5 cursor-pointer ${activeSheet?.id === sheet.id ? "ring-2 ring-primary-500" : ""}`} onClick={() => setActiveSheet(sheet)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                    <TableIcon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{sheet.name}</h3>
                    <p className="text-xs text-slate-400">{sheet.rows.length} rows · {sheet.columns.length} cols</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); handleExport(sheet); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600" title="Export XLSX"><Download className="w-3.5 h-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(sheet.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {sheet.description && <p className="text-xs text-slate-400 mt-2">{sheet.description}</p>}
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <span className="badge bg-primary-50 text-primary-600 border-primary-200">{sheet.type}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Active Sheet Table */}
      {activeSheet && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-800">{activeSheet.name}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => addRow(activeSheet)} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> Row</button>
              <button onClick={() => handleExport(activeSheet)} className="btn-ghost text-xs"><Download className="w-3.5 h-3.5" /> Export</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-12">#</th>
                  {activeSheet.columns.map((col) => <th key={col} className="table-header">{col}</th>)}
                  <th className="table-header w-12"></th>
                </tr>
              </thead>
              <tbody>
                {activeSheet.rows.length === 0 ? (
                  <tr><td colSpan={activeSheet.columns.length + 2} className="text-center py-8 text-sm text-slate-400">No data. Click "+ Row" to add.</td></tr>
                ) : (
                  activeSheet.rows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-slate-50/50">
                      <td className="table-cell text-xs text-slate-400 text-center">{ri + 1}</td>
                      {activeSheet.columns.map((col) => (
                        <td key={col} className="table-cell p-1">
                          <input className="w-full px-2 py-1.5 text-sm bg-transparent border border-transparent hover:border-slate-200 focus:border-primary-400 focus:bg-white rounded outline-none transition-colors"
                            value={String(row[col] ?? "")} onChange={(e) => updateCell(activeSheet, ri, col, e.target.value)} />
                        </td>
                      ))}
                      <td className="table-cell">
                        <button onClick={() => deleteRow(activeSheet, ri)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Sheet"
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary">Create</button></>}>
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Description</label><input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">Type</label><select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SheetData["type"] })}>
            <option value="custom">Custom</option><option value="projects">Projects</option><option value="clients">Clients</option><option value="pipeline">Pipeline</option><option value="responses">Responses</option><option value="tasks">Tasks</option><option value="calls">Calls</option>
          </select></div>
          <div><label className="label">Columns (comma-separated)</label><input className="input-field" value={form.columns} onChange={(e) => setForm({ ...form, columns: e.target.value })} placeholder="Name, Email, Phone, Status" /></div>
        </div>
      </Modal>
    </div>
  );
}
