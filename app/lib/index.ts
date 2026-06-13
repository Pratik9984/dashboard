import { Timestamp } from "firebase/firestore";

export type UserRole = "owner" | "admin" | "manager" | "member" | "viewer";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  position: string;
  phone?: string;
  avatar?: string;
  skills: string[];
  bio?: string;
  joinedAt: Timestamp | Date;
  isActive: boolean;
  lastSeen?: Timestamp | Date;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  clientId?: string;
  clientName: string;
  status: "planning" | "in_progress" | "review" | "completed" | "on_hold";
  priority: "low" | "medium" | "high" | "urgent";
  startDate: Timestamp | Date;
  dueDate: Timestamp | Date;
  completedDate?: Timestamp | Date;
  assignees: string[];
  budget?: number;
  tags: string[];
  progress: number;
  createdAt: Timestamp | Date;
  createdBy: string;
}

export interface Task {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description?: string;
  assignedTo: string;
  assigneeName: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: Timestamp | Date;
  completedAt?: Timestamp | Date;
  tags: string[];
  createdAt: Timestamp | Date;
  createdBy: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  website?: string;
  industry?: string;
  status: "active" | "inactive" | "prospect" | "churned";
  totalProjects: number;
  totalValue: number;
  notes?: string;
  createdAt: Timestamp | Date;
}

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  source: string;
  stage: "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
  value?: number;
  notes?: string;
  assignedTo?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Response {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  source: "website" | "email" | "social" | "referral" | "direct" | "web3-form";
  status: "new" | "read" | "replied" | "archived";
  priority: "low" | "medium" | "high";
  assignedTo?: string;
  formId?: string;
  createdAt: Timestamp | Date;
}

export interface CallLog {
  id: string;
  type: "call" | "sms" | "whatsapp" | "telegram";
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  direction: "inbound" | "outbound";
  status: "answered" | "missed" | "voicemail" | "sent";
  duration?: number;
  notes?: string;
  recordedBy: string;
  date: Timestamp | Date;
  followUpDate?: Timestamp | Date;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  attendees: string[];
  attendeeNames: string[];
  type: "internal" | "client" | "discovery" | "review" | "demo";
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  date: Timestamp | Date;
  duration: number;
  location?: string;
  meetingUrl?: string;
  notes?: string;
  actionItems?: string[];
  createdBy: string;
}

export interface AuditEntry {
  id: string;
  date: string;
  items: AuditItem[];
  summary?: string;
  mood?: "excellent" | "good" | "neutral" | "poor";
  completionRate: number;
  createdBy: string;
  createdAt: Timestamp | Date;
}

export interface AuditItem {
  id: string;
  category: string;
  description: string;
  completed: boolean;
  notes?: string;
  time?: string;
}

export interface EmailRecord {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: { name: string; url: string; size: number; type: string }[];
  status: "sent" | "received" | "draft" | "failed" | "trash";
  tags: string[];
  threadId?: string;
  date: Timestamp | Date;
  readAt?: Timestamp | Date;
  read: boolean;
  starred: boolean;
}

export interface Web3FormResponse {
  id: string;
  formId: string;
  formName: string;
  submitterEmail?: string;
  submitterName?: string;
  data: Record<string, string | number | boolean | string[]>;
  status: "new" | "read" | "processed" | "archived";
  submittedAt: Timestamp | Date;
  ipAddress?: string;
}

export interface SheetData {
  id: string;
  name: string;
  description?: string;
  type: "projects" | "clients" | "leads" | "responses" | "tasks" | "calls" | "custom";
  columns: string[];
  rows: Record<string, string | number | boolean>[];
  createdAt: Timestamp | Date;
  createdBy: string;
  updatedAt: Timestamp | Date;
}

export interface WebsiteInsight {
  date: string;
  visitors: number;
  pageViews: number;
  sessions: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversions?: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  link?: string;
  createdAt: Timestamp | Date;
  userId: string;
}
