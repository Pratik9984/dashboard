"use client";
import React, { useState, useMemo, useEffect } from "react";
import {
  Plus, Edit2, Trash2, Printer, CheckCircle, Receipt, TrendingUp,
  AlertCircle, DollarSign, PlusCircle, Trash, X
} from "lucide-react";
import { useCollection, useFirestore } from "@/app/lib/useFirestore";
import { Invoice, Bill, Client, InvoiceItem, BillItem, Project } from "@/app/types";
import { useAuth } from "@/app/lib/AuthContext";
import { canPerformAction } from "@/app/lib/permissions";
import DataTable, { Column } from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import StatsCard from "@/app/components/StatsCard";
import { formatCurrency, formatDate } from "@/app/lib/data";
import toast from "react-hot-toast";
import { Timestamp } from "firebase/firestore";

export default function BillingPage() {
  const { data: invoices, loading: loadingInvoices } = useCollection<Invoice>("invoices");
  const { data: bills, loading: loadingBills } = useCollection<Bill>("bills");
  const { data: clients } = useCollection<Client>("clients");
  const { data: projects } = useCollection<Project>("projects");

  const { add: addInvoice, update: updateInvoice, remove: removeInvoice } = useFirestore("invoices");
  const { add: addBill, update: updateBill, remove: removeBill } = useFirestore("bills");
  const { update: updateClient } = useFirestore("clients");

  const { profile: currentUserProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<"invoices" | "bills" | "profitability">("invoices");
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  const [billFilter, setBillFilter] = useState("all");

  // Predefined Web Dev agency services list
  const AGENCY_SERVICES = [
    { label: "Custom Next.js Web App Development", description: "Design and development of custom high-performance Next.js web application including API integrations and database.", rate: 75000 },
    { label: "UI/UX Design & Figma Prototyping", description: "High-fidelity UI/UX design wireframes and interactive prototype in Figma.", rate: 35000 },
    { label: "Cloud Deployment & DevOps Setup", description: "Configuring hosting on Vercel/AWS/GCP, setting up CI/CD pipelines, SSL certificates, and database hosting.", rate: 20000 },
    { label: "SEO Audit & Growth Optimization", description: "Complete technical search engine optimization (SEO) audit and implementations including schema markup and performance optimization.", rate: 15500 },
    { label: "Monthly Maintenance & Retainer Support", description: "Monthly support retainer covering bug fixes, server monitoring, security updates, and up to 5 hours of visual edits.", rate: 12000 },
    { label: "Hourly Web Development Rate", description: "Web development consulting and implementation services (billed hourly).", rate: 2500 },
  ];

  // Invoice form and modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: "",
    clientId: "",
    clientName: "",
    clientEmail: "",
    clientAddress: "",
    clientGstOrVat: "",
    status: "unpaid" as Invoice["status"],
    issueDate: "",
    dueDate: "",
    items: [{ description: "", quantity: 1, rate: 0, amount: 0 }] as InvoiceItem[],
    subtotal: 0,
    taxRate: 18,
    taxAmount: 0,
    discountAmount: 0,
    total: 0,
    paymentMethod: "Bank Transfer",
    notes: "",
    projectId: "",
    projectName: "",
  });

  // Bill form and modal state
  const [showBillModal, setShowBillModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [billForm, setBillForm] = useState({
    billNumber: "",
    vendorName: "",
    vendorEmail: "",
    vendorPhone: "",
    category: "Hosting & Cloud",
    status: "unpaid" as Bill["status"],
    issueDate: "",
    dueDate: "",
    items: [{ description: "", quantity: 1, rate: 0, amount: 0 }] as BillItem[],
    subtotal: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 0,
    paymentMethod: "Credit Card",
    notes: "",
    projectId: "",
    projectName: "",
  });

  // Detail view state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Sync client name and contact details when client changes
  useEffect(() => {
    if (invoiceForm.clientId && clients.length > 0) {
      const selectedClient = clients.find((c) => c.id === invoiceForm.clientId);
      if (selectedClient) {
        setInvoiceForm((prev) => ({
          ...prev,
          clientName: selectedClient.name,
          clientEmail: selectedClient.email,
          clientAddress: selectedClient.notes || "", // fallback or notes field
        }));
      }
    }
  }, [invoiceForm.clientId, clients]);

  // Handle invoice project select change
  const handleInvoiceProjectChange = (projId: string) => {
    if (!projId) {
      setInvoiceForm((prev) => ({
        ...prev,
        projectId: "",
        projectName: "",
      }));
      return;
    }
    const selectedProj = projects.find((p) => p.id === projId);
    if (selectedProj) {
      const client = clients.find((c) => c.id === selectedProj.clientId);
      setInvoiceForm((prev) => ({
        ...prev,
        projectId: projId,
        projectName: selectedProj.name,
        clientId: selectedProj.clientId || "",
        clientName: selectedProj.clientName || "",
        clientEmail: client?.email || "",
        clientAddress: client?.notes || "",
      }));
    }
  };

  // Handle bill project select change
  const handleBillProjectChange = (projId: string) => {
    if (!projId) {
      setBillForm((prev) => ({
        ...prev,
        projectId: "",
        projectName: "",
      }));
      return;
    }
    const selectedProj = projects.find((p) => p.id === projId);
    if (selectedProj) {
      setBillForm((prev) => ({
        ...prev,
        projectId: projId,
        projectName: selectedProj.name,
      }));
    }
  };

  // Dynamic calculations helpers
  const getFormDate = (d: any) => {
    if (!d) return "";
    const dateObj = d instanceof Date ? d : (typeof d.toDate === "function" ? d.toDate() : new Date(d));
    return isNaN(dateObj.getTime()) ? "" : dateObj.toISOString().slice(0, 10);
  };

  // ----------------------------------------------------
  // Metrics calculations
  // ----------------------------------------------------
  const metrics = useMemo(() => {
    const totalInvoiced = invoices
      .filter((inv) => inv.status !== "cancelled" && inv.status !== "draft")
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const totalCollected = invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const totalOutstanding = invoices
      .filter((inv) => inv.status === "unpaid" || inv.status === "overdue")
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const totalExpenses = bills
      .filter((b) => b.status !== "draft")
      .reduce((sum, b) => sum + (b.total || 0), 0);

    return { totalInvoiced, totalCollected, totalOutstanding, totalExpenses };
  }, [invoices, bills]);

  // ----------------------------------------------------
  // Sync client total paid value on payment updates
  // ----------------------------------------------------
  const syncClientRevenue = async (clientId: string, allInvs: Invoice[]) => {
    if (!clientId) return;
    const clientPaidInvoices = allInvs.filter(
      (inv) => inv.clientId === clientId && inv.status === "paid"
    );
    const totalPaid = clientPaidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    const clientProjects = projects.filter((p) => p.clientId === clientId);

    try {
      await updateClient(clientId, {
        totalValue: totalPaid,
        totalProjects: clientProjects.length,
      });
      toast.success("Client revenue ledger updated!");
    } catch (err) {
      console.error("Failed to sync client revenue ledger:", err);
    }
  };

  // ----------------------------------------------------
  // Invoice Handlers
  // ----------------------------------------------------
  const openAddInvoice = () => {
    setEditingInvoice(null);
    setInvoiceForm({
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`,
      clientId: "",
      clientName: "",
      clientEmail: "",
      clientAddress: "",
      clientGstOrVat: "",
      status: "unpaid",
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      items: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
      subtotal: 0,
      taxRate: 18,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      paymentMethod: "Bank Transfer",
      notes: "",
      projectId: "",
      projectName: "",
    });
    setShowInvoiceModal(true);
  };

  const openEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setInvoiceForm({
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      clientName: inv.clientName,
      clientEmail: inv.clientEmail || "",
      clientAddress: inv.clientAddress || "",
      clientGstOrVat: inv.clientGstOrVat || "",
      status: inv.status,
      issueDate: getFormDate(inv.issueDate),
      dueDate: getFormDate(inv.dueDate),
      items: inv.items.map((it) => ({ ...it })),
      subtotal: inv.subtotal,
      taxRate: inv.taxRate || 0,
      taxAmount: inv.taxAmount || 0,
      discountAmount: inv.discountAmount || 0,
      total: inv.total,
      paymentMethod: inv.paymentMethod || "Bank Transfer",
      notes: inv.notes || "",
      projectId: inv.projectId || "",
      projectName: inv.projectName || "",
    });
    setShowInvoiceModal(true);
  };

  const calculateInvoiceTotals = (items: InvoiceItem[], taxRate: number, discountAmount: number) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = Math.max(0, subtotal + taxAmount - discountAmount);
    return { subtotal, taxAmount, total };
  };

  // Helper to apply predefined service template to a row
  const applyServiceTemplate = (index: number, label: string) => {
    const svc = AGENCY_SERVICES.find((s) => s.label === label);
    if (!svc) return;

    const nextItems = [...invoiceForm.items];
    const item = { ...nextItems[index] };
    item.description = svc.label;
    item.rate = svc.rate;
    item.amount = item.quantity * item.rate;
    nextItems[index] = item;

    const totals = calculateInvoiceTotals(nextItems, invoiceForm.taxRate, invoiceForm.discountAmount);
    setInvoiceForm((prev) => ({
      ...prev,
      items: nextItems,
      ...totals,
    }));
  };

  const handleInvoiceItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const nextItems = [...invoiceForm.items];
    const item = { ...nextItems[index] };

    if (field === "quantity") item.quantity = parseInt(value) || 0;
    else if (field === "rate") item.rate = parseFloat(value) || 0;
    else if (field === "description") item.description = value;

    item.amount = item.quantity * item.rate;
    nextItems[index] = item;

    const totals = calculateInvoiceTotals(nextItems, invoiceForm.taxRate, invoiceForm.discountAmount);
    setInvoiceForm((prev) => ({
      ...prev,
      items: nextItems,
      ...totals,
    }));
  };

  const addInvoiceItemRow = () => {
    const nextItems = [...invoiceForm.items, { description: "", quantity: 1, rate: 0, amount: 0 }];
    setInvoiceForm((prev) => ({
      ...prev,
      items: nextItems,
    }));
  };

  const removeInvoiceItemRow = (index: number) => {
    if (invoiceForm.items.length <= 1) return;
    const nextItems = invoiceForm.items.filter((_, i) => i !== index);
    const totals = calculateInvoiceTotals(nextItems, invoiceForm.taxRate, invoiceForm.discountAmount);
    setInvoiceForm((prev) => ({
      ...prev,
      items: nextItems,
      ...totals,
    }));
  };

  const handleTaxDiscountChange = (field: "taxRate" | "discountAmount", value: number) => {
    const taxRate = field === "taxRate" ? value : invoiceForm.taxRate;
    const discountAmount = field === "discountAmount" ? value : invoiceForm.discountAmount;
    const totals = calculateInvoiceTotals(invoiceForm.items, taxRate, discountAmount);
    setInvoiceForm((prev) => ({
      ...prev,
      [field]: value,
      ...totals,
    }));
  };

  const handleInvoiceSave = async () => {
    if (!invoiceForm.clientId) {
      toast.error("Please select a client");
      return;
    }
    if (!invoiceForm.invoiceNumber) {
      toast.error("Please enter an invoice number");
      return;
    }
    if (invoiceForm.items.some((it) => !it.description.trim())) {
      toast.error("Please enter a description for all items");
      return;
    }

    try {
      const action = editingInvoice ? "update" : "create";
      if (!canPerformAction(currentUserProfile?.role, "invoices", action, editingInvoice || undefined, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }

      const payload = {
        invoiceNumber: invoiceForm.invoiceNumber.trim(),
        clientId: invoiceForm.clientId,
        clientName: invoiceForm.clientName,
        clientEmail: invoiceForm.clientEmail.trim(),
        clientAddress: invoiceForm.clientAddress.trim(),
        clientGstOrVat: invoiceForm.clientGstOrVat.trim(),
        status: invoiceForm.status,
        issueDate: Timestamp.fromDate(new Date(invoiceForm.issueDate)),
        dueDate: Timestamp.fromDate(new Date(invoiceForm.dueDate)),
        items: invoiceForm.items,
        subtotal: invoiceForm.subtotal,
        taxRate: invoiceForm.taxRate,
        taxAmount: invoiceForm.taxAmount,
        discountAmount: invoiceForm.discountAmount,
        total: invoiceForm.total,
        paymentMethod: invoiceForm.paymentMethod,
        notes: invoiceForm.notes.trim(),
        createdBy: editingInvoice ? editingInvoice.createdBy : (currentUserProfile?.id || "admin"),
        projectId: invoiceForm.projectId || "",
        projectName: invoiceForm.projectName || "",
      };

      let nextInvoicesList = [...invoices];

      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, payload);
        nextInvoicesList = invoices.map((inv) =>
          inv.id === editingInvoice.id ? { ...inv, ...payload } : inv
        );
        toast.success("Invoice updated");
      } else {
        const newId = await addInvoice(payload);
        nextInvoicesList = [...invoices, { id: newId, ...payload } as Invoice];
        toast.success("Invoice created");
      }

      setShowInvoiceModal(false);
      // Sync client revenue ledger
      await syncClientRevenue(invoiceForm.clientId, nextInvoicesList);
    } catch {
      toast.error("Failed to save invoice");
    }
  };

  const handleInvoiceDelete = async (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv || !canPerformAction(currentUserProfile?.role, "invoices", "delete", inv)) {
      toast.error("Unauthorized action");
      return;
    }

    if (!confirm("Are you sure you want to delete this invoice?")) return;

    try {
      await removeInvoice(id);
      toast.success("Invoice deleted");
      const nextInvoicesList = invoices.filter((i) => i.id !== id);
      await syncClientRevenue(inv.clientId, nextInvoicesList);
    } catch {
      toast.error("Failed to delete invoice");
    }
  };

  const handleRecordPayment = async (inv: Invoice) => {
    try {
      await updateInvoice(inv.id, { status: "paid" });
      toast.success("Payment recorded successfully");
      setSelectedInvoice((prev) => prev ? { ...prev, status: "paid" } : null);

      const nextInvoicesList = invoices.map((i) =>
        i.id === inv.id ? { ...i, status: "paid" as const } : i
      );
      await syncClientRevenue(inv.clientId, nextInvoicesList);
    } catch {
      toast.error("Failed to record payment");
    }
  };

  // ----------------------------------------------------
  // Bill Handlers
  // ----------------------------------------------------
  const openAddBill = () => {
    setEditingBill(null);
    setBillForm({
      billNumber: `BILL-${new Date().getFullYear()}-${String(bills.length + 1).padStart(4, "0")}`,
      vendorName: "",
      vendorEmail: "",
      vendorPhone: "",
      category: "Hosting & Cloud",
      status: "unpaid",
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      items: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
      subtotal: 0,
      taxRate: 0,
      taxAmount: 0,
      total: 0,
      paymentMethod: "Credit Card",
      notes: "",
      projectId: "",
      projectName: "",
    });
    setShowBillModal(true);
  };

  const openEditBill = (b: Bill) => {
    setEditingBill(b);
    setBillForm({
      billNumber: b.billNumber,
      vendorName: b.vendorName,
      vendorEmail: b.vendorEmail || "",
      vendorPhone: b.vendorPhone || "",
      category: b.category,
      status: b.status,
      issueDate: getFormDate(b.issueDate),
      dueDate: getFormDate(b.dueDate),
      items: b.items.map((it) => ({ ...it })),
      subtotal: b.subtotal,
      taxRate: b.taxRate || 0,
      taxAmount: b.taxAmount || 0,
      total: b.total,
      paymentMethod: b.paymentMethod || "Credit Card",
      notes: b.notes || "",
      projectId: b.projectId || "",
      projectName: b.projectName || "",
    });
    setShowBillModal(true);
  };

  const calculateBillTotals = (items: BillItem[], taxRate: number) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleBillItemChange = (index: number, field: keyof BillItem, value: any) => {
    const nextItems = [...billForm.items];
    const item = { ...nextItems[index] };

    if (field === "quantity") item.quantity = parseInt(value) || 0;
    else if (field === "rate") item.rate = parseFloat(value) || 0;
    else if (field === "description") item.description = value;

    item.amount = item.quantity * item.rate;
    nextItems[index] = item;

    const totals = calculateBillTotals(nextItems, billForm.taxRate);
    setBillForm((prev) => ({
      ...prev,
      items: nextItems,
      ...totals,
    }));
  };

  const addBillItemRow = () => {
    const nextItems = [...billForm.items, { description: "", quantity: 1, rate: 0, amount: 0 }];
    setBillForm((prev) => ({
      ...prev,
      items: nextItems,
    }));
  };

  const removeBillItemRow = (index: number) => {
    if (billForm.items.length <= 1) return;
    const nextItems = billForm.items.filter((_, i) => i !== index);
    const totals = calculateBillTotals(nextItems, billForm.taxRate);
    setBillForm((prev) => ({
      ...prev,
      items: nextItems,
      ...totals,
    }));
  };

  const handleBillSave = async () => {
    if (!billForm.vendorName) {
      toast.error("Please enter a vendor name");
      return;
    }
    if (!billForm.billNumber) {
      toast.error("Please enter a bill/receipt number");
      return;
    }
    if (billForm.items.some((it) => !it.description.trim())) {
      toast.error("Please enter a description for all items");
      return;
    }

    try {
      const action = editingBill ? "update" : "create";
      if (!canPerformAction(currentUserProfile?.role, "bills", action, editingBill || undefined, currentUserProfile?.id)) {
        toast.error("Unauthorized action");
        return;
      }

      const payload = {
        billNumber: billForm.billNumber.trim(),
        vendorName: billForm.vendorName.trim(),
        vendorEmail: billForm.vendorEmail.trim(),
        vendorPhone: billForm.vendorPhone.trim(),
        category: billForm.category,
        status: billForm.status,
        issueDate: Timestamp.fromDate(new Date(billForm.issueDate)),
        dueDate: Timestamp.fromDate(new Date(billForm.dueDate)),
        items: billForm.items,
        subtotal: billForm.subtotal,
        taxRate: billForm.taxRate,
        taxAmount: billForm.taxAmount,
        total: billForm.total,
        paymentMethod: billForm.paymentMethod,
        notes: billForm.notes.trim(),
        createdBy: editingBill ? editingBill.createdBy : (currentUserProfile?.id || "admin"),
        projectId: billForm.projectId || "",
        projectName: billForm.projectName || "",
      };

      if (editingBill) {
        await updateBill(editingBill.id, payload);
        toast.success("Expense bill updated");
      } else {
        await addBill(payload);
        toast.success("Expense bill recorded");
      }

      setShowBillModal(false);
    } catch {
      toast.error("Failed to save bill");
    }
  };

  const handleBillDelete = async (id: string) => {
    const bill = bills.find((b) => b.id === id);
    if (!bill || !canPerformAction(currentUserProfile?.role, "bills", "delete", bill)) {
      toast.error("Unauthorized action");
      return;
    }

    if (!confirm("Are you sure you want to delete this bill record?")) return;

    try {
      await removeBill(id);
      toast.success("Bill deleted");
    } catch {
      toast.error("Failed to delete bill");
    }
  };

  // Filter lists based on roles and filters selected
  const filteredInvoices = useMemo(() => {
    const isMember = currentUserProfile?.role === "member";
    const userInvs = isMember
      ? invoices.filter((i) => i.createdBy === currentUserProfile?.id)
      : invoices;

    if (invoiceFilter === "all") return userInvs;
    return userInvs.filter((i) => i.status === invoiceFilter);
  }, [invoices, invoiceFilter, currentUserProfile]);

  const filteredBills = useMemo(() => {
    const isMember = currentUserProfile?.role === "member";
    const userBills = isMember
      ? bills.filter((b) => b.createdBy === currentUserProfile?.id)
      : bills;

    if (billFilter === "all") return userBills;
    return userBills.filter((b) => b.status === billFilter);
  }, [bills, billFilter, currentUserProfile]);

  // ----------------------------------------------------
  // Columns Definition
  // ----------------------------------------------------
  const invoiceColumns = useMemo<Column<Invoice>[]>(() => [
    {
      key: "invoiceNumber",
      label: "Invoice",
      sortable: true,
      render: (inv) => (
        <div className="font-semibold text-slate-900">{inv.invoiceNumber}</div>
      ),
    },
    {
      key: "clientName",
      label: "Client",
      sortable: true,
      render: (inv) => (
        <div>
          <p className="font-medium text-slate-800">{inv.clientName}</p>
          <p className="text-xs text-slate-400">{inv.clientEmail || "No email"}</p>
        </div>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      sortable: true,
      render: (inv) => <span className="text-slate-600 text-sm">{formatDate(inv.dueDate)}</span>,
    },
    {
      key: "total",
      label: "Amount",
      sortable: true,
      render: (inv) => <span className="font-bold text-slate-900">{formatCurrency(inv.total)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (inv) => <StatusBadge status={inv.status} />,
    },
    {
      key: "actions",
      label: "",
      render: (inv) => {
        const canEdit = canPerformAction(currentUserProfile?.role, "invoices", "update", inv, currentUserProfile?.id);
        const canDelete = canPerformAction(currentUserProfile?.role, "invoices", "delete", inv);

        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedInvoice(inv)}
              title="Print / View Detail"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600"
            >
              <Printer className="w-4 h-4" />
            </button>
            {inv.status !== "paid" && (
              <button
                onClick={() => handleRecordPayment(inv)}
                title="Mark Paid"
                className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => openEditInvoice(inv)}
                title="Edit"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleInvoiceDelete(inv.id)}
                title="Delete"
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ], [currentUserProfile, invoices]);

  const billColumns = useMemo<Column<Bill>[]>(() => [
    {
      key: "billNumber",
      label: "Receipt / Bill",
      sortable: true,
      render: (b) => <span className="font-semibold text-slate-900">{b.billNumber}</span>,
    },
    {
      key: "vendorName",
      label: "Vendor",
      sortable: true,
      render: (b) => (
        <div>
          <p className="font-medium text-slate-800">{b.vendorName}</p>
          <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-slate-100 border border-slate-200 text-slate-600 rounded mt-0.5">
            {b.category}
          </span>
        </div>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      sortable: true,
      render: (b) => <span className="text-slate-600 text-sm">{formatDate(b.dueDate)}</span>,
    },
    {
      key: "total",
      label: "Amount",
      sortable: true,
      render: (b) => <span className="font-bold text-slate-950">{formatCurrency(b.total)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: "actions",
      label: "",
      render: (b) => {
        const canEdit = canPerformAction(currentUserProfile?.role, "bills", "update", b, currentUserProfile?.id);
        const canDelete = canPerformAction(currentUserProfile?.role, "bills", "delete", b);

        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {canEdit && (
              <button
                onClick={() => openEditBill(b)}
                title="Edit"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleBillDelete(b.id)}
                title="Delete"
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ], [currentUserProfile, bills]);

  const projectLedger = useMemo(() => {
    return projects.map((p) => {
      const projInvoices = invoices.filter((inv) => inv.projectId === p.id && inv.status !== "cancelled");
      const projBills = bills.filter((b) => b.projectId === p.id);

      const totalBudget = p.budget || 0;
      const totalInvoiced = projInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const totalCollected = projInvoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + (inv.total || 0), 0);
      const totalExpenses = projBills.reduce((sum, b) => sum + (b.total || 0), 0);

      const netProfit = totalInvoiced - totalExpenses;
      const grossMargin = totalInvoiced > 0 ? (netProfit / totalInvoiced) * 100 : 100;

      return {
        id: p.id,
        projectName: p.name,
        clientName: p.clientName,
        budget: totalBudget,
        invoiced: totalInvoiced,
        collected: totalCollected,
        expenses: totalExpenses,
        netProfit,
        grossMargin,
        status: p.status,
      };
    });
  }, [projects, invoices, bills]);

  const { unlinkedRevenue, unlinkedExpenses } = useMemo(() => {
    const rev = invoices
      .filter((inv) => !inv.projectId && inv.status !== "cancelled" && inv.status !== "draft")
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
    const exp = bills
      .filter((b) => !b.projectId && b.status !== "draft")
      .reduce((sum, b) => sum + (b.total || 0), 0);
    return { unlinkedRevenue: rev, unlinkedExpenses: exp };
  }, [invoices, bills]);

  if (loadingInvoices || loadingBills) {
    return <LoadingSpinner size="lg" message="Loading billing data..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in print:p-0 print:m-0">
      {/* Inline Print Stylesheet */}
      <style>{`
        @media print {
          /* Hide all page layouts, dashboard frames, modals */
          body * {
            visibility: hidden !important;
          }
          /* Make printable invoice template visible */
          #printable-invoice, #printable-invoice * {
            visibility: visible !important;
          }
          #printable-invoice {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: white !important;
            color: black !important;
            padding: 24px !important;
            z-index: 99999 !important;
            display: block !important;
          }
        }
      `}</style>

      {/* Overview stats cards (hidden on print) */}
      <div className="print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <StatsCard
            label="Total Invoiced"
            value={formatCurrency(metrics.totalInvoiced)}
            icon={<Receipt className="w-5 h-5" />}
            color="primary"
          />
          <StatsCard
            label="Collected"
            value={formatCurrency(metrics.totalCollected)}
            icon={<TrendingUp className="w-5 h-5" />}
            color="emerald"
          />
          <StatsCard
            label="Outstanding"
            value={formatCurrency(metrics.totalOutstanding)}
            icon={<AlertCircle className="w-5 h-5" />}
            color="amber"
          />
          <StatsCard
            label="Expenses (Bills)"
            value={formatCurrency(metrics.totalExpenses)}
            icon={<DollarSign className="w-5 h-5" />}
            color="rose"
          />
        </div>

        {/* Tab Selection */}
        <div className="border-b border-slate-200 mb-6 flex items-center justify-between">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("invoices")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "invoices"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              Client Invoices
            </button>
            <button
              onClick={() => setActiveTab("bills")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "bills"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              Vendor Bills & Expenses
            </button>
            <button
              onClick={() => setActiveTab("profitability")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "profitability"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              Project Profitability Ledger
            </button>
          </div>
        </div>

        {/* Filter Toolbar & Lists */}
        {activeTab === "invoices" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              {["all", "proposal", "unpaid", "paid", "overdue", "draft", "cancelled"].map((s) => (
                <button
                  key={s}
                  onClick={() => setInvoiceFilter(s)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    invoiceFilter === s
                      ? "bg-primary-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s === "proposal" ? "Proposals" : s.charAt(0).toUpperCase() + s.slice(1)}
                  {s !== "all" && (
                    <span className="ml-1.5 text-xs opacity-75">
                      ({invoices.filter((i) => i.status === s).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <DataTable
              columns={invoiceColumns as any[]}
              data={filteredInvoices as any[]}
              searchKeys={["invoiceNumber", "clientName", "notes"]}
              searchPlaceholder="Search invoices..."
              actions={
                canPerformAction(currentUserProfile?.role, "invoices", "create") ? (
                  <button onClick={openAddInvoice} className="btn-primary">
                    <Plus className="w-4 h-4" /> New Invoice
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : activeTab === "bills" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              {["all", "proposal", "unpaid", "paid", "overdue", "draft"].map((s) => (
                <button
                  key={s}
                  onClick={() => setBillFilter(s)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    billFilter === s
                      ? "bg-primary-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s === "proposal" ? "Proposals" : s.charAt(0).toUpperCase() + s.slice(1)}
                  {s !== "all" && (
                    <span className="ml-1.5 text-xs opacity-75">
                      ({bills.filter((b) => b.status === s).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <DataTable
              columns={billColumns as any[]}
              data={filteredBills as any[]}
              searchKeys={["billNumber", "vendorName", "category"]}
              searchPlaceholder="Search bills..."
              actions={
                canPerformAction(currentUserProfile?.role, "bills", "create") ? (
                  <button onClick={openAddBill} className="btn-primary">
                    <Plus className="w-4 h-4" /> Record Bill
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Profitability Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-indigo-500/10 to-primary-600/5 dark:from-indigo-500/20 dark:to-primary-600/10 border border-primary-500/20 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider">Total Agency Revenue</span>
                  <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-905 mt-2">
                  {formatCurrency(metrics.totalCollected + metrics.totalOutstanding)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Paid: {formatCurrency(metrics.totalCollected)} | Unpaid: {formatCurrency(metrics.totalOutstanding)}</p>
              </div>

              <div className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 dark:from-rose-500/20 dark:to-rose-600/10 border border-rose-500/20 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-rose-650 dark:text-rose-400 uppercase tracking-wider">Total Direct Expenses</span>
                  <div className="p-2 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-905 mt-2">{formatCurrency(metrics.totalExpenses)}</h3>
                <p className="text-xs text-slate-500 mt-1">SaaS, Hosting, Freelancers & Operations</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/10 border border-emerald-500/20 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-emerald-650 dark:text-emerald-400 uppercase tracking-wider">Net Profit Margin</span>
                  <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>
                {(() => {
                  const netProfit = (metrics.totalCollected + metrics.totalOutstanding) - metrics.totalExpenses;
                  const marginPct = (metrics.totalCollected + metrics.totalOutstanding) > 0 
                    ? (netProfit / (metrics.totalCollected + metrics.totalOutstanding)) * 100 
                    : 0;
                  return (
                    <>
                      <h3 className={`text-2xl font-bold mt-2 ${netProfit >= 0 ? "text-slate-905" : "text-red-650"}`}>
                        {formatCurrency(netProfit)}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Average Profit Margin: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{marginPct.toFixed(1)}%</span></p>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Profitability Ledger Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">Project-by-Project Profitability Ledger</h3>
                <span className="text-xs font-semibold bg-primary-50/10 text-primary-700 px-2.5 py-1 rounded-full border border-primary-100">
                  {projects.length} Active Projects
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Project Name</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Client</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-right">Invoiced Revenue</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-right">Vendor Expenses</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-right">Net Profit</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-center">Profit Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {projectLedger.map((proj) => {
                      const marginColor = proj.grossMargin > 40 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : proj.grossMargin > 15 
                        ? "bg-blue-50 text-blue-700 border-blue-200" 
                        : proj.grossMargin >= 0 
                        ? "bg-amber-50 text-amber-700 border-amber-200" 
                        : "bg-red-50 text-red-700 border-red-200";

                      return (
                        <tr key={proj.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{proj.projectName}</p>
                              <span className="inline-block px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold rounded bg-slate-100 border border-slate-200 text-slate-500 mt-0.5">
                                {proj.status.replace("_", " ")}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{proj.clientName}</td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-900">{formatCurrency(proj.invoiced)}</td>
                          <td className="py-3.5 px-4 text-right text-slate-600">{formatCurrency(proj.expenses)}</td>
                          <td className={`py-3.5 px-4 text-right font-bold ${proj.netProfit >= 0 ? "text-slate-900" : "text-red-500"}`}>
                            {formatCurrency(proj.netProfit)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${marginColor}`}>
                              {proj.grossMargin.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* General / Unlinked row */}
                    {(unlinkedRevenue > 0 || unlinkedExpenses > 0) && (
                      <tr className="bg-slate-50/40 hover:bg-slate-50/80 transition-colors border-t border-dashed border-slate-200">
                        <td className="py-3.5 px-4 font-semibold text-slate-700 italic">
                          General Operating Ledger
                          <span className="block text-[10px] font-normal text-slate-400 not-italic">Unassociated billing / expenses</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-medium">—</td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-700">{formatCurrency(unlinkedRevenue)}</td>
                        <td className="py-3.5 px-4 text-right text-slate-600">{formatCurrency(unlinkedExpenses)}</td>
                        <td className={`py-3.5 px-4 text-right font-bold ${unlinkedRevenue - unlinkedExpenses >= 0 ? "text-slate-700" : "text-red-500"}`}>
                          {formatCurrency(unlinkedRevenue - unlinkedExpenses)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {(() => {
                            const margin = unlinkedRevenue > 0 ? ((unlinkedRevenue - unlinkedExpenses) / unlinkedRevenue) * 100 : 100;
                            return (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border bg-slate-100 text-slate-700 border-slate-300">
                                {margin.toFixed(1)}%
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* INVOICE MODAL (CREATE/EDIT)                */}
      {/* ========================================== */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title={editingInvoice ? "Edit Invoice" : "Create Invoice"}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowInvoiceModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleInvoiceSave} className="btn-primary">
              Save Invoice
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Invoice Number</label>
              <input
                className="input-field"
                value={invoiceForm.invoiceNumber}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Link to Project (Optional)</label>
              <select
                className="input-field"
                value={invoiceForm.projectId}
                onChange={(e) => handleInvoiceProjectChange(e.target.value)}
              >
                <option value="">-- Select Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Select Client</label>
              <select
                className="input-field"
                value={invoiceForm.clientId}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientId: e.target.value })}
              >
                <option value="">-- Choose Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Client Email</label>
              <input
                className="input-field"
                type="email"
                value={invoiceForm.clientEmail}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Client GSTIN / VAT (Optional)</label>
              <input
                className="input-field"
                value={invoiceForm.clientGstOrVat}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientGstOrVat: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Client Billing Address</label>
              <input
                className="input-field"
                value={invoiceForm.clientAddress}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientAddress: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Issue Date</label>
              <input
                className="input-field"
                type="date"
                value={invoiceForm.issueDate}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input
                className="input-field"
                type="date"
                value={invoiceForm.dueDate}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input-field"
                value={invoiceForm.status}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value as Invoice["status"] })}
              >
                <option value="draft">Draft</option>
                <option value="proposal">Proposal / Estimate</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select
                className="input-field"
                value={invoiceForm.paymentMethod}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value })}
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Stripe">Stripe / Online</option>
                <option value="Cash / Check">Cash / Check</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Line Items</span>
              <button
                type="button"
                onClick={addInvoiceItemRow}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {invoiceForm.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                  <div className="w-44">
                    <select
                      className="input-field py-1.5 text-xs bg-slate-100/80"
                      value=""
                      onChange={(e) => applyServiceTemplate(idx, e.target.value)}
                    >
                      <option value="">-- Apply Template --</option>
                      {AGENCY_SERVICES.map((s) => (
                        <option key={s.label} value={s.label}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <input
                      placeholder="Description"
                      className="input-field py-1.5 text-sm"
                      value={item.description}
                      onChange={(e) => handleInvoiceItemChange(idx, "description", e.target.value)}
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      className="input-field py-1.5 text-sm"
                      value={item.quantity || ""}
                      onChange={(e) => handleInvoiceItemChange(idx, "quantity", e.target.value)}
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      placeholder="Rate"
                      min="0"
                      className="input-field py-1.5 text-sm"
                      value={item.rate || ""}
                      onChange={(e) => handleInvoiceItemChange(idx, "rate", e.target.value)}
                    />
                  </div>
                  <div className="w-24 text-right pr-2 text-sm font-semibold text-slate-700">
                    {formatCurrency(item.quantity * item.rate)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInvoiceItemRow(idx)}
                    disabled={invoiceForm.items.length <= 1}
                    className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Adjustments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="label">Notes / Terms</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Payment terms, bank accounts, instructions..."
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
              />
            </div>
            <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatCurrency(invoiceForm.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-600 gap-4">
                <span>Tax Rate (%):</span>
                <input
                  type="number"
                  className="input-field py-1 w-20 text-right text-sm"
                  value={invoiceForm.taxRate}
                  onChange={(e) => handleTaxDiscountChange("taxRate", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tax Amount:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(invoiceForm.taxAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-600 gap-4">
                <span>Discount (₹):</span>
                <input
                  type="number"
                  className="input-field py-1 w-24 text-right text-sm"
                  value={invoiceForm.discountAmount || ""}
                  onChange={(e) => handleTaxDiscountChange("discountAmount", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200/60 pt-2">
                <span>Grand Total:</span>
                <span>{formatCurrency(invoiceForm.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ========================================== */}
      {/* BILL MODAL (RECORD/EDIT EXPENSE)          */}
      {/* ========================================== */}
      <Modal
        isOpen={showBillModal}
        onClose={() => setShowBillModal(false)}
        title={editingBill ? "Edit Bill Record" : "Record Expense Bill"}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowBillModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleBillSave} className="btn-primary">
              Save Expense
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Bill / Receipt Number</label>
              <input
                className="input-field"
                value={billForm.billNumber}
                onChange={(e) => setBillForm({ ...billForm, billNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Link to Project (Optional)</label>
              <select
                className="input-field"
                value={billForm.projectId}
                onChange={(e) => handleBillProjectChange(e.target.value)}
              >
                <option value="">-- Select Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input-field"
                value={billForm.category}
                onChange={(e) => setBillForm({ ...billForm, category: e.target.value })}
              >
                <option value="Hosting & Cloud">Hosting & Cloud Infrastructure (Vercel, AWS, GCP)</option>
                <option value="SaaS Subscription">SaaS Subscriptions & Licenses (GitHub, Figma, Slack, OpenAI)</option>
                <option value="Contractor Fee">Contractor & Freelancer Fees</option>
                <option value="APIs & Services">APIs & Third-party Services (Stripe, Twilio, SendGrid)</option>
                <option value="Hardware & Office">Hardware & Office Setup</option>
                <option value="Marketing">Marketing & Ads</option>
                <option value="Travel">Travel & Client Meetings</option>
                <option value="Other">Other Expenses</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Vendor Name</label>
              <input
                className="input-field"
                value={billForm.vendorName}
                onChange={(e) => setBillForm({ ...billForm, vendorName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Vendor Email</label>
              <input
                className="input-field"
                type="email"
                value={billForm.vendorEmail}
                onChange={(e) => setBillForm({ ...billForm, vendorEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Vendor Phone</label>
              <input
                className="input-field"
                value={billForm.vendorPhone}
                onChange={(e) => setBillForm({ ...billForm, vendorPhone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Issue Date</label>
              <input
                className="input-field"
                type="date"
                value={billForm.issueDate}
                onChange={(e) => setBillForm({ ...billForm, issueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input
                className="input-field"
                type="date"
                value={billForm.dueDate}
                onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input-field"
                value={billForm.status}
                onChange={(e) => setBillForm({ ...billForm, status: e.target.value as Bill["status"] })}
              >
                <option value="draft">Draft</option>
                <option value="proposal">Proposed / Quote</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select
                className="input-field"
                value={billForm.paymentMethod}
                onChange={(e) => setBillForm({ ...billForm, paymentMethod: e.target.value })}
              >
                <option value="Credit Card">Credit Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>

          {/* Bill Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Expense Details</span>
              <button
                type="button"
                onClick={addBillItemRow}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {billForm.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                  <div className="flex-1">
                    <input
                      placeholder="Description"
                      className="input-field py-1.5 text-sm"
                      value={item.description}
                      onChange={(e) => handleBillItemChange(idx, "description", e.target.value)}
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      className="input-field py-1.5 text-sm"
                      value={item.quantity || ""}
                      onChange={(e) => handleBillItemChange(idx, "quantity", e.target.value)}
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      placeholder="Rate"
                      min="0"
                      className="input-field py-1.5 text-sm"
                      value={item.rate || ""}
                      onChange={(e) => handleBillItemChange(idx, "rate", e.target.value)}
                    />
                  </div>
                  <div className="w-24 text-right pr-2 text-sm font-semibold text-slate-700">
                    {formatCurrency(item.quantity * item.rate)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBillItemRow(idx)}
                    disabled={billForm.items.length <= 1}
                    className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="label">Notes / Remarks</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Additional notes about this expense..."
                value={billForm.notes}
                onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })}
              />
            </div>
            <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 self-start">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatCurrency(billForm.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-600 gap-4">
                <span>Tax Rate (%):</span>
                <input
                  type="number"
                  className="input-field py-1 w-20 text-right text-sm"
                  value={billForm.taxRate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value) || 0;
                    const totals = calculateBillTotals(billForm.items, rate);
                    setBillForm((prev) => ({ ...prev, taxRate: rate, ...totals }));
                  }}
                />
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tax Amount:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(billForm.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200/60 pt-2">
                <span>Total Expense:</span>
                <span>{formatCurrency(billForm.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ========================================== */}
      {/* PRINT-FRIENDLY INVOICE DETAIL VIEW MODAL    */}
      {/* ========================================== */}
      {selectedInvoice && (
        <Modal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title="Invoice Details"
          size="lg"
          footer={
            <div className="flex gap-2 w-full justify-between print:hidden">
              <div>
                {selectedInvoice.status !== "paid" && (
                  <button
                    onClick={() => handleRecordPayment(selectedInvoice)}
                    className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Record Payment
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print / PDF
                </button>
                <button onClick={() => setSelectedInvoice(null)} className="btn-secondary">
                  Close
                </button>
              </div>
            </div>
          }
        >
          {/* Printable Invoice Container */}
          <div id="printable-invoice" className="bg-white text-slate-800 p-6 rounded-xl border border-slate-200/80 max-w-3xl mx-auto shadow-sm">
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
              <div>
                {/* Logo and branding */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded bg-primary-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold font-mono">S&S</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Stack & Scale</h2>
                </div>
                <p className="text-xs text-slate-400">hello@stackandscale.in</p>
                <p className="text-xs text-slate-400">Pune, Maharashtra, India</p>
                <p className="text-xs text-slate-400 font-mono">www.stackandscale.in</p>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">
                  {selectedInvoice.status === "proposal" ? "Proposal" : "Invoice"}
                </h1>
                <p className="text-sm font-semibold text-slate-700 mt-1">
                  {selectedInvoice.status === "proposal" ? "Proposal Estimate" : selectedInvoice.invoiceNumber}
                </p>
                <div className="mt-4 text-xs text-slate-400 space-y-0.5">
                  <p>Issue Date: <span className="text-slate-700 font-medium">{formatDate(selectedInvoice.issueDate)}</span></p>
                  <p>Due Date: <span className="text-slate-700 font-medium">{formatDate(selectedInvoice.dueDate)}</span></p>
                  <p>Status: <span className="text-slate-800 font-semibold capitalize">{selectedInvoice.status}</span></p>
                </div>
              </div>
            </div>

            {/* Bill To Info */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To</h3>
                <p className="font-semibold text-slate-800 text-sm">{selectedInvoice.clientName}</p>
                {selectedInvoice.clientEmail && <p className="text-xs text-slate-500 mt-0.5">{selectedInvoice.clientEmail}</p>}
                {selectedInvoice.clientAddress && <p className="text-xs text-slate-500 mt-1 whitespace-pre-line leading-relaxed">{selectedInvoice.clientAddress}</p>}
                {selectedInvoice.clientGstOrVat && (
                  <p className="text-[11px] font-mono bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 mt-2 text-slate-500 inline-block">
                    GSTIN/VAT: {selectedInvoice.clientGstOrVat}
                  </p>
                )}
              </div>
              <div className="text-right flex flex-col justify-end">
                {selectedInvoice.projectName && (
                  <div className="mb-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Project Link</h3>
                    <p className="text-xs font-semibold text-slate-750">{selectedInvoice.projectName}</p>
                  </div>
                )}
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Terms</h3>
                <p className="text-xs text-slate-600">{selectedInvoice.paymentMethod || "Bank Transfer"}</p>
                <p className="text-xs text-slate-400 mt-0.5">Please pay within 14 days of issue.</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-slate-100 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-500 uppercase">Item Description</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-500 uppercase text-center w-16">Qty</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-500 uppercase text-right w-28">Rate</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-500 uppercase text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {selectedInvoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-4 text-slate-800 font-medium">{item.description}</td>
                      <td className="py-3 px-4 text-slate-600 text-center">{item.quantity}</td>
                      <td className="py-3 px-4 text-slate-600 text-right">{formatCurrency(item.rate)}</td>
                      <td className="py-3 px-4 text-slate-800 font-semibold text-right">{formatCurrency(item.quantity * item.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex justify-end mb-6">
              <div className="w-64 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.taxRate > 0 && (
                  <div className="flex justify-between">
                    <span>Tax ({selectedInvoice.taxRate}%):</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(selectedInvoice.taxAmount)}</span>
                  </div>
                )}
                {(selectedInvoice.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount:</span>
                    <span>-{formatCurrency(selectedInvoice.discountAmount ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200/80 pt-2">
                  <span>Total Due:</span>
                  <span className="text-primary-700">{formatCurrency(selectedInvoice.total)}</span>
                </div>
              </div>
            </div>

            {/* Terms and Signatures */}
            {selectedInvoice.notes && (
              <div className="border-t border-slate-100 pt-4 mt-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Notes / Instructions</h4>
                <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">{selectedInvoice.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
