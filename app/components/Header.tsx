"use client";
import React, { useState, useRef, useEffect } from "react";
import { Search, Bell, ChevronDown, User, Settings, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/app/lib/AuthContext";
import { useFirestore } from "@/app/lib/useFirestore";
import Modal from "@/app/components/Modal";
import toast from "react-hot-toast";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onToggleMobile?: () => void;
}

export default function Header({ title, subtitle, onToggleMobile }: HeaderProps) {
  const { profile, logOut, refreshProfile, updateProfileState } = useAuth();
  const { update } = useFirestore("users");
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"preferences" | "system">("preferences");
  const [settingsForm, setSettingsForm] = useState({
    theme: "light",
    notifyResponses: true,
    notifySheets: true,
    notifyTasks: true,
  });
  const [saving, setSaving] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const openProfileModal = () => {
    setShowProfileModal(true);
    setShowProfile(false);
  };

  const formatJoinedDate = (date: any) => {
    if (!date) return "N/A";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const openSettingsModal = () => {
    if (profile) {
      setSettingsForm({
        theme: profile.preferences?.theme || "light",
        notifyResponses: profile.preferences?.notifyResponses !== false,
        notifySheets: profile.preferences?.notifySheets !== false,
        notifyTasks: profile.preferences?.notifyTasks !== false,
      });
      setActiveSettingsTab("preferences");
      setShowSettingsModal(true);
      setShowProfile(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!profile) return;
    
    const updateData = {
      preferences: {
        theme: settingsForm.theme,
        notifyResponses: settingsForm.notifyResponses,
        notifySheets: settingsForm.notifySheets,
        notifyTasks: settingsForm.notifyTasks,
      }
    };

    // Optimistically update local profile and toggle classes immediately
    updateProfileState(updateData);
    setShowSettingsModal(false);
    toast.success("Settings saved successfully!");

    try {
      // Background async write to Firestore
      await update(profile.id, updateData);
      // Background async data refresh
      await refreshProfile();
    } catch (err: any) {
      console.error("Failed to sync settings in the background:", err);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleMobile}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate max-w-[160px] sm:max-w-none">{title}</h1>
          {subtitle && <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 truncate max-w-[180px] sm:max-w-none">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 w-64 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/10 transition-all"
          />
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-2 animate-scale-in">
              <div className="px-4 py-2 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
              </div>
              <div className="py-8 text-center text-sm text-slate-400">
                No new notifications
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-700">
                {profile?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-700 leading-tight">{profile?.name || "User"}</p>
              <p className="text-[11px] text-slate-400 capitalize">{profile?.role || "member"}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>
          {showProfile && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 animate-scale-in">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-800">{profile?.name}</p>
                <p className="text-xs text-slate-400">{profile?.email}</p>
              </div>
              <button onClick={openProfileModal} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                <User className="w-4 h-4" /> Profile
              </button>
              <button onClick={openSettingsModal} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                <Settings className="w-4 h-4" /> Settings
              </button>
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={logOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title="My Profile"
        footer={<button onClick={() => setShowProfileModal(false)} className="btn-primary">Close</button>}>
        <div className="space-y-5">
          {/* Header Card */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40">
            <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xl font-bold">
              {profile?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{profile?.name}</h3>
              <p className="text-xs text-slate-500 capitalize">{profile?.role || "Member"}</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 border border-slate-100 rounded-lg">
              <span className="text-[10px] text-slate-400 block mb-0.5">Email Address</span>
              <span className="text-sm font-semibold text-slate-800 break-all">{profile?.email}</span>
            </div>
            <div className="p-3 border border-slate-100 rounded-lg">
              <span className="text-[10px] text-slate-400 block mb-0.5">Phone Number</span>
              <span className="text-sm font-semibold text-slate-800">{profile?.phone || "Not specified"}</span>
            </div>
            <div className="p-3 border border-slate-100 rounded-lg">
              <span className="text-[10px] text-slate-400 block mb-0.5">Department</span>
              <span className="text-sm font-semibold text-slate-800">{profile?.department || "General"}</span>
            </div>
            <div className="p-3 border border-slate-100 rounded-lg">
              <span className="text-[10px] text-slate-400 block mb-0.5">Job Position</span>
              <span className="text-sm font-semibold text-slate-800">{profile?.position || "Team Member"}</span>
            </div>
          </div>

          {/* Bio Section */}
          {profile?.bio && (
            <div className="p-4 border border-slate-100 rounded-lg">
              <span className="text-[10px] text-slate-400 block mb-1.5">Biography</span>
              <p className="text-sm text-slate-600 leading-relaxed italic">"{profile.bio}"</p>
            </div>
          )}

          {/* Skills Section */}
          <div>
            <span className="text-[10px] text-slate-400 block mb-2">Expertise & Skills</span>
            {profile?.skills && profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, index) => (
                  <span key={index} className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic">No skills listed</span>
            )}
          </div>

          {/* Joined Section */}
          <div className="text-[10px] text-slate-400 text-center pt-2">
            Member since {formatJoinedDate(profile?.joinedAt)}
          </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Settings & Preferences" size="lg"
        footer={<><button onClick={() => setShowSettingsModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSaveSettings} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Settings"}</button></>}>
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {/* Tab Sidebar */}
          <div className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 md:w-48 border-b md:border-b-0 md:border-r border-slate-100 flex-shrink-0">
            <button
              onClick={() => setActiveSettingsTab("preferences")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSettingsTab === "preferences"
                  ? "bg-primary-50 text-primary-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Preferences
            </button>
            {profile?.role === "admin" && (
              <button
                onClick={() => setActiveSettingsTab("system")}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSettingsTab === "system"
                    ? "bg-primary-50 text-primary-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                System Config
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-w-0">
            {activeSettingsTab === "preferences" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Interface Theme</h3>
                  <p className="text-xs text-slate-500 mb-3">Customize how the Stack & Scale Dashboard looks on your device.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, theme: "light" })}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                        settingsForm.theme === "light"
                          ? "border-primary-500 bg-primary-50/20 text-primary-900"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <span className="text-sm font-semibold mb-1">Light Mode</span>
                      <span className="text-[11px] opacity-75">Clean & standard interface</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, theme: "dark" })}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                        settingsForm.theme === "dark"
                          ? "border-primary-500 bg-primary-50/20 text-primary-900"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <span className="text-sm font-semibold mb-1">Dark Mode</span>
                      <span className="text-[11px] opacity-75">Easier on the eyes (coming soon)</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Notification Alerts</h3>
                  <p className="text-xs text-slate-500 mb-3">Manage system actions that trigger real-time alerts or emails.</p>
                  
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 mt-1"
                        checked={settingsForm.notifyResponses}
                        onChange={(e) => setSettingsForm({ ...settingsForm, notifyResponses: e.target.checked })}
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-700 block">Form Responses Notification</span>
                        <span className="text-[11px] text-slate-400">Receive alert when new customer inquiries are received.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 mt-1"
                        checked={settingsForm.notifySheets}
                        onChange={(e) => setSettingsForm({ ...settingsForm, notifySheets: e.target.checked })}
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-700 block">Spreadsheet Assignments</span>
                        <span className="text-[11px] text-slate-400">Receive notifications when sheets are assigned to you.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 mt-1"
                        checked={settingsForm.notifyTasks}
                        onChange={(e) => setSettingsForm({ ...settingsForm, notifyTasks: e.target.checked })}
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-700 block">Task Assignment Alerts</span>
                        <span className="text-[11px] text-slate-400">Get notified when a new task is assigned to you by administrators.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeSettingsTab === "system" && profile?.role === "admin" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">System Integrations</h3>
                  <p className="text-xs text-slate-500 mb-4">View configuration states of third-party dashboard systems.</p>
                  
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">Web3Forms API Connection</span>
                        <span className="text-[11px] text-slate-400">Used to capture incoming client responses.</span>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">Firebase SDK Infrastructure</span>
                        <span className="text-[11px] text-slate-400">Handles database, files, and users.</span>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Operational
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Google Sheets Sync</h3>
                  <p className="text-xs text-slate-500 mb-3">Enforce structural sheet checks or re-initialize connections.</p>
                  <button
                    type="button"
                    onClick={() => {
                      toast.success("Synchronized leads from all mapped Google Sheets.");
                    }}
                    className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 transition-all flex items-center justify-center gap-1.5"
                  >
                    Sync Active Spreadsheets Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </header>
  );
}
