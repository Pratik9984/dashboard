"use client";
import React, { useState, useRef, useMemo } from "react";
import { Plus, Download, Trash2, Upload, Edit2, Table as TableIcon } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { SheetData, TeamMember } from "@/app/types";
import Modal from "@/app/components/Modal";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import toast from "react-hot-toast";
import { getDb } from "@/app/lib/firebase";
import { writeBatch, doc as firestoreDoc, collection, Timestamp } from "firebase/firestore";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";

// Helper function to map dynamic sheet columns to database collection properties
function mapRowToSchema(row: Record<string, any>, type: string) {
  const normalizedRow: Record<string, any> = {};
  Object.entries(row).forEach(([k, v]) => {
    normalizedRow[k.toLowerCase().replace(/[\s_-]+/g, "")] = v;
  });

  const getVal = (possibleKeys: string[], defaultValue: any) => {
    for (const key of possibleKeys) {
      const normalizedKey = key.toLowerCase().replace(/[\s_-]+/g, "");
      if (normalizedRow[normalizedKey] !== undefined && normalizedRow[normalizedKey] !== null) {
        return normalizedRow[normalizedKey];
      }
    }
    return defaultValue;
  };

  if (type === "clients") {
    return {
      name: String(getVal(["name", "clientname", "fullname", "client"], "Unnamed Client")).trim(),
      company: String(getVal(["company", "business", "companyname", "organization"], "")).trim(),
      email: String(getVal(["email", "emailaddress", "mail"], "")).trim(),
      phone: String(getVal(["phone", "phonenumber", "telephone", "mobile"], "")).trim(),
      website: String(getVal(["website", "site", "url"], "")).trim(),
      industry: String(getVal(["industry", "sector"], "")).trim(),
      status: String(getVal(["status", "clientstatus"], "active")).trim() as any,
      totalProjects: Number(getVal(["totalprojects", "projects", "projectcount"], 0)) || 0,
      totalValue: Number(getVal(["totalvalue", "value", "revenue", "budget"], 0)) || 0,
      notes: String(getVal(["notes", "description", "details"], "")).trim(),
    };
  }

  if (type === "projects") {
    return {
      name: String(getVal(["name", "projectname", "title"], "Unnamed Project")).trim(),
      description: String(getVal(["description", "details", "summary", "notes"], "")).trim(),
      clientName: String(getVal(["clientname", "client", "company"], "Unnamed Client")).trim(),
      status: String(getVal(["status", "projectstatus"], "planning")).trim() as any,
      priority: String(getVal(["priority", "projectpriority"], "medium")).trim() as any,
      progress: Number(getVal(["progress", "completion", "percentage"], 0)) || 0,
      budget: Number(getVal(["budget", "value", "cost"], 0)) || 0,
      assignees: String(getVal(["assignees", "assignedto", "team", "people"], ""))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      tags: String(getVal(["tags", "keywords", "categories"], ""))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      startDate: new Date(getVal(["startdate", "start"], new Date())),
      dueDate: new Date(getVal(["duedate", "due", "deadline"], new Date())),
      createdBy: "admin",
    };
  }

  if (type === "leads") {
    return {
      ...row,
      name: String(getVal(["name", "contactname", "leadname", "lead", "businessname", "companyname", "business"], "Unnamed Lead")).trim(),
      company: String(getVal(["company", "business", "organization", "businessname", "companyname"], "")).trim(),
      email: String(getVal(["email", "emailaddress", "mail"], "")).trim(),
      phone: String(getVal(["phone", "phonenumber", "mobile", "phonecontact", "whatsappno", "whatsapp"], "")).trim(),
      source: String(getVal(["source", "leadsource", "channel", "cityregion", "country"], "Organic")).trim(),
      stage: (() => {
        const rawStage = String(getVal(["stage", "leadstage", "status"], "new")).trim().toLowerCase();
        const validStages = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];
        return validStages.includes(rawStage) ? rawStage : "new";
      })(),
      value: Number(getVal(["value", "dealvalue", "revenue", "budget"], 0)) || 0,
      notes: String(getVal(["notes", "details", "description", "outreachnotes", "servicetype"], "")).trim(),
      assignedTo: String(getVal(["assignedto", "owner", "assignee"], "admin")).trim(),
      updatedAt: new Date(),
    };
  }

  if (type === "responses") {
    return {
      name: String(getVal(["name", "sendername", "submitter"], "Anonymous")).trim(),
      email: String(getVal(["email", "senderemail", "emailaddress"], "")).trim(),
      phone: String(getVal(["phone", "phonenumber"], "")).trim(),
      subject: String(getVal(["subject", "title"], "Website Contact")).trim(),
      message: String(getVal(["message", "details", "text", "body"], "No message content")).trim(),
      source: String(getVal(["source", "channel"], "website")).trim() as any,
      status: String(getVal(["status"], "new")).trim() as any,
      priority: String(getVal(["priority"], "medium")).trim() as any,
      assignedTo: String(getVal(["assignedto", "owner"], "")).trim(),
    };
  }

  if (type === "tasks") {
    return {
      title: String(getVal(["title", "taskname", "name"], "Unnamed Task")).trim(),
      description: String(getVal(["description", "details", "notes"], "")).trim(),
      projectName: String(getVal(["projectname", "project"], "General")).trim(),
      projectId: String(getVal(["projectid"], "")).trim(),
      assigneeName: String(getVal(["assigneename", "assignee", "assignedto"], "admin")).trim(),
      assignedTo: String(getVal(["assignedto", "assigneeid"], "admin")).trim(),
      status: String(getVal(["status", "taskstatus"], "todo")).trim() as any,
      priority: String(getVal(["priority", "taskpriority"], "medium")).trim() as any,
      tags: String(getVal(["tags", "categories"], ""))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      dueDate: new Date(getVal(["duedate", "due"], new Date())),
      createdBy: "admin",
    };
  }

  if (type === "calls") {
    return {
      contactName: String(getVal(["contactname", "name", "customer"], "Unnamed Contact")).trim(),
      contactEmail: String(getVal(["contactemail", "email"], "")).trim(),
      contactPhone: String(getVal(["contactphone", "phone", "number"], "")).trim(),
      type: String(getVal(["type", "calltype", "medium"], "call")).trim() as any,
      direction: String(getVal(["direction", "calldirection"], "outbound")).trim() as any,
      status: String(getVal(["status", "callstatus"], "completed")).trim() as any,
      duration: Number(getVal(["duration", "seconds", "length"], 0)) || 0,
      notes: String(getVal(["notes", "summary", "details"], "")).trim(),
      recordedBy: String(getVal(["recordedby", "agent", "user"], "admin")).trim(),
      date: new Date(getVal(["date", "time", "timestamp"], new Date())),
    };
  }

  return null;
}

