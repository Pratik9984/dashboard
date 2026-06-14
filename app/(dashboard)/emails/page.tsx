"use client";
import React, { useState, useCallback, useMemo } from "react";
import {
  Plus,
  Trash2,
  Send,
  Inbox,
  FileText,
  AlertCircle,
  Tag,
  RefreshCw,
  Download,
  Star,
  Mail,
  MailOpen,
  Reply,
  ArrowLeft,
  Search,
  ChevronRight,
  FolderOpen,
  Paperclip,
  File,
  Music,
  Video,
  Eye,
  X,
  FileSpreadsheet
} from "lucide-react";
import { useCollection, useFirestore, orderBy } from "@/app/lib/useFirestore";
import { useAuth } from "@/app/lib/AuthContext";
import { EmailRecord } from "@/app/types";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import { formatDate, timeAgo } from "@/app/lib/data";
import toast from "react-hot-toast";

type EmailFolder = "inbox" | "sent" | "drafts" | "starred" | "trash";

export default function EmailsPage() {
  const { profile, user } = useAuth();
  const userEmail = profile?.email || ["hello", "stackandscale.in"].join("@");

  // Use collection hook with real-time updates and date ordering
  const { data: emails, loading } = useCollection<EmailRecord>("emails", [
    orderBy("date", "desc")
  ]);
  const { add, update, remove } = useFirestore("emails");

  const [activeFolder, setActiveFolder] = useState<EmailFolder>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<EmailRecord | null>(null);
  
  // Compose modal states
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    to: "",
    cc: "",
    subject: "",
    body: "",
    tags: ""
  });
  const [replyToId, setReplyToId] = useState<string | null>(null);

  // Attachments state during composition
  const [attachments, setAttachments] = useState<{ name: string; url: string; size: number; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  // File size formatter
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Upload handler for compose attachment selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const uploaded = [...attachments];
    
    try {
      const { ref: storageRef, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { getFirebaseStorage } = await import("@/app/lib/firebase");
      const storage = getFirebaseStorage();
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const fileRef = storageRef(storage, `emails/attachments/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(fileRef, file);
          const url = await getDownloadURL(snapshot.ref);
          
          uploaded.push({
            name: file.name,
            url: url,
            size: file.size,
            type: file.type
          });
        } catch (err) {
          console.error("Upload error:", err);
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      setAttachments(uploaded);
    } catch (importErr) {
      console.error("Firebase storage import error:", importErr);
      toast.error("Failed to initialize storage client");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Open empty compose
  const openCompose = () => {
    setForm({ to: "", cc: "", subject: "", body: "", tags: "" });
    setAttachments([]);
    setReplyToId(null);
    setShowModal(true);
  };

  // Reply configuration
  const handleReply = (email: EmailRecord) => {
    setForm({
      to: email.from,
      cc: "",
      subject: email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- On ${formatDate(email.date as Date)}, ${email.from} wrote: ---\n> ${email.body.split("\n").join("\n> ")}`,
      tags: ""
    });
    setAttachments([]);
    setReplyToId(email.id);
    setShowModal(true);
  };

  // Mark read/unread
  const handleToggleRead = async (e: React.MouseEvent, email: EmailRecord) => {
    e.stopPropagation();
    try {
      const nextRead = !email.read;
      await update(email.id, { read: nextRead });
      if (selected?.id === email.id) {
        setSelected((prev) => (prev ? { ...prev, read: nextRead } : null));
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Toggle starred status
  const handleToggleStar = async (e: React.MouseEvent, email: EmailRecord) => {
    e.stopPropagation();
    try {
      const nextStar = !email.starred;
      await update(email.id, { starred: nextStar });
      if (selected?.id === email.id) {
        setSelected((prev) => (prev ? { ...prev, starred: nextStar } : null));
      }
    } catch {
      toast.error("Failed to star email");
    }
  };

  // Move email to trash (soft-delete)
  const handleMoveToTrash = async (e: React.MouseEvent, email: EmailRecord) => {
    e.stopPropagation();
    try {
      await update(email.id, { status: "trash" });
      if (selected?.id === email.id) setSelected(null);
      toast.success("Moved to Trash");
    } catch {
      toast.error("Failed to move to trash");
    }
  };

  // Restore from trash
  const handleRestoreFromTrash = async (e: React.MouseEvent, email: EmailRecord) => {
    e.stopPropagation();
    try {
      const restoredStatus = email.from === userEmail ? "sent" : "received";
      await update(email.id, { status: restoredStatus });
      if (selected?.id === email.id) setSelected(null);
      toast.success("Restored email");
    } catch {
      toast.error("Failed to restore email");
    }
  };

  // Delete email permanently (hard-delete)
  const handlePermanentDelete = async (e: React.MouseEvent, email: EmailRecord) => {
    e.stopPropagation();
    if (!confirm("Delete this email permanently? This cannot be undone.")) return;
    try {
      await remove(email.id);
      if (selected?.id === email.id) setSelected(null);
      toast.success("Deleted permanently");
    } catch {
      toast.error("Failed to delete email");
    }
  };

  // Save drafts locally in Firestore
  const handleSaveDraft = async () => {
    if (!form.to.trim() && !form.subject.trim()) {
      toast.error("Please provide a recipient or subject to save a draft");
      return;
    }
    try {
      const recipients = form.to.split(",").map((e) => e.trim()).filter(Boolean);
      await add({
        from: userEmail,
        to: recipients,
        cc: form.cc ? form.cc.split(",").map((e) => e.trim()).filter(Boolean) : [],
        subject: form.subject || "(No subject)",
        body: form.body,
        status: "draft",
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        date: new Date(),
        read: true,
        starred: false
      });
      toast.success("Draft saved");
      setShowModal(false);
    } catch {
      toast.error("Failed to save draft");
    }
  };

  // Send email via API and then save to Firestore
  const handleSend = async () => {
    const recipients = form.to.split(",").map((e) => e.trim()).filter(Boolean);
    if (recipients.length === 0) {
      toast.error("Please add at least one recipient");
      return;
    }
    if (!form.subject.trim()) {
      toast.error("Please add a subject");
      return;
    }

    setSending(true);
    try {
      const endpoint = replyToId ? "/api/inbox/reply" : "/api/send";
      const payload: any = {
        to: recipients,
        cc: form.cc ? form.cc.split(",").map((e) => e.trim()).filter(Boolean) : [],
        subject: form.subject,
        body: form.body || "(No content)",
        html: `<div style="font-family: sans-serif; line-height: 1.5; color: #334155;">${form.body.replace(/\n/g, "<br>")}</div>`,
        attachments: attachments
      };

      if (replyToId) {
        payload.threadId = replyToId;
      }

      const token = user ? await user.getIdToken() : "";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const result = await res.json();
        console.error("Send error:", result.error);
        if (!replyToId) {
          add({
            from: userEmail,
            to: recipients,
            cc: form.cc ? form.cc.split(",").map((e) => e.trim()).filter(Boolean) : [],
            subject: form.subject,
            body: form.body,
            html: `<div style="font-family: sans-serif; line-height: 1.5; color: #334155;">${form.body.replace(/\n/g, "<br>")}</div>`,
            status: "failed",
            tags: ["failed"],
            date: new Date(),
            read: true,
            starred: false,
            attachments: attachments
          }).catch((e) => console.error("Failed to save failed email:", e));
        }
        toast.error("Email failed to send");
      } else {
        if (!replyToId) {
          add({
            from: userEmail,
            to: recipients,
            cc: form.cc ? form.cc.split(",").map((e) => e.trim()).filter(Boolean) : [],
            subject: form.subject,
            body: form.body,
            html: `<div style="font-family: sans-serif; line-height: 1.5; color: #334155;">${form.body.replace(/\n/g, "<br>")}</div>`,
            status: "sent",
            tags: ["sent"],
            date: new Date(),
            read: true,
            starred: false,
            attachments: attachments
          }).catch((e) => console.error("Failed to save sent email:", e));
        }
        toast.success("Email sent successfully!");
      }
      setShowModal(false);
      setAttachments([]);
      setReplyToId(null);
    } catch (err) {
      console.error("Send error:", err);
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const syncInbox = useCallback(async () => {
    setSyncing(true);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/inbox", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to sync inbox");
      }
      toast.success("Inbox synced successfully!");
    } catch (err: any) {
      console.error("Inbox sync error:", err);
      toast.error(err.message || "Failed to sync inbox. Check console/logs.");
    } finally {
      setSyncing(false);
    }
  }, [user]);

  // Compute folder-specific emails and apply search filter
  const processedEmails = useMemo(() => {
    return emails.filter((email) => {
      // 1. Folder Filtering
      if (email.status === "trash") {
        if (activeFolder !== "trash") return false;
      } else {
        if (activeFolder === "trash") return false;
        if (activeFolder === "starred" && !email.starred) return false;
        if (activeFolder === "drafts" && email.status !== "draft") return false;
        if (activeFolder === "sent" && email.status !== "sent") return false;
        if (activeFolder === "inbox") {
          // Received messages, or sent to the user (and not authored by them if it is standard inbound)
          const isReceived = email.status === "received";
          const isAddressedToUser = email.to.some((t) => t.toLowerCase().includes(userEmail.toLowerCase()));
          const isNotAuthoredByUser = !email.from.toLowerCase().includes(userEmail.toLowerCase());
          if (!isReceived && (!isAddressedToUser || !isNotAuthoredByUser)) {
            return false;
          }
        }
      }

      // 2. Search Query Filtering
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const matchesSubject = email.subject?.toLowerCase().includes(queryLower);
        const matchesBody = email.body?.toLowerCase().includes(queryLower);
        const matchesFrom = email.from?.toLowerCase().includes(queryLower);
        const matchesTo = email.to?.some((t) => t.toLowerCase().includes(queryLower));
        const matchesTag = email.tags?.some((tag) => tag.toLowerCase().includes(queryLower));
        return matchesSubject || matchesBody || matchesFrom || matchesTo || matchesTag;
      }

      return true;
    });
  }, [emails, activeFolder, searchQuery, userEmail]);

  // Counts for folders
  const counts = useMemo(() => {
    return {
      inboxUnread: emails.filter(
        (e) =>
          e.status !== "trash" &&
          !e.read &&
          (e.status === "received" ||
            (e.to.some((t) => t.toLowerCase().includes(userEmail.toLowerCase())) &&
              !e.from.toLowerCase().includes(userEmail.toLowerCase())))
      ).length,
      drafts: emails.filter((e) => e.status === "draft").length,
      starred: emails.filter((e) => e.starred && e.status !== "trash").length
    };
  }, [emails, userEmail]);

  // Generate consistent background colors for avatars based on sender address hash
  const getAvatarStyle = (emailAddress: string) => {
    const initials = emailAddress.substring(0, 2).toUpperCase();
    const colors = [
      "bg-indigo-50 text-indigo-700 border-indigo-100",
      "bg-emerald-50 text-emerald-700 border-emerald-100",
      "bg-violet-50 text-violet-700 border-violet-100",
      "bg-sky-50 text-sky-700 border-sky-100",
      "bg-amber-50 text-amber-700 border-amber-100",
      "bg-rose-50 text-rose-700 border-rose-100",
      "bg-cyan-50 text-cyan-700 border-cyan-100",
      "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100"
    ];
    let sum = 0;
    for (let i = 0; i < emailAddress.length; i++) {
      sum += emailAddress.charCodeAt(i);
    }
    return {
      initials,
      classes: colors[sum % colors.length]
    };
  };

  const getFolderClasses = (folder: EmailFolder) => {
    const base =
      "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ";
    const active =
      "bg-primary-50 text-primary-700 border-l-4 border-primary-500 shadow-sm shadow-primary-500/5";
    const inactive = "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900";
    return base + (activeFolder === folder ? active : inactive);
  };

  if (loading) return <LoadingSpinner size="lg" message="Syncing with Firestore..." />;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col space-y-4 animate-fade-in">
      {/* Search Header and Action Buttons */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search emails by sender, subject, tags..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/10 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={syncInbox}
            disabled={syncing}
            className="btn-secondary flex items-center gap-2 px-4 py-2 hover:bg-slate-100 transition-colors"
          >
            <Download className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing..." : "Sync Inbox"}</span>
          </button>
          <button
            onClick={openCompose}
            className="btn-primary flex items-center gap-2 px-4 py-2 shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Compose</span>
          </button>
        </div>
      </div>

      {/* Mobile Folder Selector Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden no-scrollbar">
        {(["inbox", "starred", "sent", "drafts", "trash"] as EmailFolder[]).map((folder) => {
          const isActive = activeFolder === folder;
          const count = folder === "inbox" ? counts.inboxUnread : folder === "drafts" ? counts.drafts : folder === "starred" ? counts.starred : 0;
          return (
            <button
              key={folder}
              onClick={() => { setActiveFolder(folder); setSelected(null); }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="capitalize">{folder}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${isActive ? "bg-white text-primary-600" : "bg-primary-50 text-primary-600"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        
        {/* Navigation Sidebar Pane */}
        <div className="hidden lg:flex lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-col justify-between overflow-y-auto">
          <div className="space-y-1">
            <button onClick={() => { setActiveFolder("inbox"); setSelected(null); }} className={getFolderClasses("inbox")}>
              <div className="flex items-center gap-3">
                <Inbox className="w-4 h-4" />
                <span>Inbox</span>
              </div>
              {counts.inboxUnread > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-primary-100 text-primary-700 rounded-full">
                  {counts.inboxUnread}
                </span>
              )}
            </button>

            <button onClick={() => { setActiveFolder("starred"); setSelected(null); }} className={getFolderClasses("starred")}>
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4" />
                <span>Starred</span>
              </div>
              {counts.starred > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                  {counts.starred}
                </span>
              )}
            </button>

            <button onClick={() => { setActiveFolder("sent"); setSelected(null); }} className={getFolderClasses("sent")}>
              <div className="flex items-center gap-3">
                <Send className="w-4 h-4" />
                <span>Sent</span>
              </div>
            </button>

            <button onClick={() => { setActiveFolder("drafts"); setSelected(null); }} className={getFolderClasses("drafts")}>
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4" />
                <span>Drafts</span>
              </div>
              {counts.drafts > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                  {counts.drafts}
                </span>
              )}
            </button>

            <button onClick={() => { setActiveFolder("trash"); setSelected(null); }} className={getFolderClasses("trash")}>
              <div className="flex items-center gap-3">
                <Trash2 className="w-4 h-4" />
                <span>Trash</span>
              </div>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            <p className="truncate">Profile: <span className="font-semibold text-slate-600">{userEmail}</span></p>
          </div>
        </div>

        {/* Middle Pane: Email List */}
        <div className={`lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex-col min-h-0 ${selected ? "hidden lg:flex" : "flex"}`}>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 capitalize">{activeFolder}</h3>
            <span className="text-xs text-slate-400">{processedEmails.length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {processedEmails.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <EmptyState title={`No ${activeFolder}`} message="No emails found matching this filter." />
              </div>
            ) : (
              processedEmails.map((email) => {
                const avatar = getAvatarStyle(email.from);
                const isSelected = selected?.id === email.id;
                
                return (
                  <div
                    key={email.id}
                    onClick={() => {
                      setSelected(email);
                      if (!email.read) {
                        // Soft update read status on click
                        update(email.id, { read: true });
                      }
                    }}
                    className={`group relative px-4 py-4 cursor-pointer transition-all duration-200 border-l-4 ${
                      isSelected
                        ? "bg-primary-50/40 border-l-primary-500"
                        : "border-l-transparent hover:bg-slate-50/60"
                    } ${!email.read ? "bg-slate-50/30" : ""}`}
                  >
                    {/* Unread dot */}
                    {!email.read && (
                      <span className="absolute top-5 left-1.5 w-2.5 h-2.5 bg-primary-600 rounded-full" />
                    )}

                    <div className="flex gap-3 items-start">
                      {/* Colored Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0 ${avatar.classes}`}>
                        {avatar.initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs truncate ${!email.read ? "font-bold text-slate-900" : "text-slate-600"}`}>
                            {email.status === "sent" ? `To: ${email.to.join(", ")}` : email.from}
                          </p>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">
                            {timeAgo(email.date as Date)}
                          </span>
                        </div>

                        <p className={`text-xs truncate mt-0.5 ${!email.read ? "font-semibold text-slate-800" : "text-slate-700"}`}>
                          {email.subject || "(No subject)"}
                        </p>

                        <p className="text-[11px] text-slate-400 mt-1 truncate max-w-full">
                          {email.body}
                        </p>

                        {email.tags && email.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {email.tags.slice(0, 2).map((t) => (
                              <span key={t} className="px-1.5 py-0.5 text-[9px] bg-slate-100 text-slate-500 rounded font-medium border border-slate-200">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Hover Action Bar */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white/95 px-1.5 py-1 rounded-lg shadow-sm border border-slate-200 transition-all">
                      <button
                        onClick={(e) => handleToggleStar(e, email)}
                        className="p-1 rounded hover:bg-slate-100 text-amber-400 hover:text-amber-500 transition-colors"
                        title={email.starred ? "Unstar" : "Star"}
                      >
                        <Star className={`w-3.5 h-3.5 ${email.starred ? "fill-amber-400" : ""}`} />
                      </button>
                      <button
                        onClick={(e) => handleToggleRead(e, email)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                        title={email.read ? "Mark unread" : "Mark read"}
                      >
                        {email.read ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                      </button>
                      {activeFolder === "trash" ? (
                        <>
                          <button
                            onClick={(e) => handleRestoreFromTrash(e, email)}
                            className="p-1 rounded hover:bg-slate-100 text-emerald-600 hover:text-emerald-700"
                            title="Restore"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handlePermanentDelete(e, email)}
                            className="p-1 rounded hover:bg-slate-100 text-red-500 hover:text-red-700"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => handleMoveToTrash(e, email)}
                          className="p-1 rounded hover:bg-slate-100 text-red-500 hover:text-red-700"
                          title="Trash"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Reading Pane / Detail View */}
        <div className={`lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex-col min-h-0 ${selected ? "flex" : "hidden lg:flex"}`}>
          {selected ? (
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* Header Actions */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/50 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-200 lg:hidden flex items-center gap-1 mr-1"
                    title="Back to list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-semibold">Back</span>
                  </button>

                  <button
                    onClick={() => handleToggleStar({ stopPropagation: () => {} } as any, selected)}
                    className={`p-1.5 rounded-lg border hover:bg-white text-slate-400 hover:text-amber-500 transition-colors ${
                      selected.starred ? "border-amber-200 bg-amber-50/30 text-amber-500" : "border-slate-200"
                    }`}
                    title="Star / Unstar"
                  >
                    <Star className={`w-4 h-4 ${selected.starred ? "fill-amber-400 text-amber-500" : ""}`} />
                  </button>

                  <button
                    onClick={(e) => handleToggleRead(e as any, selected)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-500 hover:text-slate-800 transition-all"
                    title={selected.read ? "Mark unread" : "Mark read"}
                  >
                    {selected.read ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {selected.status === "received" && (
                    <button
                      onClick={() => handleReply(selected)}
                      className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-slate-100"
                    >
                      <Reply className="w-3.5 h-3.5" /> Reply
                    </button>
                  )}

                  {selected.status === "trash" ? (
                    <>
                      <button
                        onClick={(e) => handleRestoreFromTrash(e as any, selected)}
                        className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/30"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Restore
                      </button>
                      <button
                        onClick={(e) => handlePermanentDelete(e as any, selected)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => handleMoveToTrash(e as any, selected)}
                      className="p-1.5 rounded-lg border border-slate-200 text-red-500 hover:bg-red-50 transition-colors"
                      title="Trash"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Contents */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Subject & Status */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-bold text-slate-800 leading-tight">
                      {selected.subject || "(No subject)"}
                    </h2>
                    <StatusBadge status={selected.status} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selected.tags?.map((t) => (
                      <span key={t} className="px-2 py-0.5 text-[10px] bg-slate-100 border border-slate-200 text-slate-600 rounded font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Sender/Recipient Metadata */}
                <div className="flex items-center justify-between border-t border-b border-slate-100 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border ${getAvatarStyle(selected.from).classes}`}>
                      {getAvatarStyle(selected.from).initials}
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        {selected.from}
                      </p>
                      <p className="text-slate-500 mt-0.5 truncate">
                        to {selected.to.join(", ")}
                        {selected.cc && selected.cc.length > 0 && ` • cc ${selected.cc.join(", ")}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <p>{formatDate(selected.date as Date)}</p>
                    <p className="mt-0.5 font-medium">{timeAgo(selected.date as Date)}</p>
                  </div>
                </div>

                {/* Email Body / HTML Frame */}
                {selected.html ? (
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col min-h-[350px]">
                    <iframe
                      srcDoc={selected.html}
                      title="Email content"
                      className="w-full flex-grow min-h-[350px] border-0 bg-white"
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-inner min-h-[200px]">
                    {selected.body || <span className="italic text-slate-400">No content in body</span>}
                  </div>
                )}

                {/* Attachments Section */}
                {selected.attachments && selected.attachments.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" /> Attachments ({selected.attachments.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selected.attachments.map((att, index) => {
                        const isImage = att.type.startsWith("image/");
                        const isAudio = att.type.startsWith("audio/");
                        const isVideo = att.type.startsWith("video/");
                        
                        return (
                          <div
                            key={index}
                            className="flex flex-col bg-slate-50 hover:bg-slate-100/60 border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all duration-200 group"
                          >
                            {/* Media Preview Area */}
                            {isImage ? (
                              <div className="h-28 bg-slate-200 relative overflow-hidden flex-shrink-0 flex items-center justify-center">
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-white/95 rounded-full hover:bg-white text-slate-700 shadow-md hover:scale-105 transition-transform"
                                    title="View Full Image"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </a>
                                  <a
                                    href={att.url}
                                    download={att.name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-white/95 rounded-full hover:bg-white text-slate-700 shadow-md hover:scale-105 transition-transform"
                                    title="Download"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                </div>
                              </div>
                            ) : isAudio ? (
                              <div className="p-3 bg-indigo-50/50 flex flex-col justify-center gap-1.5 flex-shrink-0 border-b border-slate-200">
                                <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-medium">
                                  <Music className="w-3.5 h-3.5" /> Audio Memo
                                </div>
                                <audio src={att.url} controls className="w-full h-8 scale-90 -ml-3" />
                              </div>
                            ) : isVideo ? (
                              <div className="h-28 bg-slate-900 relative flex-shrink-0 flex items-center justify-center">
                                <video src={att.url} controls className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="h-16 bg-slate-100 border-b border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                                {att.type.includes("pdf") ? (
                                  <FileText className="w-8 h-8 text-rose-500" />
                                ) : att.type.includes("sheet") || att.type.includes("excel") || att.name.endsWith(".xlsx") || att.name.endsWith(".csv") ? (
                                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                                ) : (
                                  <File className="w-8 h-8 text-slate-500" />
                                )}
                              </div>
                            )}
                            
                            {/* Attachment Info Card Footer */}
                            <div className="p-3 flex-1 flex flex-col justify-between">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700 truncate" title={att.name}>
                                  {att.name}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {formatFileSize(att.size)}
                                </p>
                              </div>
                              
                              {/* Actions for non-previewable files */}
                              {!isImage && !isAudio && !isVideo && (
                                <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex justify-end">
                                  <a
                                    href={att.url}
                                    download={att.name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 hover:underline"
                                  >
                                    <Download className="w-3 h-3" /> Download File
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                <FolderOpen className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">No email selected</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Select an email from the list to view its header details, tags, and full conversation body.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose & Draft Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="New Message"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={handleSaveDraft}
              className="btn-secondary flex items-center gap-1.5 px-4 py-2 hover:bg-slate-100 transition-colors"
            >
              <FileText className="w-4 h-4" /> Save Draft
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="btn-primary flex items-center gap-2 px-5 py-2 shadow-md hover:shadow-lg transition-all"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-left p-1">
          {/* Locked From Field */}
          <div>
            <label className="label">From</label>
            <div className="relative">
              <input
                className="input-field bg-slate-50 border-slate-200 text-slate-500 font-medium cursor-not-allowed pr-20"
                value={userEmail}
                disabled
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-md font-semibold border border-slate-300/30 select-none">
                Locked Profile
              </span>
            </div>
          </div>

          <div>
            <label className="label">To (comma-separated)</label>
            <input
              className="input-field"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
              placeholder="recipient@example.com"
              required
            />
          </div>

          <div>
            <label className="label">CC (comma-separated)</label>
            <input
              className="input-field"
              value={form.cc}
              onChange={(e) => setForm({ ...form, cc: e.target.value })}
              placeholder="copy@example.com"
            />
          </div>

          <div>
            <label className="label">Subject</label>
            <input
              className="input-field"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Enter subject line"
              required
            />
          </div>

          <div>
            <label className="label">Body</label>
            <textarea
              className="input-field resize-y font-sans leading-relaxed"
              rows={8}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write your email here..."
            />
          </div>

          {/* Attachments Section in Compose */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5 text-slate-400" /> Attachments
              </span>
              <label className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer font-medium hover:underline">
                Add files...
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
            </div>
            
            {uploading && (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-500" />
                <span>Uploading attachment(s)...</span>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-100">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs max-w-[200px]">
                    <span className="truncate font-medium text-slate-600 flex-1">{att.name}</span>
                    <span className="text-[10px] text-slate-400">({formatFileSize(att.size)})</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="text-red-500 hover:text-red-700 transition-colors p-0.5 rounded hover:bg-slate-100"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Tags (comma-separated)</label>
            <input
              className="input-field"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="work, client, urgency-high"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
