export const CHART_COLORS = {
  indigo: "#6366F1", violet: "#8B5CF6", blue: "#3B82F6",
  cyan: "#06B6D4", emerald: "#10B981", amber: "#F59E0B",
  rose: "#F43F5E", slate: "#64748B",
};

export const REVENUE_DATA = [
  { month: "Jan", revenue: 85000, projects: 3, clients: 2 },
  { month: "Feb", revenue: 120000, projects: 4, clients: 3 },
  { month: "Mar", revenue: 95000, projects: 3, clients: 2 },
  { month: "Apr", revenue: 165000, projects: 6, clients: 4 },
  { month: "May", revenue: 140000, projects: 5, clients: 3 },
  { month: "Jun", revenue: 190000, projects: 7, clients: 5 },
  { month: "Jul", revenue: 210000, projects: 8, clients: 5 },
  { month: "Aug", revenue: 175000, projects: 6, clients: 4 },
  { month: "Sep", revenue: 230000, projects: 9, clients: 6 },
  { month: "Oct", revenue: 260000, projects: 10, clients: 7 },
  { month: "Nov", revenue: 245000, projects: 9, clients: 6 },
  { month: "Dec", revenue: 310000, projects: 12, clients: 8 },
];

export const TRAFFIC_DATA = [
  { name: "Organic Search", value: 42, color: "#6366F1" },
  { name: "Direct", value: 28, color: "#8B5CF6" },
  { name: "Social Media", value: 18, color: "#06B6D4" },
  { name: "Referral", value: 8, color: "#10B981" },
  { name: "Email", value: 4, color: "#F59E0B" },
];

export const PIPELINE_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];

export const SAMPLE_INSIGHTS = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
  visitors: Math.floor(Math.random() * 400 + 100),
  pageViews: Math.floor(Math.random() * 1200 + 300),
  sessions: Math.floor(Math.random() * 600 + 150),
  bounceRate: +(Math.random() * 30 + 30).toFixed(1),
  avgSessionDuration: Math.floor(Math.random() * 180 + 60),
  conversions: Math.floor(Math.random() * 20 + 2),
})).reverse();

export function formatCurrency(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(date: Date | { seconds: number } | string | null | undefined): string {
  if (!date) return "—";
  const d = date instanceof Date ? date
    : typeof date === "object" && "seconds" in date ? new Date((date as { seconds: number }).seconds * 1000)
    : new Date(date as string);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function timeAgo(date: Date | { seconds: number } | string | null | undefined): string {
  if (!date) return "—";
  const d = date instanceof Date ? date
    : typeof date === "object" && "seconds" in date ? new Date((date as { seconds: number }).seconds * 1000)
    : new Date(date as string);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-50 text-slate-500 border-slate-200",
  prospect: "bg-blue-50 text-blue-700 border-blue-200",
  churned: "bg-red-50 text-red-600 border-red-200",
  planning: "bg-slate-50 text-slate-600 border-slate-200",
  in_progress: "bg-indigo-50 text-indigo-700 border-indigo-200",
  review: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  on_hold: "bg-orange-50 text-orange-600 border-orange-200",
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-violet-50 text-violet-700 border-violet-200",
  qualified: "bg-cyan-50 text-cyan-700 border-cyan-200",
  proposal: "bg-amber-50 text-amber-700 border-amber-200",
  negotiation: "bg-orange-50 text-orange-600 border-orange-200",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-red-50 text-red-600 border-red-200",
  todo: "bg-slate-50 text-slate-600 border-slate-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  low: "bg-slate-50 text-slate-500 border-slate-200",
  medium: "bg-blue-50 text-blue-600 border-blue-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  urgent: "bg-red-50 text-red-600 border-red-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  rescheduled: "bg-amber-50 text-amber-700 border-amber-200",
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  received: "bg-blue-50 text-blue-700 border-blue-200",
  draft: "bg-slate-50 text-slate-500 border-slate-200",
  read: "bg-slate-50 text-slate-500 border-slate-200",
  replied: "bg-emerald-50 text-emerald-700 border-emerald-200",
  archived: "bg-slate-50 text-slate-400 border-slate-200",
  processed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  answered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  missed: "bg-red-50 text-red-600 border-red-200",
  voicemail: "bg-amber-50 text-amber-700 border-amber-200",
  internal: "bg-slate-50 text-slate-600 border-slate-200",
  client: "bg-indigo-50 text-indigo-700 border-indigo-200",
  discovery: "bg-violet-50 text-violet-700 border-violet-200",
  demo: "bg-cyan-50 text-cyan-700 border-cyan-200",
};