export default function SheetsPage() {
  const db = getDb();
  const { data: sheets, loading } = useCollection<SheetData>("sheets");
  const { data: users } = useCollection<TeamMember>("users");
  const { add, update, remove } = useFirestore("sheets");
  const { profile: currentUserProfile, isAdmin, isManager } = useAuth();
  const isRestricted = !isAdmin && !isManager;

  // Instantiated collection writers for data transfers
  const firestoreClients = useFirestore("clients");
  const firestoreProjects = useFirestore("projects");
  const firestoreLeads = useFirestore("leads");
  const firestoreResponses = useFirestore("responses");
  const firestoreTasks = useFirestore("tasks");
  const firestoreCalls = useFirestore("calls");

  const [showModal, setShowModal] = useState(false);
  const [editingSheet, setEditingSheet] = useState<SheetData | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetData | null>(null);
  const [form, setForm] = useState({ name: "", description: "", type: "custom" as SheetData["type"], columns: "Name, Email, Status", assignedTo: "" });
  const [transferring, setTransferring] = useState(false);

  // States & Ref for spreadsheet upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: "", description: "", type: "leads" as SheetData["type"], assignedTo: "" });
  const [uploadTempData, setUploadTempData] = useState<{ columns: string[]; rows: any[] } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const XLSX = require("xlsx");
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        
        // Parse raw grid as arrays to find the actual header row index dynamically
        const rawGrid = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (rawGrid.length === 0) {
          toast.error("The spreadsheet is empty.");
          return;
        }

        // Find the first row that has more than 2 non-empty cells (skips banners/notes)
        const headerRowIndex = rawGrid.findIndex(
          (row) => row && row.filter((cell) => cell !== undefined && cell !== null && String(cell).trim() !== "").length > 2
        );

        if (headerRowIndex === -1) {
          toast.error("Could not find column headers in the spreadsheet.");
          return;
        }

        const rawHeaders = rawGrid[headerRowIndex];
        const cols = rawHeaders
          .map((h) => (h !== undefined && h !== null ? String(h).trim() : ""))
          .filter((h) => h !== "" && !h.startsWith("__EMPTY"));

        if (cols.length === 0) {
          toast.error("No valid column headers found.");
          return;
        }

        // Parse data rows starting after the headerRowIndex
        const cleanRows: any[] = [];
        for (let i = headerRowIndex + 1; i < rawGrid.length; i++) {
          const rowData = rawGrid[i];
          // Skip empty rows or section divider rows (like "▶ UAE" with only 1 populated cell)
          if (!rowData || rowData.filter((cell) => cell !== undefined && cell !== null && String(cell).trim() !== "").length <= 1) {
            continue;
          }

          const cleanRow: Record<string, string | number | boolean> = {};
          cols.forEach((col, colIdx) => {
            const rawValue = rowData[colIdx];
            cleanRow[col] = rawValue !== undefined && rawValue !== null ? rawValue : "";
          });
          cleanRows.push(cleanRow);
        }

        if (cleanRows.length === 0) {
          toast.error("No data rows found below the header row.");
          return;
        }

        setUploadTempData({ columns: cols, rows: cleanRows });
        setUploadForm({
          name: file.name.replace(/\.[^/.]+$/, ""),
          description: `Uploaded spreadsheet data from ${file.name}`,
          type: "leads",
          assignedTo: isRestricted ? currentUserProfile?.id || "" : ""
        });
        setShowUploadModal(true);
      } catch (err: any) {
        console.error("Error parsing spreadsheet:", err);
        toast.error("Failed to parse the spreadsheet. Make sure it is a valid format.");
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read the file.");
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveUpload = async () => {
    if (!uploadTempData) return;
    if (!uploadForm.name.trim()) {
      toast.error("Please provide a sheet name.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Saving uploaded sheet...");
    try {
      await add({
        name: uploadForm.name.trim(),
        description: uploadForm.description.trim(),
        type: uploadForm.type,
        columns: uploadTempData.columns,
        rows: uploadTempData.rows,
        assignedTo: uploadForm.assignedTo || "",
        createdBy: currentUserProfile?.id || "admin",
        updatedAt: new Date(),
      });
      toast.success("Sheet uploaded successfully!", { id: toastId });
      setShowUploadModal(false);
      setUploadTempData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error("Failed to save uploaded sheet:", err);
      toast.error("Failed to save the sheet.", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const openAdd = () => { setEditingSheet(null); setForm({ name: "", description: "", type: "custom", columns: "Name, Email, Status", assignedTo: isRestricted ? currentUserProfile?.id || "" : "" }); setShowModal(true); };
  
  const openEdit = (sheet: SheetData) => {
    setEditingSheet(sheet);
    setForm({
      name: sheet.name,
      description: sheet.description || "",
      type: sheet.type,
      columns: sheet.columns.join(", "),
      assignedTo: sheet.assignedTo || ""
    });
    setShowModal(true);
  };

  const handleTransfer = async (sheet: SheetData) => {
    if (!canPerformAction(currentUserProfile?.role, "sheets", "update", sheet, currentUserProfile?.id)) {
      toast.error("Unauthorized action");
      return;
    }

    if (sheet.type === "custom") {
      toast.error("Custom sheets cannot be mapped to a specific collection. Change the sheet type to transfer.");
      return;
    }

    if (sheet.rows.length === 0) {
      toast.error("This sheet has no data to transfer.");
      return;
    }

    const confirmMsg = `Transfer ${sheet.rows.length} rows from this sheet into the "${sheet.type}" database collection?`;
    if (!confirm(confirmMsg)) return;

    setTransferring(true);
    const toastId = toast.loading(`Transferring ${sheet.rows.length} rows to the "${sheet.type}" collection...`);

    let successCount = 0;
    let failCount = 0;

    try {
      const rowsToTransfer = sheet.rows
        .map((row) => mapRowToSchema(row, sheet.type))
        .filter(Boolean);

      failCount = sheet.rows.length - rowsToTransfer.length;

      if (rowsToTransfer.length === 0) {
        throw new Error("No valid rows could be parsed for transfer.");
      }

      // Get assignee name from users collection if the sheet is assigned
      const sheetAssignee = sheet.assignedTo ? users.find((u) => u.id === sheet.assignedTo) : null;
      const assigneeName = sheetAssignee ? sheetAssignee.name : "admin";

      // Chunk rows into groups of 400 to prevent exceeding Firestore batch limit of 500
      const chunkSize = 400;
      for (let i = 0; i < rowsToTransfer.length; i += chunkSize) {
        const chunk = rowsToTransfer.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((data) => {
          const docRef = firestoreDoc(collection(db, sheet.type));
          const docData: any = {
            ...data,
            sheetId: sheet.id,
            sheetName: sheet.name,
            createdAt: Timestamp.now(),
          };
          if (sheet.type === "leads" && sheet.assignedTo) {
            docData.assignedTo = assigneeName;
          }
          batch.set(docRef, docData);
          successCount++;
        });

        await batch.commit();
      }

      // Clear localStorage cache for the target collection to force fresh data load
      if (typeof window !== "undefined") {
        const prefix = `stackscale_col_${sheet.type}`;
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }

      toast.success(`Successfully transferred ${successCount} records into the "${sheet.type}" database collection!`, { id: toastId });
      if (failCount > 0) {
        toast(`⚠️ Failed to parse ${failCount} rows.`, { icon: '⚠️' });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Transfer failed: ${err.message || err}`, { id: toastId });
    } finally {
      setTransferring(false);
    }
  };

  const handleSave = async () => {
    try {
      const action = editingSheet ? "update" : "create";
      if (!canPerformAction(currentUserProfile?.role, "sheets", action, editingSheet || undefined, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }

      const cols = form.columns.split(",").map((c) => c.trim()).filter(Boolean);
      const data: any = { 
        name: form.name.trim(), 
        description: form.description.trim(), 
        type: form.type, 
        columns: cols, 
        assignedTo: form.assignedTo || "",
        updatedAt: new Date() 
      };
      
      if (editingSheet) {
        await update(editingSheet.id, data);
        toast.success("Sheet updated");
      } else {
        await add({ ...data, rows: [], createdBy: currentUserProfile?.id || "admin", createdAt: new Date() });
        toast.success("Sheet created");
      }
      setShowModal(false);
    } catch { toast.error("Failed to save sheet"); }
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
    if (!canPerformAction(currentUserProfile?.role, "sheets", "update", sheet, currentUserProfile?.id)) {
      toast.error("Unauthorized action");
      return;
    }
    const newRow = Object.fromEntries(sheet.columns.map((c) => [c, ""]));
    const updatedRows = [...sheet.rows, newRow];
    try { await update(sheet.id, { rows: updatedRows }); toast.success("Row added"); } catch { toast.error("Failed"); }
  };

  const updateCell = async (sheet: SheetData, rowIndex: number, col: string, value: string) => {
    if (!canPerformAction(currentUserProfile?.role, "sheets", "update", sheet, currentUserProfile?.id)) {
      console.warn("Unauthorized cell edit attempt");
      return;
    }
    const rows = [...sheet.rows];
    rows[rowIndex] = { ...rows[rowIndex], [col]: value };
    try { await update(sheet.id, { rows }); } catch { console.error("Failed to save"); }
  };

  const deleteRow = async (sheet: SheetData, rowIndex: number) => {
    if (!canPerformAction(currentUserProfile?.role, "sheets", "update", sheet, currentUserProfile?.id)) {
      toast.error("Unauthorized action");
      return;
    }
    const rows = sheet.rows.filter((_, i) => i !== rowIndex);
    try { await update(sheet.id, { rows }); toast.success("Row deleted"); } catch { toast.error("Failed"); }
  };

  const handleDelete = async (id: string) => {
    const target = sheets.find((s) => s.id === id);
    if (!target || !canPerformAction(currentUserProfile?.role, "sheets", "delete", target, currentUserProfile?.id)) {
      toast.error("Unauthorized action");
      return;
    }
    if (!confirm("Delete this sheet?")) return;
    try { await remove(id); if (activeSheet?.id === id) setActiveSheet(null); toast.success("Deleted"); } catch { toast.error("Failed"); }
  };

  const userSheets = useMemo(() => {
    if (!isRestricted) return sheets;
    return sheets.filter(s => s.assignedTo === currentUserProfile?.id || s.createdBy === currentUserProfile?.id);
  }, [sheets, isRestricted, currentUserProfile]);

  if (loading) return <LoadingSpinner size="lg" message="Loading sheets..." />;

  const canCreateSheet = canPerformAction(currentUserProfile?.role, "sheets", "create");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{userSheets.length} sheet{userSheets.length !== 1 ? "s" : ""}</p>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          {canCreateSheet && (
            <>
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                <Upload className="w-4 h-4" /> Upload Sheet
              </button>
              <button onClick={openAdd} className="btn-primary">
                <Plus className="w-4 h-4" /> New Sheet
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sheet List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {userSheets.length === 0 ? (
          <div className="col-span-full">
            <EmptyState title="No sheets yet" message="Create a sheet to organize and export your data." action={canCreateSheet ? <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> New Sheet</button> : undefined} />
          </div>
        ) : (
          userSheets.map((sheet) => {
            const canEdit = canPerformAction(currentUserProfile?.role, "sheets", "update", sheet, currentUserProfile?.id);
            const canDelete = canPerformAction(currentUserProfile?.role, "sheets", "delete", sheet, currentUserProfile?.id);

            return (
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
                    {canEdit && (
                      <button onClick={(e) => { e.stopPropagation(); openEdit(sheet); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Edit Sheet"><Edit2 className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleExport(sheet); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600" title="Export XLSX"><Download className="w-3.5 h-3.5" /></button>
                    {canDelete && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(sheet.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
                {sheet.description && <p className="text-xs text-slate-400 mt-2">{sheet.description}</p>}
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <span className="badge bg-primary-50 text-primary-600 border-primary-200">{sheet.type}</span>
                  {sheet.assignedTo && (
                    (() => {
                      const assignee = users.find((u) => u.id === sheet.assignedTo);
                      return (
                        <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200">
                          👤 {assignee ? assignee.name : "Unknown"}
                        </span>
                      );
                    })()
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Active Sheet Table */}
      {activeSheet && (
        (() => {
          const canModifyActiveSheet = canPerformAction(currentUserProfile?.role, "sheets", "update", activeSheet, currentUserProfile?.id);
          return (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-semibold text-slate-800">{activeSheet.name}</h3>
                  {activeSheet.type !== "custom" && (
                    <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] uppercase font-bold">
                      Mapped: {activeSheet.type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canModifyActiveSheet && (
                    <button onClick={() => addRow(activeSheet)} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> Row</button>
                  )}
                  {activeSheet.type !== "custom" && canModifyActiveSheet && (
                    <button
                      onClick={() => handleTransfer(activeSheet)}
                      disabled={transferring}
                      className="btn-ghost text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                      title={`Transfer sheet rows directly to the ${activeSheet.type} collection`}
                    >
                      <Upload className="w-3.5 h-3.5" /> Transfer to DB
                    </button>
                  )}
                  <button onClick={() => handleExport(activeSheet)} className="btn-ghost text-xs"><Download className="w-3.5 h-3.5" /> Export</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ minWidth: activeSheet.columns.length * 150 }}>
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
                                value={String(row[col] ?? "")} onChange={(e) => updateCell(activeSheet, ri, col, e.target.value)} disabled={!canModifyActiveSheet} />
                            </td>
                          ))}
                          <td className="table-cell">
                            {canModifyActiveSheet && (
                              <button onClick={() => deleteRow(activeSheet, ri)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingSheet ? "Edit Sheet" : "Create Sheet"}
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save</button></>}>
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Description</label><input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Type</label><select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SheetData["type"] })}>
              <option value="custom">Custom</option><option value="projects">Projects</option><option value="clients">Clients</option><option value="leads">Leads</option><option value="responses">Responses</option><option value="tasks">Tasks</option><option value="calls">Calls</option>
            </select></div>
            <div>
              <label className="label">Assigned To</label>
              <select
                className="input-field"
                value={form.assignedTo || ""}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                disabled={isRestricted}
              >
                <option value="">Unassigned</option>
                {users
                  .filter((u) => {
                    if (isRestricted) {
                      return u.id === currentUserProfile?.id;
                    }
                    return true;
                  })
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))
                }
              </select>
            </div>
          </div>
          <div><label className="label">Columns (comma-separated)</label><input className="input-field" value={form.columns} onChange={(e) => setForm({ ...form, columns: e.target.value })} placeholder="Name, Email, Phone, Status" disabled={!!editingSheet} /></div>
        </div>
      </Modal>

      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadTempData(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        title="Import Spreadsheet"
        footer={
          <>
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadTempData(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="btn-secondary"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveUpload}
              className="btn-primary"
              disabled={isUploading}
            >
              {isUploading ? "Uploading..." : "Confirm & Save"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Sheet Name</label>
            <input
              className="input-field"
              value={uploadForm.name}
              onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
              placeholder="e.g. Lead List June"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input-field"
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder="Description of the spreadsheet"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Sheet Type (Mapping Collection)</label>
              <select
                className="input-field"
                value={uploadForm.type}
                onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value as SheetData["type"] })}
              >
                <option value="custom">Custom (No Auto-mapping)</option>
                <option value="leads">Leads</option>
                <option value="clients">Clients</option>
                <option value="projects">Projects</option>
                <option value="tasks">Tasks</option>
                <option value="calls">Calls</option>
                <option value="responses">Form Responses</option>
              </select>
            </div>
            <div>
              <label className="label">Assigned To</label>
              <select
                className="input-field"
                value={uploadForm.assignedTo || ""}
                onChange={(e) => setUploadForm({ ...uploadForm, assignedTo: e.target.value })}
                disabled={isRestricted}
              >
                <option value="">Unassigned</option>
                {users
                  .filter((u) => {
                    if (isRestricted) {
                      return u.id === currentUserProfile?.id;
                    }
                    return true;
                  })
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))
                }
              </select>
            </div>
          </div>
          {uploadTempData && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-2">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Rows Found:</span>
                <span className="text-slate-800">{uploadTempData.rows.length}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block mb-1">Columns Found:</span>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-white border border-slate-100 rounded">
                  {uploadTempData.columns.map((col) => (
                    <span key={col} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-700 font-mono">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
