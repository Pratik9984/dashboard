"use client";
import React from "react";
import {
  FolderKanban, Users, Building2, MessageSquare, CalendarDays,
  CheckSquare, GitBranch, TrendingUp, DollarSign, Clock, Target, Zap,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import StatsCard from "@/app/components/StatsCard";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { useDashboardStats } from "@/app/lib/useFirestore";
import { REVENUE_DATA, TRAFFIC_DATA, CHART_COLORS, formatCurrency } from "@/app/lib/data";

export default function DashboardPage() {
  const { stats, loading } = useDashboardStats();

  if (loading) return <LoadingSpinner size="lg" message="Loading dashboard..." />;

  const kpis = [
    { label: "Total Projects", value: stats.totalProjects, icon: <FolderKanban className="w-5 h-5" />, color: "primary", trend: { value: 12, label: "this month" } },
    { label: "Active Projects", value: stats.activeProjects, icon: <Zap className="w-5 h-5" />, color: "amber", trend: { value: 8, label: "vs last month" } },
    { label: "Completed", value: stats.completedProjects, icon: <CheckSquare className="w-5 h-5" />, color: "emerald" },
    { label: "Total Clients", value: stats.totalClients, icon: <Building2 className="w-5 h-5" />, color: "blue", trend: { value: 5, label: "this quarter" } },
    { label: "Team Members", value: stats.teamMembers, icon: <Users className="w-5 h-5" />, color: "violet" },
    { label: "Total Leads", value: stats.pipelineLeads, icon: <GitBranch className="w-5 h-5" />, color: "cyan", trend: { value: 15, label: "new" } },
    { label: "Pending Responses", value: stats.pendingResponses, icon: <MessageSquare className="w-5 h-5" />, color: "rose" },
    { label: "Upcoming Meetings", value: stats.upcomingMeetings, icon: <CalendarDays className="w-5 h-5" />, color: "amber" },
    { label: "Tasks Done", value: stats.tasksCompleted, icon: <Target className="w-5 h-5" />, color: "emerald" },
    { label: "Tasks Pending", value: stats.tasksPending, icon: <Clock className="w-5 h-5" />, color: "slate" },
    { label: "New Leads", value: stats.newLeads, icon: <TrendingUp className="w-5 h-5" />, color: "blue" },
    { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), icon: <DollarSign className="w-5 h-5" />, color: "emerald", trend: { value: 22, label: "growth" } },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <StatsCard key={i} {...kpi} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 card p-6">
          <h3 className="section-title mb-4">Revenue Overview</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={REVENUE_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}K`} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: "13px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                formatter={(value: number) => [formatCurrency(value), "Revenue"]}
              />
              <Bar dataKey="revenue" fill={CHART_COLORS.indigo} radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Traffic Sources */}
        <div className="card p-6">
          <h3 className="section-title mb-4">Traffic Sources</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={TRAFFIC_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4} isAnimationActive={false}>
                {TRAFFIC_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: "13px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {TRAFFIC_DATA.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-medium text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects & Tasks Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Progress */}
        <div className="card p-6">
          <h3 className="section-title mb-4">Project Completion Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={REVENUE_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: "13px" }} />
              <Legend />
              <Line type="monotone" dataKey="projects" stroke={CHART_COLORS.indigo} strokeWidth={2.5} dot={{ fill: CHART_COLORS.indigo, r: 4 }} name="Projects" isAnimationActive={false} />
              <Line type="monotone" dataKey="clients" stroke={CHART_COLORS.emerald} strokeWidth={2.5} dot={{ fill: CHART_COLORS.emerald, r: 4 }} name="Clients" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Stats */}
        <div className="card p-6">
          <h3 className="section-title mb-4">Quick Overview</h3>
          <div className="space-y-4">
            {[
              { label: "Task Completion Rate", value: stats.tasksCompleted + stats.tasksPending > 0 ? Math.round((stats.tasksCompleted / (stats.tasksCompleted + stats.tasksPending)) * 100) : 0, color: "bg-primary-600" },
              { label: "Project Completion", value: stats.totalProjects > 0 ? Math.round((stats.completedProjects / stats.totalProjects) * 100) : 0, color: "bg-emerald-500" },
              { label: "Lead Conversion", value: stats.pipelineLeads > 0 ? Math.round(((stats.pipelineLeads - stats.newLeads) / stats.pipelineLeads) * 100) : 0, color: "bg-violet-500" },
              { label: "Response Rate", value: stats.totalResponses > 0 ? Math.round((stats.repliedResponses / stats.totalResponses) * 100) : 0, color: "bg-amber-500" },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className="text-sm font-semibold text-slate-800">{item.value}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
