"use client";
import React, { useState } from "react";
import { Plus, Edit2, Trash2, ExternalLink, BookOpen, Layers } from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { Resource } from "@/app/types";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";
import Modal from "@/app/components/Modal";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import EmptyState from "@/app/components/EmptyState";
import toast from "react-hot-toast";

export default function ResourcesPage() {
  const { data: resources, loading } = useCollection<Resource>("resources");
  const { add, update, remove } = useFirestore("resources");
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  
  const [form, setForm] = useState({
    title: "",
    link: "",
    description: "",
    features: "",
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ title: "", link: "", description: "", features: "" });
    setShowModal(true);
  };

  const openEdit = (res: Resource) => {
    setEditing(res);
    setForm({
      title: res.title,
      link: res.link,
      description: res.description,
      features: res.features?.join(", ") || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!form.link.trim()) {
      toast.error("Please enter a demo link");
      return;
    }

    // Basic URL validation prefix check
    let formattedLink = form.link.trim();
    if (!/^https?:\/\//i.test(formattedLink)) {
      formattedLink = `https://${formattedLink}`;
    }

    const parsedFeatures = form.features
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);

    const data = {
      title: form.title.trim(),
      link: formattedLink,
      description: form.description.trim(),
      features: parsedFeatures,
      createdBy: profile?.id || "admin",
    };

    try {
      if (editing) {
        if (!canPerformAction(profile?.role, "resources", "update")) {
          toast.error("Unauthorized to edit resources");
          return;
        }
        await update(editing.id, data);
        toast.success("Resource updated successfully!");
      } else {
        if (!canPerformAction(profile?.role, "resources", "create")) {
          toast.error("Unauthorized to create resources");
          return;
        }
        await add(data);
        toast.success("Resource added successfully!");
      }
      setShowModal(false);
    } catch (err) {
      console.error("Failed to save resource:", err);
      toast.error("Failed to save resource details");
    }
  };

  const handleDelete = async (id: string) => {
    if (!canPerformAction(profile?.role, "resources", "delete")) {
      toast.error("Unauthorized to delete resources");
      return;
    }
    if (!confirm("Are you sure you want to delete this prototype demo reference?")) {
      return;
    }

    try {
      await remove(id);
      toast.success("Resource removed successfully");
    } catch (err) {
      console.error("Failed to delete resource:", err);
      toast.error("Failed to remove resource");
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading resources & prototypes..." />;
  }

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {resources.length} prototype demo{resources.length !== 1 ? "s" : ""} available
          </p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Prototype
          </button>
        )}
      </div>

      {resources.length === 0 ? (
        <EmptyState
          title="No prototypes listed"
          message="Prototypes and interactive demos will appear here once registered by administrators."
          action={
            isAdmin ? (
              <button onClick={openAdd} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Prototype
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {resources.map((res) => (
            <div key={res.id} className="card-hover p-6 flex flex-col justify-between">
              <div>
                {/* Header title / controls */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">
                        {res.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Prototype</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(res)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Edit Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(res.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete Prototype"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                  {res.description || "No description provided for this demo."}
                </p>

                {/* Features Tags */}
                {res.features && res.features.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                      What is in it
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {res.features.map((feature, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Demo Link Button */}
              <a
                href={res.link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <span>Open Demo Prototype</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Admin management modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Prototype Demo" : "Add Prototype Demo"}
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary">
              Save Details
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Prototype Title</label>
            <input
              className="input-field"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Lead Pipeline Dashboard"
            />
          </div>
          <div>
            <label className="label">Demo URL Link</label>
            <input
              className="input-field"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="e.g. https://proto.stackandscale.in/pipeline"
            />
          </div>
          <div>
            <label className="label">Key Features & Components (comma-separated)</label>
            <input
              className="input-field"
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              placeholder="e.g. Interactive Board, Multi-currency support, Drag and Drop"
            />
          </div>
          <div>
            <label className="label">About Prototype Demo (Description)</label>
            <textarea
              className="input-field"
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide information on what this prototype demonstrates and how to operate it..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
