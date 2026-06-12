import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: string;
}

export default function StatsCard({ label, value, icon, trend, color = "primary" }: StatsCardProps) {
  const colorMap: Record<string, { bg: string; icon: string }> = {
    primary: { bg: "bg-primary-50", icon: "text-primary-600" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600" },
    rose: { bg: "bg-rose-50", icon: "text-rose-600" },
    blue: { bg: "bg-blue-50", icon: "text-blue-600" },
    violet: { bg: "bg-violet-50", icon: "text-violet-600" },
    cyan: { bg: "bg-cyan-50", icon: "text-cyan-600" },
    slate: { bg: "bg-slate-50", icon: "text-slate-600" },
  };
  const c = colorMap[color] || colorMap.primary;

  return (
    <div className="card p-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value > 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : trend.value < 0 ? (
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span
                className={`text-xs font-medium ${
                  trend.value > 0 ? "text-emerald-600" : trend.value < 0 ? "text-red-600" : "text-slate-500"
                }`}
              >
                {trend.value > 0 ? "+" : ""}
                {trend.value}% {trend.label}
              </span>
            </div>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center`}>
          <div className={c.icon}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
