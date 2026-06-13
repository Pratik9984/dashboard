"use client";
import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, ArrowRight, DollarSign, PhoneCall } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { Lead, CallLog } from "@/app/types";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import { LEAD_STAGES, formatCurrency, timeAgo, CHART_COLORS } from "@/app/lib/data";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import toast from "react-hot-toast";
import { Timestamp, writeBatch, doc as firestoreDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

export default function LeadsPage() {
  const { data: leads, loading, refresh } = useCollection<Lead>("leads");
  const { add, update, remove } = useFirestore("leads");
  const { add: addCallLog } = useFirestore("calls");
  const { profile: currentUserProfile } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [view, setView] = useState<"board" | "list" | "analysis">("board");

  // Lead analysis statistics computation
  const stageData = useMemo(() => {
    const counts: Record<string, number> = {
      new: 0, contacted: 0, qualified: 0, proposal: 0, negotiation: 0, won: 0, lost: 0
    };
    leads.forEach((l) => {
      const currentStage = (l.stage || "new").toLowerCase().trim();
      const normalizedStage = LEAD_STAGES.includes(currentStage) ? currentStage : "new";
      if (normalizedStage in counts) counts[normalizedStage]++;
    });
    
    return [
      { name: "New", value: counts.new, color: "#3B82F6" },
      { name: "Contacted", value: counts.contacted, color: "#8B5CF6" },
      { name: "Qualified", value: counts.qualified, color: "#06B6D4" },
      { name: "Proposal", value: counts.proposal, color: "#F59E0B" },
      { name: "Negotiation", value: counts.negotiation, color: "#F97316" },
      { name: "Won", value: counts.won, color: "#10B981" },
      { name: "Lost", value: counts.lost, color: "#EF4444" },
    ].filter(item => item.value > 0);
  }, [leads]);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      const src = l.source || "Unknown";
      counts[src] = (counts[src] || 0) + 1;
    });

    const colors = [
      CHART_COLORS.indigo, CHART_COLORS.emerald, CHART_COLORS.amber, 
      CHART_COLORS.rose, CHART_COLORS.cyan, CHART_COLORS.violet, CHART_COLORS.blue
    ];

    return Object.entries(counts).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length]
    }));
  }, [leads]);

  const stageValueData = useMemo(() => {
    const values: Record<string, number> = {
      new: 0, contacted: 0, qualified: 0, proposal: 0, negotiation: 0, won: 0, lost: 0
    };
    leads.forEach((l) => {
      const currentStage = (l.stage || "new").toLowerCase().trim();
      const normalizedStage = LEAD_STAGES.includes(currentStage) ? currentStage : "new";
      if (normalizedStage in values) {
        values[normalizedStage] += (l.value || 0);
      }
    });

    const stageLabels: Record<string, string> = { 
      new: "New", contacted: "Contacted", qualified: "Qualified", 
      proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost" 
    };

    return Object.entries(values).map(([stage, val]) => ({
      stage: stageLabels[stage] || stage,
      value: val
    }));
  }, [leads]);

  const analysisMetrics = useMemo(() => {
    const wonCount = leads.filter(l => (l.stage || "new").toLowerCase().trim() === "won").length;
    const lostCount = leads.filter(l => (l.stage || "new").toLowerCase().trim() === "lost").length;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
    
    const totalVal = leads.reduce((s, l) => s + (l.value || 0), 0);
    const avgVal = leads.length > 0 ? Math.round(totalVal / leads.length) : 0;

    return { winRate, avgVal, closedCount };
  }, [leads]);

  // Auto-normalize any invalid stages in the database on load
  React.useEffect(() => {
    if (loading || leads.length === 0) return;
    
    const invalidLeads = leads.filter(l => {
      const s = (l.stage || "").toLowerCase().trim();
      return !LEAD_STAGES.includes(s);
    });

    if (invalidLeads.length > 0) {
      const runNormalization = async () => {
        try {
          const batch = writeBatch(db);
          invalidLeads.forEach(l => {
            const docRef = firestoreDoc(db, "leads", l.id);
            batch.update(docRef, { 
              stage: "new",
              updatedAt: Timestamp.now()
            });
          });
          await batch.commit();
          toast.success(`Automatically normalized ${invalidLeads.length} leads with invalid stages.`);
          refresh();
        } catch (err) {
          console.error("Failed to auto-normalize lead stages:", err);
        }
      };
      runNormalization();
    }
  }, [leads, loading, refresh]);
  
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", source: "", stage: "new" as Lead["stage"], value: "", notes: "" });
  const [callForm, setCallForm] = useState({
    type: "call" as CallLog["type"],
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    direction: "outbound" as CallLog["direction"],
    status: "answered" as CallLog["status"],
    duration: "",
    notes: "",
    recordedBy: "admin"
  });

  const openAdd = () => { setEditing(null); setForm({ name: "", company: "", email: "", phone: "", source: "", stage: "new", value: "", notes: "" }); setShowModal(true); };
  
  const openLogCall = (lead: Lead) => {
    setCallForm({
      type: "call",
      contactName: lead.name,
      contactEmail: lead.email || "",
      contactPhone: lead.phone || "",
      direction: "outbound",
      status: "answered",
      duration: "",
      notes: "",
      recordedBy: "admin"
    });
    setShowCallModal(true);
  };

  const handleSaveCallLog = async () => {
    try {
      if (!canPerformAction(currentUserProfile?.role, "calls", "create", undefined, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }
      const data = {
        ...callForm,
        duration: callForm.duration ? parseInt(callForm.duration, 10) : undefined,
        date: new Date()
      };
      await addCallLog(data);
      toast.success("Call/Message logged successfully!");
      setShowCallModal(false);
    } catch {
      toast.error("Failed to log call/message");
    }
  };

  const openEdit = (l: Lead) => { 
    setEditing(l); 
    const currentStage = (l.stage || "new").toLowerCase().trim();
    const normalizedStage = LEAD_STAGES.includes(currentStage) ? (currentStage as Lead["stage"]) : "new";
    setForm({ 
      name: l.name, 
      company: l.company || "", 
      email: l.email, 
      phone: l.phone || "", 
      source: l.source, 
      stage: normalizedStage, 
      value: l.value?.toString() || "", 
      notes: l.notes || "" 
    }); 
    setShowModal(true); 
  };

  const handleSave = async () => {
    try {
      const action = editing ? "update" : "create";
      if (!canPerformAction(currentUserProfile?.role, "leads", action, editing || undefined, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }
      const data = { ...form, value: form.value ? parseFloat(form.value) : 0, updatedAt: Timestamp.now() };
      if (editing) { await update(editing.id, data); toast.success("Lead updated"); }
      else { await add(data); toast.success("Lead added"); }
      setShowModal(false);
      refresh();
    } catch { toast.error("Failed to save"); }
  };

  const moveStage = async (lead: Lead, newStage: string) => {
    try { 
      if (!canPerformAction(currentUserProfile?.role, "leads", "update", lead, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }
      await update(lead.id, { stage: newStage, updatedAt: Timestamp.now() }); 
      toast.success(`Moved to ${newStage}`); 
      refresh();
    }
    catch { toast.error("Failed to move"); }
  };

  const handleDelete = async (id: string) => {
    const target = leads.find((l) => l.id === id);
    if (!target || !canPerformAction(currentUserProfile?.role, "leads", "delete", target)) {
      toast.error("Unauthorized action");
      return;
    }
    if (!confirm("Delete this lead?")) return;
    try { 
      await remove(id); 
      toast.success("Lead deleted"); 
      refresh();
    } catch { toast.error("Failed to delete"); }
  };

  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    if (!canPerformAction(currentUserProfile?.role, "leads", "delete")) {
      toast.error("Unauthorized action");
      return;
    }
    if (leads.length === 0) {
      toast.error("There are no leads to clear.");
      return;
    }

    const confirmText = prompt(
      "Are you sure you want to delete ALL leads? This action cannot be undone. Type 'DELETE ALL' to confirm:"
    );
    if (confirmText !== "DELETE ALL") {
      if (confirmText !== null) {
        toast.error("Confirmation text did not match.");
      }
      return;
    }

    setClearing(true);
    const toastId = toast.loading("Deleting all leads in batches...");
    try {
      const batch = writeBatch(db);
      leads.forEach((lead) => {
        const docRef = firestoreDoc(db, "leads", lead.id);
        batch.delete(docRef);
      });
      await batch.commit();
      
      toast.success("All leads deleted successfully!", { id: toastId });
      refresh();
    } catch (err: any) {
      console.error("Error clearing leads in batch:", err);
      toast.error("Failed to delete all leads.", { id: toastId });
    } finally {
      setClearing(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" message="Loading leads..." />;

  const stageLabels: Record<string, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost" };
  const stageColors: Record<string, string> = { new: "border-t-blue-400", contacted: "border-t-violet-400", qualified: "border-t-cyan-400", proposal: "border-t-amber-400", negotiation: "border-t-orange-400", won: "border-t-emerald-400", lost: "border-t-red-400" };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setView("board")} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${view === "board" ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>Board</button>
          <button onClick={() => setView("list")} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${view === "list" ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>List</button>
          <button onClick={() => setView("analysis")} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${view === "analysis" ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>Analysis</button>
        </div>
        <div className="flex items-center gap-3">
          {leads.length > 0 && canPerformAction(currentUserProfile?.role, "leads", "delete") && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="px-3.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Clear All Leads
            </button>
          )}
          {canPerformAction(currentUserProfile?.role, "leads", "create") && (
            <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Lead</button>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-slate-800">{leads.length}</p><p className="text-xs text-slate-500">Total Leads</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{leads.filter((l) => (l.stage || "new").toLowerCase().trim() === "won").length}</p><p className="text-xs text-slate-500">Won</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-amber-600">{leads.filter((l) => !["won", "lost"].includes((l.stage || "new").toLowerCase().trim())).length}</p><p className="text-xs text-slate-500">In Progress</p></div>
      </div>

      {view === "analysis" && (
        <div className="space-y-6">
          {/* Analysis KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Conversion Win Rate</p>
                <h4 className="text-2xl font-bold text-emerald-600 mt-1">{analysisMetrics.winRate}%</h4>
                <p className="text-xs text-slate-400 mt-1">Based on {analysisMetrics.closedCount} closed deals</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-semibold">
                Win
              </div>
            </div>
            
            <div className="card p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Average Lead Value</p>
                <h4 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(analysisMetrics.avgVal)}</h4>
                <p className="text-xs text-slate-400 mt-1">Across all active & closed leads</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 font-semibold">
                Val
              </div>
            </div>

            <div className="card p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Pipeline Value</p>
                <h4 className="text-2xl font-bold text-primary-600 mt-1">
                  {formatCurrency(leads.reduce((s, l) => s + (l.value || 0), 0))}
                </h4>
                <p className="text-xs text-slate-400 mt-1">Total value of all prospective leads</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-semibold">
                Sum
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stage Distribution Chart */}
            <div className="card p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Stage Distribution</h3>
                {stageData.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-sm text-slate-400">No leads data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={stageData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3} isAnimationActive={false}>
                        {stageData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 max-h-36 overflow-y-auto">
                {stageData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 truncate">{item.name}: <strong>{item.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Value by Stage Chart */}
            <div className="lg:col-span-2 card p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Pipeline Value by Stage</h3>
              {leads.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-slate-400">No value data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stageValueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}K`} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatCurrency(value), "Pipeline Value"]} />
                    <Bar dataKey="value" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lead Sources Pie */}
            <div className="card p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Leads by Referral Source</h3>
                {sourceData.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-sm text-slate-400">No source data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3} isAnimationActive={false}>
                        {sourceData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 max-h-36 overflow-y-auto">
                {sourceData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 truncate">{item.name}: <strong>{item.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Conversion stages summary list */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Pipeline Funnel Health</h3>
              <div className="space-y-4">
                {[
                  { label: "New Prospects", count: leads.filter(l => {
                      const s = (l.stage || "new").toLowerCase().trim();
                      const norm = LEAD_STAGES.includes(s) ? s : "new";
                      return norm === "new";
                    }).length, percentage: leads.length > 0 ? Math.round((leads.filter(l => {
                      const s = (l.stage || "new").toLowerCase().trim();
                      const norm = LEAD_STAGES.includes(s) ? s : "new";
                      return norm === "new";
                    }).length / leads.length) * 100) : 0, color: "bg-blue-500" },
                  { label: "Contacted / Qualified", count: leads.filter(l => {
                      const s = (l.stage || "new").toLowerCase().trim();
                      const norm = LEAD_STAGES.includes(s) ? s : "new";
                      return ["contacted", "qualified"].includes(norm);
                    }).length, percentage: leads.length > 0 ? Math.round((leads.filter(l => {
                      const s = (l.stage || "new").toLowerCase().trim();
                      const norm = LEAD_STAGES.includes(s) ? s : "new";
                      return ["contacted", "qualified"].includes(norm);
                    }).length / leads.length) * 100) : 0, color: "bg-violet-500" },
                  { label: "In Negotiation / Proposal", count: leads.filter(l => {
                      const s = (l.stage || "new").toLowerCase().trim();
                      const norm = LEAD_STAGES.includes(s) ? s : "new";
                      return ["proposal", "negotiation"].includes(norm);
                    }).length, percentage: leads.length > 0 ? Math.round((leads.filter(l => {
                      const s = (l.stage || "new").toLowerCase().trim();
                      const norm = LEAD_STAGES.includes(s) ? s : "new";
                      return ["proposal", "negotiation"].includes(norm);
                    }).length / leads.length) * 100) : 0, color: "bg-amber-500" },
                  { label: "Closed Won", count: leads.filter(l => {
                      const s = (l.stage || "new").toLowerCase().trim();
                      const norm = LEAD_STAGES.includes(s) ? s : "new";
                      return norm === "won";
                    }).length, percentage: leads.length > 0 ? Math.round((leads.filter(l => {
                      const s = (l.stage || "new").toLowerCase().trim();
                      const norm = LEAD_STAGES.includes(s) ? s : "new";
                      return norm === "won";
                    }).length / leads.length) * 100) : 0, color: "bg-emerald-500" },
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">{item.label} (<strong>{item.count}</strong>)</span>
                      <span className="text-slate-500">{item.percentage}% of total</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {LEAD_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => {
              const currentStage = (l.stage || "new").toLowerCase().trim();
              const normalizedStage = LEAD_STAGES.includes(currentStage) ? currentStage : "new";
              return normalizedStage === stage;
            });
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
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {canPerformAction(currentUserProfile?.role, "calls", "create") && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openLogCall(lead); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                              title="Log Call/Message"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canPerformAction(currentUserProfile?.role, "leads", "delete", lead) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(lead.id); }}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-slate-50 transition-colors"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {lead.value && <div className="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-600"><DollarSign className="w-3 h-3" />{formatCurrency(lead.value)}</div>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-slate-400">{lead.source}</span>
                        <span className="text-[11px] text-slate-400">{timeAgo(lead.updatedAt as Date)}</span>
                      </div>
                      {stage !== "won" && stage !== "lost" && canPerformAction(currentUserProfile?.role, "leads", "update", lead, currentUserProfile?.id) && (
                        <button onClick={(e) => { e.stopPropagation(); const idx = LEAD_STAGES.indexOf(stage); if (idx < LEAD_STAGES.length - 2) moveStage(lead, LEAD_STAGES[idx + 1]); }}
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
                <div className="flex items-center gap-1">
                  {canPerformAction(currentUserProfile?.role, "calls", "create") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openLogCall(l); }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Log Call/Message"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canPerformAction(currentUserProfile?.role, "leads", "delete", l) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete Lead"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Lead" : "Add Lead"}
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>{canPerformAction(currentUserProfile?.role, "leads", editing ? "update" : "create", editing || undefined, currentUserProfile?.id) && <button onClick={handleSave} className="btn-primary">Save</button>}</>}>
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
            <div><label className="label">Stage</label><select className="input-field" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Lead["stage"] })}>{LEAD_STAGES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></div>
            <div><label className="label">Value (₹)</label><input className="input-field" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input-field" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Modal>

      {/* Quick Call Logging Modal */}
      <Modal isOpen={showCallModal} onClose={() => setShowCallModal(false)} title="Log Call/Message for Lead"
        footer={<><button onClick={() => setShowCallModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSaveCallLog} className="btn-primary">Save Log</button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select className="input-field" value={callForm.type} onChange={(e) => setCallForm({ ...callForm, type: e.target.value as CallLog["type"] })}>
                <option value="call">Call</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>
            <div>
              <label className="label">Direction</label>
              <select className="input-field" value={callForm.direction} onChange={(e) => setCallForm({ ...callForm, direction: e.target.value as CallLog["direction"] })}>
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Contact Name</label><input className="input-field" value={callForm.contactName} onChange={(e) => setCallForm({ ...callForm, contactName: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input-field" value={callForm.contactPhone} onChange={(e) => setCallForm({ ...callForm, contactPhone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={callForm.status} onChange={(e) => setCallForm({ ...callForm, status: e.target.value as CallLog["status"] })}>
                <option value="answered">Answered</option>
                <option value="missed">Missed</option>
                <option value="voicemail">Voicemail</option>
                <option value="sent">Sent</option>
              </select>
            </div>
            <div><label className="label">Duration (sec)</label><input className="input-field" type="number" value={callForm.duration} onChange={(e) => setCallForm({ ...callForm, duration: e.target.value })} /></div>
            <div><label className="label">Recorded By</label><input className="input-field" value={callForm.recordedBy} onChange={(e) => setCallForm({ ...callForm, recordedBy: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input-field" rows={3} value={callForm.notes} onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}
