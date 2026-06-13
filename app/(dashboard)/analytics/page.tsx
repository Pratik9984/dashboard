"use client";
import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, DollarSign, FolderKanban, Users } from "lucide-react";
import StatsCard from "@/app/components/StatsCard";
import { CHART_COLORS, formatCurrency } from "@/app/lib/data";
import { useCollection } from "@/app/lib/useFirestore";
import { Client, Project, Response } from "@/app/types";
import LoadingSpinner from "@/app/components/LoadingSpinner";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("year");

  // Fetch real data from Firestore collections
  const { data: clients, loading: loadingClients } = useCollection<Client>("clients");
  const { data: projects, loading: loadingProjects } = useCollection<Project>("projects");
  const { data: responses, loading: loadingResponses } = useCollection<Response>("responses");

  // Calculate KPIs dynamically
  const totalRevenue = useMemo(() => {
    return clients.reduce((sum, c) => sum + (c.totalValue || 0), 0);
  }, [clients]);

  const avgRevenue = useMemo(() => {
    return clients.length > 0 ? Math.round(totalRevenue / 12) : 0;
  }, [clients, totalRevenue]);

  const projectsDelivered = useMemo(() => {
    return projects.filter((p) => p.status === "completed").length;
  }, [projects]);

  const activeClients = useMemo(() => {
    return clients.filter((c) => c.status === "active").length;
  }, [clients]);

  // Compute monthly revenue trend (REVENUE_DATA)
  const revenueData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData = months.map((m) => ({ month: m, revenue: 0, projects: 0, clients: 0 }));

    clients.forEach((c) => {
      if (!c.createdAt) return;
      const date = c.createdAt instanceof Date ? c.createdAt 
                 : (typeof c.createdAt === "object" && "seconds" in c.createdAt) ? new Date(c.createdAt.seconds * 1000)
                 : new Date(c.createdAt as string);
      const mIdx = date.getMonth();
      if (mIdx >= 0 && mIdx < 12) {
        monthlyData[mIdx].revenue += (c.totalValue || 0);
        monthlyData[mIdx].clients += 1;
      }
    });

    projects.forEach((p) => {
      if (!p.startDate) return;
      const date = p.startDate instanceof Date ? p.startDate
                 : (typeof p.startDate === "object" && "seconds" in p.startDate) ? new Date(p.startDate.seconds * 1000)
                 : new Date(p.startDate as string);
      const mIdx = date.getMonth();
      if (mIdx >= 0 && mIdx < 12) {
        monthlyData[mIdx].projects += 1;
      }
    });

    return monthlyData;
  }, [clients, projects]);

  // Compute traffic distribution from contact form responses (TRAFFIC_DATA)
  const trafficData = useMemo(() => {
    const sourceCounts: Record<string, number> = {
      "Organic Search": 0,
      "Direct": 0,
      "Social Media": 0,
      "Referral": 0,
      "Email": 0
    };

    responses.forEach((r) => {
      if (r.source === "website") sourceCounts["Organic Search"]++;
      else if (r.source === "direct") sourceCounts["Direct"]++;
      else if (r.source === "social") sourceCounts["Social Media"]++;
      else if (r.source === "referral") sourceCounts["Referral"]++;
      else if (r.source === "email" || r.source === "web3-form") sourceCounts["Email"]++;
    });

    const total = responses.length;
    if (total === 0) {
      return [
        { name: "Organic Search", value: 0, color: "#6366F1" },
        { name: "Direct", value: 0, color: "#8B5CF6" },
        { name: "Social Media", value: 0, color: "#06B6D4" },
        { name: "Referral", value: 0, color: "#10B981" },
        { name: "Email", value: 0, color: "#F59E0B" }
      ];
    }

    return [
      { name: "Organic Search", value: Math.round((sourceCounts["Organic Search"] / total) * 100), color: "#6366F1" },
      { name: "Direct", value: Math.round((sourceCounts["Direct"] / total) * 100), color: "#8B5CF6" },
      { name: "Social Media", value: Math.round((sourceCounts["Social Media"] / total) * 100), color: "#06B6D4" },
      { name: "Referral", value: Math.round((sourceCounts["Referral"] / total) * 100), color: "#10B981" },
      { name: "Email", value: Math.round((sourceCounts["Email"] / total) * 100), color: "#F59E0B" }
    ];
  }, [responses]);

  // Compute quarterly revenue vs expenses (QUARTERLY)
  const quarterlyData = useMemo(() => {
    const quarters = [
      { quarter: "Q1", revenue: 0, expenses: 0, profit: 0 },
      { quarter: "Q2", revenue: 0, expenses: 0, profit: 0 },
      { quarter: "Q3", revenue: 0, expenses: 0, profit: 0 },
      { quarter: "Q4", revenue: 0, expenses: 0, profit: 0 }
    ];

    clients.forEach((c) => {
      if (!c.createdAt) return;
      const date = c.createdAt instanceof Date ? c.createdAt 
                 : (typeof c.createdAt === "object" && "seconds" in c.createdAt) ? new Date(c.createdAt.seconds * 1000)
                 : new Date(c.createdAt as string);
      const m = date.getMonth();
      const qIdx = Math.floor(m / 3);
      if (qIdx >= 0 && qIdx < 4) {
        quarters[qIdx].revenue += (c.totalValue || 0);
      }
    });

    // Estimate expenses as 55% of revenue, profit as 45% of revenue
    quarters.forEach((q) => {
      q.expenses = Math.round(q.revenue * 0.55);
      q.profit = q.revenue - q.expenses;
    });

    return quarters;
  }, [clients]);

  // Compute Project Status Distribution (PROJECT_STATUS)
  const projectStatusData = useMemo(() => {
    const counts = {
      completed: 0,
      in_progress: 0,
      planning: 0,
      on_hold: 0
    };

    projects.forEach((p) => {
      if (p.status in counts) {
        counts[p.status as keyof typeof counts]++;
      }
    });

    return [
      { name: "Completed", value: counts.completed, color: "#10B981" },
      { name: "In Progress", value: counts.in_progress, color: "#6366F1" },
      { name: "Planning", value: counts.planning, color: "#F59E0B" },
      { name: "On Hold", value: counts.on_hold, color: "#EF4444" }
    ];
  }, [projects]);

  const loading = loadingClients || loadingProjects || loadingResponses;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <LoadingSpinner size="lg" message="Loading analytics dashboards..." />
      </div>
    );
  }

  const isDataEmpty = totalRevenue === 0 && projects.length === 0 && responses.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Time Range */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Performance metrics for your agency</p>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {["month", "quarter", "year"].map((t) => (
            <button key={t} onClick={() => setTimeRange(t)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${timeRange === t ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<DollarSign className="w-5 h-5" />} color="emerald" />
        <StatsCard label="Avg Monthly" value={formatCurrency(avgRevenue)} icon={<TrendingUp className="w-5 h-5" />} color="primary" />
        <StatsCard label="Projects Delivered" value={projectsDelivered} icon={<FolderKanban className="w-5 h-5" />} color="violet" />
        <StatsCard label="Active Clients" value={activeClients} icon={<Users className="w-5 h-5" />} color="blue" />
      </div>

      {/* Revenue Trend + Traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <h3 className="section-title mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.indigo} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={CHART_COLORS.indigo} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${v / 1000}K`} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: "13px" }} formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.indigo} strokeWidth={2.5} fill="url(#revenueGrad)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="section-title mb-4">Traffic Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={trafficData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={4} isAnimationActive={false}>
                {trafficData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {trafficData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-slate-600">{item.name}</span></div>
                <span className="font-medium text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quarterly + Project Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="section-title mb-4">Quarterly Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={quarterlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${v / 1000}K`} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px" }} formatter={(value: number) => [formatCurrency(value)]} />
              <Legend />
              <Bar dataKey="revenue" fill={CHART_COLORS.indigo} radius={[6, 6, 0, 0]} name="Revenue" isAnimationActive={false} />
              <Bar dataKey="expenses" fill={CHART_COLORS.rose} radius={[6, 6, 0, 0]} name="Expenses" isAnimationActive={false} />
              <Bar dataKey="profit" fill={CHART_COLORS.emerald} radius={[6, 6, 0, 0]} name="Profit" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="section-title mb-4">Project Status Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={projectStatusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} isAnimationActive={false}>
                {projectStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {projectStatusData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600">{item.name}: <strong>{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
