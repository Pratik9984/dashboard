"use client";
import React, { useState } from "react";
import { Plus, Edit2, Trash2, ExternalLink, BookOpen, Layers, FileText, Download } from "lucide-react";
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
  const [formType, setFormType] = useState<"prototype" | "pdf">("prototype");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const [form, setForm] = useState({
    title: "",
    link: "",
    description: "",
    features: "",
  });

  const openAdd = () => {
    setEditing(null);
    setFormType("prototype");
    setForm({ title: "", link: "", description: "", features: "" });
    setShowModal(true);
  };

  const openEdit = (res: Resource) => {
    setEditing(res);
    setFormType(res.type || "prototype");
    setForm({
      title: res.title,
      link: res.link,
      description: res.description,
      features: res.features?.join(", ") || "",
    });
    setShowModal(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please select a valid PDF file");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { ref: storageRef, uploadBytesResumable, getDownloadURL } = await import("firebase/storage");
      const { getFirebaseStorage } = await import("@/app/lib/firebase");
      const storage = getFirebaseStorage();
      
      const fileRef = storageRef(storage, `resources/pdfs/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error("Upload error:", error);
          toast.error("Failed to upload PDF");
          setUploading(false);
          setUploadProgress(null);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setForm((prev) => ({ ...prev, link: url }));
            toast.success("PDF uploaded successfully!");
          } catch (err) {
            console.error("Failed to retrieve download URL:", err);
            toast.error("Failed to process uploaded file");
          } finally {
            setUploading(false);
            setUploadProgress(null);
          }
        }
      );
    } catch (importErr) {
      console.error("Firebase storage import error:", importErr);
      toast.error("Failed to initialize storage client");
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!form.link.trim()) {
      toast.error(formType === "pdf" ? "Please upload a PDF document" : "Please enter a demo link");
      return;
    }

    // Basic URL validation prefix check
    let formattedLink = form.link.trim();
    if (formType === "prototype" && !/^https?:\/\//i.test(formattedLink)) {
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
      type: formType,
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
    if (!confirm("Are you sure you want to delete this resource reference?")) {
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
    return <LoadingSpinner size="lg" message="Loading resources & documents..." />;
  }

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {resources.length} resource{resources.length !== 1 ? "s" : ""} available
          </p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Resource
          </button>
        )}
      </div>

      {resources.length === 0 ? (
        <EmptyState
          title="No resources listed"
          message="Resources, prototypes, and documents will appear here once registered by administrators."
          action={
            isAdmin ? (
              <button onClick={openAdd} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Resource
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {resources.map((res) => {
            const isPdf = res.type === "pdf";
            return (
              <div key={res.id} className="card-hover p-6 flex flex-col justify-between">
                <div>
                  {/* Header title / controls */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isPdf ? "bg-red-50 text-red-600" : "bg-primary-50 text-primary-600"
                      }`}>
                        {isPdf ? (
                          <FileText className="w-5 h-5" />
                        ) : (
                          <Layers className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 leading-tight">
                          {res.title}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {isPdf ? "PDF Document" : "Prototype"}
                        </p>
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
                          title="Delete Resource"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                    {res.description || "No description provided for this resource."}
                  </p>

                  {/* Features Tags */}
                  {res.features && res.features.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                        {isPdf ? "Topics covered" : "What is in it"}
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

                {/* Resource Action Buttons */}
                <div className="flex gap-2 w-full">
                  <a
                    href={res.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 flex items-center justify-center gap-2 ${
                      isPdf 
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium py-2 px-4 rounded-xl text-sm transition-all" 
                        : "btn-primary"
                    }`}
                  >
                    <span>{isPdf ? "View PDF" : "Open Demo Prototype"}</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {isPdf && (
                    <a
                      href={res.link}
                      download={`${res.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin management modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? (formType === "pdf" ? "Edit PDF Document" : "Edit Prototype Demo") : (formType === "pdf" ? "Add PDF Document" : "Add Prototype Demo")}
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary" disabled={uploading}>
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary" disabled={uploading}>
              Save Details
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Resource Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setFormType("prototype");
                  // Clear link if toggle changed to avoid carrying over PDF url to normal url
                  if (!editing) setForm(prev => ({ ...prev, link: "" }));
                }}
                className={`py-2 px-4 rounded-xl text-sm font-semibold border transition-all ${
                  formType === "prototype"
                    ? "bg-primary-50 border-primary-500 text-primary-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Interactive Prototype
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormType("pdf");
                  // Clear link if toggle changed to avoid carrying over URL to file upload
                  if (!editing) setForm(prev => ({ ...prev, link: "" }));
                }}
                className={`py-2 px-4 rounded-xl text-sm font-semibold border transition-all ${
                  formType === "pdf"
                    ? "bg-red-50 border-red-500 text-red-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                PDF Document
              </button>
            </div>
          </div>

          <div>
            <label className="label">{formType === "pdf" ? "Document Title" : "Prototype Title"}</label>
            <input
              className="input-field"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={formType === "pdf" ? "e.g. Lead Pipeline Prototype Specs & Walkthrough" : "e.g. Lead Pipeline Dashboard"}
            />
          </div>

          {formType === "prototype" ? (
            <div>
              <label className="label">Demo URL Link</label>
              <input
                className="input-field"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="e.g. https://proto.stackandscale.in/pipeline"
              />
            </div>
          ) : (
            <div>
              <label className="label">Upload PDF Document</label>
              <div className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50 hover:bg-slate-100/70 transition-all relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-center space-y-2 pointer-events-none">
                  <FileText className={`w-8 h-8 mx-auto ${uploading ? "text-red-500 animate-bounce" : "text-slate-400"}`} />
                  <p className="text-sm font-medium text-slate-700">
                    {uploading ? `Uploading PDF... ${uploadProgress !== null ? `${uploadProgress}%` : ""}` : form.link ? "PDF Uploaded! Click to replace" : "Drag and drop or click to upload PDF"}
                  </p>
                  <p className="text-xs text-slate-400">PDF documents only</p>
                </div>
              </div>
              {form.link && (
                <div className="mt-2 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0" />
                    <span className="truncate font-medium">
                      {form.link.split("/").pop()?.split("?")[0]?.substring(14) || "uploaded_document.pdf"}
                    </span>
                  </div>
                  <a
                    href={form.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1 flex-shrink-0"
                  >
                    View PDF <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">{formType === "pdf" ? "Key Highlights / Topics (comma-separated)" : "Key Features & Components (comma-separated)"}</label>
            <input
              className="input-field"
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              placeholder={formType === "pdf" ? "e.g. Scope of Work, Core Layouts, Integration Requirements" : "e.g. Interactive Board, Multi-currency support, Drag and Drop"}
            />
          </div>

          <div>
            <label className="label">About Resource (Description)</label>
            <textarea
              className="input-field"
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={formType === "pdf" ? "Provide information/notes about the prototype walkthrough and details to be shared with the client..." : "Provide information on what this resource demonstrates and how to operate it..."}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
