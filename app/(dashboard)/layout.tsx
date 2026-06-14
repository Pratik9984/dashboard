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
  "/leads": { title: "Leads", subtitle: "Track your leads and deals" },
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
import { canAccessPage } from "@/app/lib/permissions";
import { ShieldAlert } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Pre-warm caches and hold active background query connections for all dashboard sections
  useCollection("projects");
  useCollection("clients");
  useCollection("responses");
  useCollection("meetings");
  useCollection("users");
  useCollection("leads");
  useCollection("tasks");
  useCollection("calls");
  useCollection("emails");
  useCollection("web3forms");
  useCollection("audits");
  useCollection("insights");

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
  const isAuthorized = canAccessPage(profile?.role, pathname);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={`transition-sidebar ${collapsed ? "ml-[72px]" : "ml-[260px]"}`}>
        <Header title={isAuthorized ? pageInfo.title : "Access Denied"} subtitle={isAuthorized ? pageInfo.subtitle : ""} />
        <main className="p-6">
          {isAuthorized ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center animate-fade-in bg-white rounded-xl border border-slate-100 shadow-sm max-w-2xl mx-auto my-8">
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 mb-5">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
              <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                Your role <span className="font-semibold text-slate-700 capitalize">({profile?.role || "member"})</span> does not have authorization to view the <span className="font-semibold text-slate-700">{pageInfo.title}</span> page. Please contact your system administrator if you believe this is a mistake.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="btn-primary"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
