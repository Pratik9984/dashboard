"use client";
import React, { useState } from "react";
import { Plus, Mail, Phone, MapPin, Edit2, Trash2, Shield, User } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { TeamMember, UserRole } from "@/app/types";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";
import Modal from "@/app/components/Modal";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import StatusBadge from "@/app/components/StatusBadge";
import toast from "react-hot-toast";
import { Timestamp } from "firebase/firestore";

export default function TeamPage() {
  const { data: members, loading } = useCollection<TeamMember>("users");
  const { add, update, remove } = useFirestore("users");
  const { profile: currentUserProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<{
    name: string;
    email: string;
    role: UserRole;
    department: string;
    position: string;
    phone: string;
    bio: string;
    skills: string;
  }>({
    name: "",
    email: "",
    role: "member",
    department: "",
    position: "",
    phone: "",
    bio: "",
    skills: "",
  });

  const openAdd = () => { setEditing(null); setForm({ name: "", email: "", role: "member", department: "", position: "", phone: "", bio: "", skills: "" }); setShowModal(true); };
  const openEdit = (m: TeamMember) => { setEditing(m); setForm({ name: m.name, email: m.email, role: m.role, department: m.department, position: m.position, phone: m.phone || "", bio: m.bio || "", skills: m.skills?.join(", ") || "" }); setShowModal(true); };

  const handleSave = async () => {
    try {
      const data = { ...form, skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean), isActive: true, joinedAt: Timestamp.now() };
      
      if (editing) {
        if (!canPerformAction(currentUserProfile?.role, "users", "update", editing, currentUserProfile?.id)) {
          toast.error("Unauthorized to edit this user");
          return;
        }
        if (editing.role === "admin" && form.role !== "admin") {
          const adminCount = members.filter((m) => m.role === "admin").length;
          if (adminCount <= 1) {
            toast.error("You can't remove the last admin.");
            return;
          }
        }
        await update(editing.id, data);
        toast.success("Member updated");
      } else {
        if (!canPerformAction(currentUserProfile?.role, "users", "create", data)) {
          toast.error("Unauthorized to create users");
          return;
        }
        await add(data);
        toast.success("Member added");
      }
      setShowModal(false);
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    const target = members.find((m) => m.id === id);
    if (!target) return;
    if (!canPerformAction(currentUserProfile?.role, "users", "delete", target)) {
      toast.error("Unauthorized to delete this user");
      return;
    }
    if (target.role === "admin") {
      const adminCount = members.filter((m) => m.role === "admin").length;
      if (adminCount <= 1) {
        toast.error("You can't remove the last admin.");
        return;
      }
    }
    if (!confirm("Remove this team member?")) return;
    try { await remove(id); toast.success("Member removed"); } catch { toast.error("Failed to remove"); }
  };

  if (loading) return <LoadingSpinner size="lg" message="Loading team..." />;

  const canAdd = canPerformAction(currentUserProfile?.role, "users", "create");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{members.length} team member{members.length !== 1 ? "s" : ""}</p>
        </div>
        {canAdd && (
          <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Member</button>
        )}
      </div>

      {members.length === 0 ? (
        <EmptyState title="No team members" message="Add your first team member to get started." action={canAdd ? <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Member</button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.map((m) => {
            const canEdit = canPerformAction(currentUserProfile?.role, "users", "update", m, currentUserProfile?.id);
            const canDelete = canPerformAction(currentUserProfile?.role, "users", "delete", m);

            return (
              <div key={m.id} className="card-hover p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-primary-700">{m.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">{m.name}</h3>
                      <p className="text-xs text-slate-500">{m.position}</p>
                    </div>
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 className="w-3.5 h-3.5" /></button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-500"><Mail className="w-3.5 h-3.5" /><span className="truncate">{m.email}</span></div>
                  {m.phone && <div className="flex items-center gap-2 text-slate-500"><Phone className="w-3.5 h-3.5" /><span>{m.phone}</span></div>}
                  <div className="flex items-center gap-2 text-slate-500"><MapPin className="w-3.5 h-3.5" /><span>{m.department}</span></div>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className={`badge ${m.role === "admin" ? "bg-primary-50 text-primary-700 border-primary-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                    {m.role === "admin" ? <Shield className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                    {m.role}
                  </span>
                  <StatusBadge status={m.isActive ? "active" : "inactive"} />
                </div>
                {m.skills && m.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {m.skills.slice(0, 4).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md">{s}</span>
                    ))}
                    {m.skills.length > 4 && <span className="px-2 py-0.5 text-xs text-slate-400">+{m.skills.length - 4}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Member" : "Add Member"}
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save</button></>}>
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Role</label>
              <select 
                className="input-field" 
                value={form.role} 
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                disabled={editing?.id === currentUserProfile?.id}
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
            </div>
            <div><label className="label">Department</label><input className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Position</label><input className="input-field" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><label className="label">Skills (comma-separated)</label><input className="input-field" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, Node.js, Design" /></div>
          <div><label className="label">Bio</label><textarea className="input-field" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}
