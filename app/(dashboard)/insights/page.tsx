"use client";
import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Eye, MousePointerClick, Percent, Award, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, RefreshCw, Search
} from "lucide-react";
import StatsCard from "@/app/components/StatsCard";
import { CHART_COLORS } from "@/app/lib/data";
import LoadingSpinner from "@/app/components/LoadingSpinner";

export default function InsightsPage() {
  const [timeRange, setTimeRange] = useState("30d");
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);

  // GSC State
  const [gscData, setGscData] = useState<{ traffic: any[]; queries: any[] } | null>(null);
  const [gscLoading, setGscLoading] = useState(true);
  const [gscError, setGscError] = useState<string | null>(null);

  // Fetch Google Search Console Data
  useEffect(() => {
    async function fetchGsc() {
      setGscLoading(true);
      try {
        const limitDays = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
        const res = await fetch(`/api/search-console?days=${limitDays}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "GSC API returned an error");
        }
        const data = await res.json();
        setGscData(data);
        setGscError(null);
      } catch (err: any) {
        console.warn("GSC Error:", err.message);
        setGscError(err.message);
        setGscData(null);
      } finally {
        setGscLoading(false);
      }
    }
    fetchGsc();
  }, [timeRange]);

  // GSC metrics calculations
  const gscChartData = useMemo(() => {
    if (!gscData || !gscData.traffic) return [];
    return [...gscData.traffic]
      .sort((a, b) => (a.keys?.[0] || "").localeCompare(b.keys?.[0] || ""))
      .map((row) => ({
        date: row.keys?.[0] || "",
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: +((row.ctr || 0) * 100).toFixed(2),
        position: +(row.position || 0).toFixed(1),
      }));
  }, [gscData]);

  const gscStats = useMemo(() => {
    if (gscChartData.length === 0) return { clicks: 0, impressions: 0, ctr: "0.00", position: "0.0" };
    const totalClicks = gscChartData.reduce((acc, row) => acc + row.clicks, 0);
    const totalImpressions = gscChartData.reduce((acc, row) => acc + row.impressions, 0);
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";
    const avgPosition = (gscChartData.reduce((acc, row) => acc + row.position, 0) / gscChartData.length).toFixed(1);

    return {
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: avgCtr,
      position: avgPosition,
    };
  }, [gscChartData]);

  const isGscActive = !!gscData;

  if (gscLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <LoadingSpinner size="lg" message="Retrieving Google Search Console insights..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* GSC Status Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            {isGscActive ? (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                GSC Connected
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-1 rounded-full text-xs font-semibold border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                GSC Offline
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-slate-700 leading-tight">
            {isGscActive
              ? "Viewing live Google Search Console metrics"
              : "Google Search Console integration is offline"}
          </span>
        </div>
        
        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowSetupInstructions(!showSetupInstructions)}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
          >
            Setup Guide
            {showSetupInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200">
            {[{ label: "7D", value: "7d" }, { label: "14D", value: "14d" }, { label: "30D", value: "30d" }].map((t) => (
              <button
                key={t.value}
                onClick={() => setTimeRange(t.value)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${timeRange === t.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                disabled={!isGscActive}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Setup Guide instructions dropdown (Toggleable when connected, always visible when disconnected below) */}
      {showSetupInstructions && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 text-sm text-slate-600 animate-slide-down">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary-500" />
            Google Search Console Setup Checklist
          </h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Ensure your domain is verified in Google Search Console.</li>
            <li>In Google Cloud Console, enable the <strong>Google Search Console API</strong>.</li>
            <li>Create a Service Account, download the <strong>JSON credentials</strong>, and grant full/owner permissions to the Service Account email in Search Console.</li>
            <li>Configure environment variables in your <code>.env.local</code> file (<code>GSC_CLIENT_EMAIL</code>, <code>GSC_PRIVATE_KEY</code>, <code>GSC_SITE_URL</code>).</li>
          </ol>
          <div className="pt-2 text-xs text-slate-500">
            Current Target Property: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-mono">sc-domain:stackandscale.in</code>
          </div>
        </div>
      )}

      {/* RENDER GOOGLE SEARCH CONSOLE UI */}
      {isGscActive && gscData ? (
        <div className="space-y-6">
          {/* GSC KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard label="Search Clicks" value={gscStats.clicks.toLocaleString()} icon={<MousePointerClick className="w-5 h-5" />} color="primary" />
            <StatsCard label="Total Impressions" value={gscStats.impressions.toLocaleString()} icon={<Eye className="w-5 h-5" />} color="blue" />
            <StatsCard label="Average CTR" value={`${gscStats.ctr}%`} icon={<Percent className="w-5 h-5" />} color="emerald" />
            <StatsCard label="Average Position" value={gscStats.position} icon={<Award className="w-5 h-5" />} color="amber" />
          </div>

          {/* Clicks & Impressions Trend Chart */}
          <div className="card p-4 sm:p-6">
            <h3 className="section-title mb-4">Search Clicks & Impressions</h3>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={gscChartData}>
                <defs>
                  <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.indigo} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={CHART_COLORS.indigo} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="impressionsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.cyan} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={CHART_COLORS.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: "13px" }} />
                <Legend />
                <Area type="monotone" dataKey="clicks" stroke={CHART_COLORS.indigo} strokeWidth={2} fill="url(#clicksGrad)" name="Clicks" />
                <Area type="monotone" dataKey="impressions" stroke={CHART_COLORS.cyan} strokeWidth={2} fill="url(#impressionsGrad)" name="Impressions" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Double Column for CTR and Avg Position */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CTR Chart */}
            <div className="card p-4 sm:p-6">
              <h3 className="section-title mb-4">Click-Through Rate (CTR) Trend</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={gscChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px" }} formatter={(value: number) => [`${value}%`, "CTR"]} />
                  <Line type="monotone" dataKey="ctr" stroke={CHART_COLORS.emerald} strokeWidth={2.5} dot={{ fill: CHART_COLORS.emerald, r: 3 }} name="CTR" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Average Position Chart */}
            <div className="card p-4 sm:p-6">
              <h3 className="section-title mb-4">Average Search Position (Lower is Better)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={gscChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} reversed={true} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px" }} formatter={(value: number) => [value, "Position"]} />
                  <Line type="monotone" dataKey="position" stroke={CHART_COLORS.amber} strokeWidth={2.5} dot={{ fill: CHART_COLORS.amber, r: 3 }} name="Avg Position" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Search Queries Table */}
          {gscData.queries && gscData.queries.length > 0 && (
            <div className="card p-4 sm:p-6">
              <h3 className="section-title mb-4 flex items-center gap-2">
                <Search className="w-4.5 h-4.5 text-indigo-600" />
                Top Organic Search Queries
              </h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase bg-slate-50/50">
                      <th className="py-2.5 px-3 sm:px-4">Query Keyword</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">Clicks</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">Impressions</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">CTR</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">Avg Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {gscData.queries.map((q: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-3 sm:px-4 font-medium text-slate-800">{q.keys?.[0] || "—"}</td>
                        <td className="py-3 px-3 sm:px-4 text-right font-bold text-slate-900">{q.clicks || 0}</td>
                        <td className="py-3 px-3 sm:px-4 text-right text-slate-600">{(q.impressions || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 sm:px-4 text-right text-slate-600">{((q.ctr || 0) * 100).toFixed(2)}%</td>
                        <td className="py-3 px-3 sm:px-4 text-right font-medium text-slate-700">{+(q.position || 0).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* DISCONNECTED STATE: SETUP GUIDE INSTRUCTIONS */
        <div className="card p-6 md:p-8 bg-white border border-slate-200 shadow-sm rounded-xl space-y-6 max-w-4xl mx-auto">
          <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-slate-100">
            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Google Search Console Disconnected</h3>
            <p className="text-slate-500 max-w-md text-sm leading-relaxed">
              Connect your domain to unlock organic search performance insights, impressions, average click-through rates, and Google ranking keywords directly on this dashboard.
            </p>
          </div>

          {gscError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Diagnostic Error Message:</p>
                <p className="font-mono bg-white/60 p-2 rounded border border-rose-100/60 leading-normal select-all">
                  {gscError}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
              <RefreshCw className="w-4 h-4 text-indigo-500" />
              Required Setup Steps
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Step 1: GSC Permission</span>
                <p className="text-sm font-medium text-slate-800">Add Service Account Email to your GSC Property:</p>
                <div className="bg-white p-2 rounded-lg border border-slate-200 text-xs font-mono text-indigo-600 select-all break-all text-center select-all cursor-pointer">
                  gsc-reader@gen-lang-client-0386526691.iam.gserviceaccount.com
                </div>
                <p className="text-xs text-slate-500">
                  Go to <strong>Settings &gt; Users &amp; Permissions</strong> in Google Search Console, click "Add User", paste the email, and grant <strong>Full</strong> or <strong>Owner</strong> permissions.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Step 2: Configuration</span>
                <p className="text-sm font-medium text-slate-800">Ensure GSC variables are in <code>.env.local</code>:</p>
                <ul className="text-xs space-y-1 text-slate-600 font-mono">
                  <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />GSC_CLIENT_EMAIL</li>
                  <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />GSC_PRIVATE_KEY</li>
                  <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />GSC_SITE_URL</li>
                </ul>
                <p className="text-xs text-slate-500">
                  Current Target Property: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold">sc-domain:stackandscale.in</code>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-xs text-slate-500 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Note:</strong> Next.js does not hot-reload environment variables loaded from <code>.env.local</code>. If you recently added these keys, make sure to <strong>restart your local development server</strong> (<code>Ctrl+C</code> and run <code>npm run dev</code> again) for them to load correctly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
