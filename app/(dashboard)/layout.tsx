"use client";
import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/lib/AuthContext";
import Sidebar from "@/app/components/Sidebar";
import Header from "@/app/components/Header";
import LoadingSpinner from "@/app/components/LoadingSpinner";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Overview of your agency" },
  "/team": { title: "Team", subtitle: "Manage your team members" },
  "/projects": { title: "Projects", subtitle: "Track all your projects" },
  "/tasks": { title: "Tasks", subtitle: "Manage and assign tasks" },
  "/clients": { title: "Clients", subtitle: "Client relationship management" },
  "/pipeline": { title: "Pipeline", subtitle: "Track your leads and deals" },
  "/responses": { title: "Responses", subtitle: "Manage contact form responses" },
  "/calls": { title: "Calls & Messages", subtitle: "Communication log" },
  "/meetings": { title: "Meetings", subtitle: "Schedule and track meetings" },
  "/audit": { title: "Daily Audit", subtitle: "Track your daily work" },
  "/analytics": { title: "Analytics", subtitle: "Revenue and growth metrics" },
  "/sheets": { title: "Sheets", subtitle: "Data management and export" },
  "/emails": { title: "Emails", subtitle: "Email communication records" },
  "/web3-forms": { title: "Web3 Forms", subtitle: "Form submission responses" },
  "/insights": { title: "Insights", subtitle: "Website analytics and traffic" },
};

import { useCollection } from "@/app/lib/useFirestore";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Pre-warm caches and hold active background query connections for all dashboard sections
  useCollection("projects");
  useCollection("clients");
  useCollection("responses");
  useCollection("meetings");
  useCollection("users");
  useCollection("pipeline");
  useCollection("tasks");
  useCollection("calls");
  useCollection("emails");
  useCollection("web3forms");
  useCollection("audits");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading..." />
      </div>
    );
  }

  if (!user) return null;

  const pageInfo = PAGE_TITLES[pathname] || { title: "Admin", subtitle: "" };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={`transition-sidebar ${collapsed ? "ml-[72px]" : "ml-[260px]"}`}>
        <Header title={pageInfo.title} subtitle={pageInfo.subtitle} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
