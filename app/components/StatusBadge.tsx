import React from "react";
import { STATUS_COLORS } from "@/app/lib/data";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || "bg-slate-50 text-slate-600 border-slate-200";
  const displayText = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`badge ${colorClass} ${className}`}>
      {displayText}
    </span>
  );
}
