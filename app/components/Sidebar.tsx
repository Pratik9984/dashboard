"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, Building2,
  GitBranch, MessageSquare, Phone, CalendarDays, ClipboardCheck,
  BarChart3, Sheet, Mail, Globe, TrendingUp, ChevronLeft,
  ChevronRight, LogOut, Layers,
} from "lucide-react";
import { useAuth } from "@/app/lib/AuthContext";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Team", href: "/team", icon: Users },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Pipeline", href: "/pipeline", icon: GitBranch },
  { label: "Responses", href: "/responses", icon: MessageSquare },
  { label: "Calls", href: "/calls", icon: Phone },
  { label: "Meetings", href: "/meetings", icon: CalendarDays },
  { label: "Audit", href: "/audit", icon: ClipboardCheck },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Sheets", href: "/sheets", icon: Sheet },
  { label: "Emails", href: "/emails", icon: Mail },
  { label: "Web3 Forms", href: "/web3-forms", icon: Globe },
  { label: "Insights", href: "/insights", icon: TrendingUp },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { logOut, profile } = useAuth();

  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-white border-r border-slate-200 z-30 flex flex-col transition-sidebar ${
        collapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-100">
        <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
          <Layers className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-base font-bold text-slate-900 leading-tight">Stack & Scale</h1>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Admin Panel</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2.5 overflow-y-auto space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon
                className={`w-[18px] h-[18px] flex-shrink-0 ${
                  isActive ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600"
                }`}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 p-2.5 space-y-1">
        {!collapsed && profile && (
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-slate-800 truncate">{profile.name}</p>
            <p className="text-xs text-slate-400 truncate">{profile.role}</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-[18px] h-[18px]" />
          ) : (
            <>
              <ChevronLeft className="w-[18px] h-[18px]" />
              <span>Collapse</span>
            </>
          )}
        </button>
        <button
          onClick={logOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
