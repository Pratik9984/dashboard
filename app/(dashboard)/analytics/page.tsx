"use client";
import React, { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, DollarSign, FolderKanban, Users } from "lucide-react";
import StatsCard from "@/app/components/StatsCard";
import { REVENUE_DATA, TRAFFIC_DATA, CHART_COLORS, formatCurrency } from "@/app/lib/data";

const QUARTERLY = [
  { quarter: "Q1", revenue: 300000, expenses: 180000, profit: 120000 },
  { quarter: "Q2", revenue: 495000, expenses: 250000, profit: 245000 },
  { quarter: "Q3", revenue: 615000, expenses: 320000, profit: 295000 },
  { quarter: "Q4", revenue: 815000, expenses: 380000, profit: 435000 },
];

const PROJECT_STATUS = [
  { name: "Completed", value: 35, color: "#10B981" },
  { name: "In Progress", value: 28, color: "#6366F1" },
  { name: "Planning", value: 15, color: "#F59E0B" },
  { name: "On Hold", value: 8, color: "#EF4444" },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("year");
  const totalRevenue = REVENUE_DATA.reduce((s, d) => s + d.revenue, 0);
  const avgRevenue = Math.round(totalRevenue / 12);

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
        <StatsCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<DollarSign className="w-5 h-5" />} color="emerald" trend={{ value: 22, label: "YoY" }} />
        <StatsCard label="Avg Monthly" value={formatCurrency(avgRevenue)} icon={<TrendingUp className="w-5 h-5" />} color="primary" trend={{ value: 8, label: "growth" }} />
        <StatsCard label="Projects Delivered" value="86" icon={<FolderKanban className="w-5 h-5" />} color="violet" />
        <StatsCard label="Active Clients" value="34" icon={<Users className="w-5 h-5" />} color="blue" trend={{ value: 12, label: "new" }} />
      </div>

      {/* Revenue Trend + Traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <h3 className="section-title mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={REVENUE_DATA}>
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
              <Pie data={TRAFFIC_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={4} isAnimationActive={false}>
                {TRAFFIC_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {TRAFFIC_DATA.map((item) => (
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
            <BarChart data={QUARTERLY}>
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
              <Pie data={PROJECT_STATUS} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} isAnimationActive={false}>
                {PROJECT_STATUS.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {PROJECT_STATUS.map((item) => (
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
