"use client";
import React, { useState } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, Users, Eye, Clock, ArrowUpRight, Activity } from "lucide-react";
import StatsCard from "@/app/components/StatsCard";
import { SAMPLE_INSIGHTS, CHART_COLORS } from "@/app/lib/data";

export default function InsightsPage() {
  const [timeRange, setTimeRange] = useState("30d");
  const data = timeRange === "7d" ? SAMPLE_INSIGHTS.slice(-7) : timeRange === "14d" ? SAMPLE_INSIGHTS.slice(-14) : SAMPLE_INSIGHTS;

  const totalVisitors = data.reduce((s, d) => s + d.visitors, 0);
  const totalPageViews = data.reduce((s, d) => s + d.pageViews, 0);
  const avgBounceRate = (data.reduce((s, d) => s + d.bounceRate, 0) / data.length).toFixed(1);
  const avgSessionDuration = Math.round(data.reduce((s, d) => s + d.avgSessionDuration, 0) / data.length);
  const totalConversions = data.reduce((s, d) => s + (d.conversions || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Time Range */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Website traffic and engagement metrics</p>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {[{ label: "7D", value: "7d" }, { label: "14D", value: "14d" }, { label: "30D", value: "30d" }].map((t) => (
            <button key={t.value} onClick={() => setTimeRange(t.value)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${timeRange === t.value ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard label="Visitors" value={totalVisitors.toLocaleString()} icon={<Users className="w-5 h-5" />} color="primary" trend={{ value: 14, label: "growth" }} />
        <StatsCard label="Page Views" value={totalPageViews.toLocaleString()} icon={<Eye className="w-5 h-5" />} color="blue" trend={{ value: 8, label: "vs prior" }} />
        <StatsCard label="Bounce Rate" value={`${avgBounceRate}%`} icon={<ArrowUpRight className="w-5 h-5" />} color="amber" trend={{ value: -3, label: "improved" }} />
        <StatsCard label="Avg Session" value={`${Math.floor(avgSessionDuration / 60)}m ${avgSessionDuration % 60}s`} icon={<Clock className="w-5 h-5" />} color="violet" />
        <StatsCard label="Conversions" value={totalConversions} icon={<Activity className="w-5 h-5" />} color="emerald" trend={{ value: 22, label: "increase" }} />
      </div>

      {/* Visitors + Page Views */}
      <div className="card p-6">
        <h3 className="section-title mb-4">Visitors & Page Views</h3>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.indigo} stopOpacity={0.15} />
                <stop offset="95%" stopColor={CHART_COLORS.indigo} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.cyan} stopOpacity={0.15} />
                <stop offset="95%" stopColor={CHART_COLORS.cyan} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: "13px" }} />
            <Legend />
            <Area type="monotone" dataKey="visitors" stroke={CHART_COLORS.indigo} strokeWidth={2} fill="url(#visitorsGrad)" name="Visitors" />
            <Area type="monotone" dataKey="pageViews" stroke={CHART_COLORS.cyan} strokeWidth={2} fill="url(#pvGrad)" name="Page Views" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bounce Rate Trend */}
        <div className="card p-6">
          <h3 className="section-title mb-4">Bounce Rate Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px" }} formatter={(value: number) => [`${value}%`, "Bounce Rate"]} />
              <Line type="monotone" dataKey="bounceRate" stroke={CHART_COLORS.amber} strokeWidth={2.5} dot={{ fill: CHART_COLORS.amber, r: 3 }} name="Bounce Rate" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Conversions */}
        <div className="card p-6">
          <h3 className="section-title mb-4">Daily Conversions</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px" }} />
              <Bar dataKey="conversions" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} name="Conversions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Session Duration */}
      <div className="card p-6">
        <h3 className="section-title mb-4">Average Session Duration</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="sessionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.violet} stopOpacity={0.15} />
                <stop offset="95%" stopColor={CHART_COLORS.violet} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.floor(v / 60)}m`} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px" }} formatter={(value: number) => [`${Math.floor(value / 60)}m ${value % 60}s`, "Avg Duration"]} />
            <Area type="monotone" dataKey="avgSessionDuration" stroke={CHART_COLORS.violet} strokeWidth={2} fill="url(#sessionGrad)" name="Session Duration" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
