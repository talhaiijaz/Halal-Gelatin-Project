"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import TabNavigation, { useTabNavigation } from "@/app/components/TabNavigation";
import RecordPaymentModal from "@/app/components/finance/RecordPaymentModal";
import EditPaymentModal, { EditablePayment } from "@/app/components/finance/EditPaymentModal";
import InvoiceDetailModal from "@/app/components/finance/InvoiceDetailModal";
import PaymentDetailModal from "@/app/components/finance/PaymentDetailModal";
import BankAccountModal from "@/app/components/finance/BankAccountModal";
import DeleteBankConfirmModal from "@/app/components/finance/DeleteBankConfirmModal";
import BankAccountDetailModal from "@/app/components/finance/BankAccountDetailModal";
import BankingDashboard from "@/app/components/finance/BankingDashboard";
import { 
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Calendar,
  CreditCard,
  Plus,
  Download,
  FileText,
  ChevronUp,
  ChevronDown,
  Search,
  Mail,
  Send,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building2,
  Edit,
  Trash2,
  Settings
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { getCurrentFiscalYear, getFiscalYearOptions, getFiscalYearLabel } from "@/app/utils/fiscalYear";
import { formatDateForDisplay } from "@/app/utils/dateUtils";
import { useMutation } from "convex/react";
import { formatCurrency, type SupportedCurrency } from "@/app/utils/currencyFormat";

// Note: formatCurrency is now imported from utils/currencyFormat

export default function FinancePage() {
  // Calculate current fiscal year
  const currentFiscalYear = getCurrentFiscalYear();
  
  const [selectedYear, setSelectedYear] = useState(currentFiscalYear);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [preselectedInvoiceId, setPreselectedInvoiceId] = useState<string | null>(null);
  const [preselectedClientId, setPreselectedClientId] = useState<string | null>(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [invoiceDateFilter, setInvoiceDateFilter] = useState("all");
  const [invoiceOrderStatusFilter, setInvoiceOrderStatusFilter] = useState("all");
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isDeleteBankModalOpen, setIsDeleteBankModalOpen] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState<any>(null);
  const [isBankDetailModalOpen, setIsBankDetailModalOpen] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<Id<"bankAccounts"> | null>(null);
  const [isEditBankModalOpen, setIsEditBankModalOpen] = useState(false);
  const [bankAccountToEdit, setBankAccountToEdit] = useState<any>(null);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<EditablePayment | null>(null);
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "invoices", label: "Invoices", icon: <FileText className="h-4 w-4" /> },
    { id: "payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
    { id: "banks", label: "Banks", icon: <Building2 className="h-4 w-4" /> },
  ];

  const { activeTab, setActiveTab } = useTabNavigation(tabs, "dashboard");

  // Fetch dashboard data
  const dashboardStats = useQuery(api.finance.getDashboardStats, { year: selectedYear });
  const monthlyStats = useQuery(api.finance.getMonthlyOrderStats, { year: selectedYear });
  
  // Fetch invoices data
  const invoices = useQuery(api.invoices.list, { fiscalYear: selectedYear });
  const invoiceStats = useQuery(api.finance.getInvoiceStats, { fiscalYear: selectedYear });
  
  // Fetch payments data
  const payments = useQuery(api.payments.list, { fiscalYear: selectedYear });
  const paymentStats = useQuery(api.payments.getStats, { fiscalYear: selectedYear });
  
  // Fetch banks data
  const bankAccounts = useQuery(api.banks.listWithBalances);
  const bankStats = useQuery(api.banks.getStats);
  
  // Mutations
  const deletePayment = useMutation(api.payments.deletePayment);

  // Note: formatCurrency is now imported from utils/currencyFormat

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      bank_transfer: "Bank Transfer",
      check: "Check",
      cash: "Cash",
      credit_card: "Credit Card",
      other: "Other",
    };
    return labels[method] || method;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "unpaid":
        return <Clock className="h-4 w-4" />;
      case "partially_paid":
        return <DollarSign className="h-4 w-4" />;
      case "paid":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "unpaid":
        return "bg-red-100 text-red-800";
      case "partially_paid":
        return "bg-orange-100 text-orange-800";
      case "paid":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Filter invoices
  const filteredInvoices = invoices?.filter(invoice => {
    if (invoiceSearchQuery) {
      const searchLower = invoiceSearchQuery.toLowerCase();
      const matchesSearch = 
        invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
        invoice.client?.name?.toLowerCase().includes(searchLower) ||
        invoice.invoiceNumber?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    if (invoiceStatusFilter !== "all" && invoice.status !== invoiceStatusFilter) {
      return false;
    }

    if (invoiceOrderStatusFilter !== "all" && invoice.order?.status !== invoiceOrderStatusFilter) {
      return false;
    }

    if (invoiceDateFilter !== "all") {
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);
      
      switch (invoiceDateFilter) {
        case "thisMonth":
          const thisMonthStart = new Date(now).setDate(1);
          if (invoice.issueDate < thisMonthStart) return false;
          break;
        case "lastMonth":
          const dNow = new Date(now);
          const lastMonthDate = new Date(dNow.getFullYear(), dNow.getMonth() - 1, 1);
          const lastMonthStart = lastMonthDate.getTime();
          const lastMonthEnd = new Date(dNow.getFullYear(), dNow.getMonth(), 1).getTime() - 1;
          if (invoice.issueDate < lastMonthStart || invoice.issueDate > lastMonthEnd) return false;
          break;
        case "overdue":
          // Only consider shipped/delivered orders as overdue
          const shouldShowOutstanding = invoice.order?.status === "shipped" || invoice.order?.status === "delivered";
          const outstandingAmount = shouldShowOutstanding ? invoice.outstandingBalance : 0;
          if (invoice.dueDate >= now || outstandingAmount === 0) return false;
          break;
      }
    }

    return true;
  });

  // Sort filtered invoices: first by fiscal year, then by order status, then by creation date
  const statusPriority = {
    pending: 1,
    in_production: 2,
    shipped: 3,
    delivered: 4,
    cancelled: 5
  };

  const sortedInvoices = filteredInvoices?.sort((a, b) => {
    // First sort by order status priority (pending first, then in_production, shipped, delivered, cancelled)
    const statusA = statusPriority[a.order?.status as keyof typeof statusPriority] || 6;
    const statusB = statusPriority[b.order?.status as keyof typeof statusPriority] || 6;
    if (statusA !== statusB) {
      return statusA - statusB;
    }
    // Then sort by invoice creation date (descending - latest first)
    return b.issueDate - a.issueDate;
  });
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor financial performance and manage payments
          </p>
        </div>
        <button
          onClick={() => setIsRecordPaymentOpen(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </button>
      </div>

      {/* Fiscal Year Selector - Top Level */}
      <div className="mb-6 flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Fiscal Year:</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
        >
          {getFiscalYearOptions().map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* Tab Navigation */}
      <TabNavigation
        tabs={tabs}
        defaultTab={activeTab}
        onTabChange={setActiveTab}
        className="mb-6"
      />

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Fiscal Year Sales Summary */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {getFiscalYearLabel(selectedYear)} Sales Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-2">
                  <Package className="h-8 w-8 text-primary" />
                  {dashboardStats && (
                    <span className="text-xs text-gray-500">
                      {dashboardStats.activeOrders} active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">Number of Orders</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {dashboardStats?.numberOfOrders || 0}
                </p>
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between mb-2">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-sm text-gray-500">Total Quantity (KG)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatNumber(dashboardStats?.totalQuantityKg || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Summary (split by currency) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Current Pending Orders Value</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValueUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValuePKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValueEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValueAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Pending and in production orders only
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Received</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidPKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Includes converted amounts from international payments
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Advance Payments</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsPKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Payments received before invoicing
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Receivables</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingPKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Only for shipped/delivered orders
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly Orders Chart */}
            <div className="lg:col-span-2 card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Number of Orders per Month
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyStats || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatNumber(Number(value))} />
                  <Legend />
                  <Bar dataKey="orders" fill="#B8621B" name="Total Orders" />
                  <Bar dataKey="activeOrders" fill="#4ADE80" name="Active Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>

        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <div className="space-y-6">
          {/* Financial Summary Cards - Same as Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Current Pending Orders Value</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValueUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValuePKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValueEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValueAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Pending and in production orders only
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Received</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidPKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Includes converted amounts from international payments
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Advance Payments</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsPKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Payments received before invoicing
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Receivables</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingPKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Only for shipped/delivered orders
              </p>
            </div>
          </div>

          

          {/* Search and Filters */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              {/* Universal Search */}
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={invoiceSearchQuery}
                    onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                    placeholder="Search invoices, clients..."
                    className="pl-10 pr-3 py-2 w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Invoice Status Filter */}
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Status</label>
                <select
                  value={invoiceStatusFilter}
                  onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Status</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {/* Order Status Filter */}
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
                <select
                  value={invoiceOrderStatusFilter}
                  onChange={(e) => setInvoiceOrderStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Order Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_production">In Production</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <select
                  value={invoiceDateFilter}
                  onChange={(e) => setInvoiceDateFilter(e.target.value)}
                  className="w-full px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Dates</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4 flex items-center text-sm text-gray-600">
              {invoices ? `${sortedInvoices?.length || 0} invoices found` : <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />}
            </div>
          </div>

          {/* Invoices Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[18%]">
                      Invoice
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[22%]">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[16%]">
                      Issue Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[16%]">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">
                      Order Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!invoices ? (
                    // Loading skeletons
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><div className="w-20 h-4 bg-gray-200 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="w-32 h-4 bg-gray-200 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="w-24 h-4 bg-gray-200 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="w-16 h-4 bg-gray-200 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="w-16 h-4 bg-gray-200 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="w-16 h-4 bg-gray-200 rounded animate-pulse" /></td>
                      </tr>
                    ))
                  ) : sortedInvoices?.length === 0 ? (
                    // Empty state
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <FileText className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Invoices will appear here once orders move to production.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    // Invoice rows
                    sortedInvoices?.map((invoice) => (
                      <tr
                        key={invoice._id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedInvoiceId(invoice._id);
                          setIsInvoiceModalOpen(true);
                        }}
                      >
                        <td className="px-4 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{invoice.invoiceNumber || "N/A"}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 min-w-0">
                          <div className="min-w-0">
                            <div className="text-sm text-gray-900 truncate" title={invoice.client?.name}>
                              {invoice.client?.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate" title={invoice.client?.email}>
                              {invoice.client?.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDateForDisplay(invoice.issueDate)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(invoice.amount, invoice.currency as SupportedCurrency)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Paid: {formatCurrency(invoice.totalPaid, invoice.currency as SupportedCurrency)}
                            {invoice.advancePaid > 0 && (
                              <span className="text-blue-600">
                                {" "}({formatCurrency(invoice.advancePaid, invoice.currency as SupportedCurrency)} advance)
                              </span>
                            )}
                          </div>
                          {(() => {
                            // Only show outstanding for shipped/delivered orders
                            const shouldShowOutstanding = invoice.order?.status === "shipped" || invoice.order?.status === "delivered";
                            const outstandingAmount = shouldShowOutstanding ? invoice.outstandingBalance : 0;
                            
                            return outstandingAmount > 0 && (
                              <div className="text-xs text-red-600 font-medium">
                                Receivables: {formatCurrency(outstandingAmount, invoice.currency as SupportedCurrency)}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full ${getStatusColor(invoice.status)}`}>
                            {getStatusIcon(invoice.status)}
                            <span className="ml-1 capitalize">
                              {invoice.status.replace("_", " ")}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            invoice.order?.status === "delivered" 
                              ? "bg-green-100 text-green-800" 
                              : invoice.order?.status === "shipped"
                              ? "bg-blue-100 text-blue-800"
                              : invoice.order?.status === "in_production"
                              ? "bg-purple-100 text-purple-800"
                              : invoice.order?.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : invoice.order?.status === "cancelled"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {invoice.order?.status || "N/A"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          {/* Financial Summary Cards - Same as Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Current Pending Orders Value</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValueUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValuePKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValueEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as any)?.pendingOrdersValueAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Pending and in production orders only
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Received</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidPKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Includes converted amounts from international payments
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Advance Payments</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsPKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(dashboardStats?.advancePaymentsAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Payments received before invoicing
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Receivables</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingUSD || 0, 'USD')}</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingPKR || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingEUR || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingAED || 0, 'AED')}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Only for shipped/delivered orders
              </p>
            </div>
          </div>

          

          {/* Payments History */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Payment History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[18%]">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">Invoice</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[8%]">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[22%]">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[26%]">Bank Account</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments?.map((payment) => (
                    <tr 
                      key={payment._id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedPaymentId(payment._id as string);
                        setIsPaymentDetailOpen(true);
                      }}
                      title="Click to view payment details"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(payment.paymentDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <span className="truncate inline-block max-w-[180px] align-middle" title={payment.client?.name || "-"}>
                            {payment.client?.name || "-"}
                          </span>
                          {payment.client?.type && (
                            <div className="text-xs text-gray-500">
                              {payment.client.type === "local" ? "Local" : "International"}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="truncate inline-block max-w-[140px]" title={payment.invoice?.invoiceNumber || "-"}>
                          {payment.invoice?.invoiceNumber || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${payment.type === "advance" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>
                          {payment.type === "advance" ? "Advance" : "Invoice"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-green-600">{formatCurrency(payment.amount, payment.currency as SupportedCurrency)}</div>
                        {/* Show conversion info only for actual currency mismatches */}
                        {(() => {
                          const bankAccount = (payment as any).bankAccount;
                          const hasConversionFields = payment.convertedAmountUSD && payment.convertedAmountUSD !== payment.amount;
                          const currencyMismatch = bankAccount && bankAccount.currency !== payment.currency;
                          
                          if (hasConversionFields && currencyMismatch && payment.convertedAmountUSD) {
                            return (
                              <div className="text-xs text-gray-500">
                                ≈ {formatCurrency(payment.convertedAmountUSD, bankAccount.currency as SupportedCurrency)}
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {/* Show withholding info for local payments */}
                        {(payment as any).withheldTaxAmount && (payment as any).withheldTaxAmount > 0 && (
                          <div className="text-xs text-orange-600">
                            -{formatCurrency((payment as any).withheldTaxAmount, payment.currency as SupportedCurrency)} withheld
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.bankAccount ? (
                          <div>
                            <div className="text-sm font-medium">{payment.bankAccount.accountName}</div>
                            <div className="text-xs text-gray-500">{payment.bankAccount.bankName}</div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments?.length === 0 && (
                <div className="text-center py-8 text-gray-500">No payments recorded yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Banks Tab */}
      {activeTab === "banks" && (
        <div className="space-y-6">
          {/* Banking System Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Banking System</h2>
              <p className="text-sm text-gray-600 mt-1">
                Comprehensive bank account management and transaction tracking
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedBankAccount(null);
                setIsBankModalOpen(true);
              }}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Bank Account</span>
            </button>
          </div>

          {/* Bank Account Selection */}
          {bankAccounts && bankAccounts.length > 0 && (
            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Bank Account</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bankAccounts.map((account) => (
                  <div
                    key={account._id}
                    className={`p-4 border rounded-lg transition-colors ${
                      selectedBankAccountId === account._id
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => setSelectedBankAccountId(account._id)}
                      >
                        <h4 className="font-medium text-gray-900">{account.accountName}</h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBankAccountToEdit(account);
                            setIsEditBankModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit bank account"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          account.status === "active" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {account.status}
                        </span>
                      </div>
                    </div>
                    <div 
                      className="cursor-pointer"
                      onClick={() => setSelectedBankAccountId(account._id)}
                    >
                      <p className="text-sm text-gray-600 mb-1">{account.bankName}</p>
                      <p className="text-sm text-gray-500 mb-2">#{account.accountNumber}</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {account.currentBalance !== undefined 
                          ? formatCurrency(account.currentBalance, account.currency as SupportedCurrency)
                          : "-"
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banking Dashboard */}
          {selectedBankAccountId && (
            <BankingDashboard bankAccountId={selectedBankAccountId} />
          )}

          {/* Empty State */}
          {bankAccounts && bankAccounts.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No bank accounts</h3>
              <p className="mt-1 text-sm text-gray-500">
                Start by adding your first bank account to begin managing transactions.
              </p>
              <div className="mt-4">
                <button
                  onClick={() => {
                    setSelectedBankAccount(null);
                    setIsBankModalOpen(true);
                  }}
                  className="btn-primary flex items-center space-x-2 mx-auto"
                >
                  <Plus className="h-4 w-4" />
                  Add Bank Account
                </button>
              </div>
            </div>
          )}

          {/* Legacy Bank Accounts Table - Hidden for now */}
          <div className="hidden">
            <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Bank Accounts
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage your bank accounts and view balances
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedBankAccount(null);
                    setIsBankModalOpen(true);
                  }}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Bank Account</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[20%]">
                      Account Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                      Bank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                      Currency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[20%]">
                      Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!bankAccounts ? (
                    // Loading skeletons
                    [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4">
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="animate-pulse h-4 bg-gray-200 rounded w-2/3"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="animate-pulse h-4 bg-gray-200 rounded w-1/3"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="animate-pulse h-4 bg-gray-200 rounded w-2/3"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="animate-pulse h-4 bg-gray-200 rounded w-2/3"></div>
                        </td>
                      </tr>
                    ))
                  ) : bankAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No bank accounts</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Start by adding your first bank account.
                        </p>
                        <div className="mt-6">
                          <button
                            onClick={() => {
                              setSelectedBankAccount(null);
                              setIsBankModalOpen(true);
                            }}
                            className="btn-primary"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Bank Account
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    // Bank account rows
                    bankAccounts.map((account) => (
                      <tr 
                        key={account._id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedBankAccountId(account._id);
                          setIsBankDetailModalOpen(true);
                        }}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{account.accountName}</div>
                            <div className="text-xs text-gray-500">#{account.accountNumber}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{account.bankName}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{account.currency}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {account.currentBalance !== undefined 
                              ? formatCurrency(account.currentBalance, account.currency as SupportedCurrency)
                              : "-"
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            account.status === "active" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {account.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => {
          setIsRecordPaymentOpen(false);
          setPreselectedInvoiceId(null);
          setPreselectedClientId(null);
        }}
        preselectedInvoiceId={preselectedInvoiceId as any}
        preselectedClientId={preselectedClientId as any}
      />

      <InvoiceDetailModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoiceId={selectedInvoiceId as any}
        onRecordPayment={(invId, clientId) => {
          setIsInvoiceModalOpen(false);
          setPreselectedInvoiceId(invId as any);
          setPreselectedClientId(clientId as any);
          setIsRecordPaymentOpen(true);
        }}
      />

      {/* Bank Account Modal */}
      <BankAccountModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        bankAccount={selectedBankAccount}
        onSuccess={() => {
          // Refresh data
        }}
      />

      {/* Delete Bank Confirmation Modal */}
      <DeleteBankConfirmModal
        isOpen={isDeleteBankModalOpen}
        onClose={() => setIsDeleteBankModalOpen(false)}
        bankAccount={selectedBankAccount}
        onSuccess={() => {
          // Refresh data
        }}
      />

      {/* Edit Bank Account Modal */}
      <BankAccountModal
        isOpen={isEditBankModalOpen}
        onClose={() => {
          setIsEditBankModalOpen(false);
          setBankAccountToEdit(null);
        }}
        onSuccess={() => {
          setIsEditBankModalOpen(false);
          setBankAccountToEdit(null);
          // Refresh data
        }}
        bankAccount={bankAccountToEdit}
      />

      <EditPaymentModal
        isOpen={isEditPaymentOpen}
        onClose={() => setIsEditPaymentOpen(false)}
        payment={selectedPayment}
      />

      {/* Payment Detail Modal */}
      <PaymentDetailModal
        isOpen={isPaymentDetailOpen}
        onClose={() => {
          setIsPaymentDetailOpen(false);
          setSelectedPaymentId(null);
        }}
        paymentId={selectedPaymentId as any}
      />

      {/* Bank Account Detail Modal */}
      <BankAccountDetailModal
        isOpen={isBankDetailModalOpen}
        onClose={() => {
          setIsBankDetailModalOpen(false);
          setSelectedBankAccountId(null);
        }}
        bankAccountId={selectedBankAccountId as any}
      />
    </div>
  );
}
