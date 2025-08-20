"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import TabNavigation, { useTabNavigation } from "@/app/components/TabNavigation";
import RecordPaymentModal from "@/app/components/finance/RecordPaymentModal";
import EditPaymentModal, { EditablePayment } from "@/app/components/finance/EditPaymentModal";
import InvoiceDetailModal from "@/app/components/finance/InvoiceDetailModal";
import PaymentDetailModal from "@/app/components/finance/PaymentDetailModal";
import BankAccountModal from "@/app/components/finance/BankAccountModal";
import DeleteBankConfirmModal from "@/app/components/finance/DeleteBankConfirmModal";
import BankAccountDetailModal from "@/app/components/finance/BankAccountDetailModal";
import ErrorBoundary from "@/app/components/ErrorBoundary";
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
  Eye,
  Mail,
  Send,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building2,
  Edit,
  Trash2
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { getCurrentFiscalYear, getFiscalYearOptions, getFiscalYearLabel } from "@/app/utils/fiscalYear";
import { useMutation } from "convex/react";

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
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isDeleteBankModalOpen, setIsDeleteBankModalOpen] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState<any>(null);
  const [isBankDetailModalOpen, setIsBankDetailModalOpen] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
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
  const revenueByType = useQuery(api.finance.getRevenueByCustomerType, { fiscalYear: selectedYear });
  const topCustomers = useQuery(api.finance.getTopCustomers, { limit: 5, fiscalYear: selectedYear });
  
  // Fetch invoices data
  const invoices = useQuery(api.invoices.list, { fiscalYear: selectedYear });
  const invoiceStats = useQuery(api.finance.getInvoiceStats, { fiscalYear: selectedYear });
  
  // Fetch payments data
  const payments = useQuery(api.payments.list, { fiscalYear: selectedYear });
  const paymentStats = useQuery(api.payments.getStats, { fiscalYear: selectedYear });
  
  // Fetch banks data
  const bankAccounts = useQuery(api.banks.list);
  const bankStats = useQuery(api.banks.getStats);
  
  // Mutations
  const deletePayment = useMutation(api.payments.deletePayment);

  const formatCurrency = (amount: number, currency: 'USD' | 'PKR' = 'USD') => {
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-PK', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

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
        invoice.order?.orderNumber?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    if (invoiceStatusFilter !== "all" && invoice.status !== invoiceStatusFilter) {
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
          if (invoice.dueDate >= now || invoice.outstandingBalance === 0) return false;
          break;
      }
    }

    return true;
  });

  const COLORS = ["#B8621B", "#D4722C", "#96501A", "#E88A3C", "#A65E2A"];

  // Prepare pie chart data for revenue by type
  const pieData = revenueByType ? [
    { name: "Local", value: revenueByType.local.revenue },
    { name: "International", value: revenueByType.international.revenue },
  ].filter(d => d.value > 0) : [];

  return (
    <ErrorBoundary>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-gray-900">{formatCurrency(dashboardStats?.totalRevenueUSD || 0, 'USD')} <span className="text-xs text-gray-500">USD</span></p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(dashboardStats?.totalRevenuePKR || 0, 'PKR')} <span className="text-xs text-gray-500">PKR</span></p>
              </div>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Paid</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidUSD || 0, 'USD')} <span className="text-xs text-gray-500">USD</span></p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboardStats?.totalPaidPKR || 0, 'PKR')} <span className="text-xs text-gray-500">PKR</span></p>
              </div>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Outstanding</p>
              <div className="mt-1 space-y-1">
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingUSD || 0, 'USD')} <span className="text-xs text-gray-500">USD</span></p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboardStats?.totalOutstandingPKR || 0, 'PKR')} <span className="text-xs text-gray-500">PKR</span></p>
              </div>
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

            {/* Revenue by Type Pie Chart */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Revenue by Customer Type
              </h2>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(((percent ?? 0) * 100).toFixed(0))}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value), 'USD')} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Top Customers */}
          {topCustomers && topCustomers.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Top Customers by Revenue
              </h2>
              <div className="space-y-3">
                {topCustomers.map((customer, index) => (
                  <div key={customer.clientId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-xs text-gray-500">
                          {customer.city}, {customer.country} • {customer.orderCount} orders
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(customer.revenue, customer.type === 'local' ? 'PKR' : 'USD')}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        customer.type === "local" 
                          ? "bg-blue-100 text-blue-800" 
                          : "bg-green-100 text-green-800"
                      }`}>
                        {customer.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          {/* Payment Statistics */}
          {paymentStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-4">
                <p className="text-sm text-gray-500">Total Payments</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {paymentStats.totalCount}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Total Amount (USD)</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(paymentStats.totalAmountUSD || 0, 'USD')}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Total Amount (PKR)</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(paymentStats.totalAmountPKR || 0, 'PKR')}
                </p>
              </div>
            </div>
          )}

          {/* Payment Methods Breakdown removed: only Bank Transfer is used */}

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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[18%]">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[22%]">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[18%]">Invoice</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">Reference</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">Bank Account</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[8%]">View</th>
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
                        <span className="truncate inline-block max-w-[220px] align-middle" title={payment.client?.name || "-"}>
                          {payment.client?.name || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="truncate inline-block max-w-[180px]" title={payment.invoice?.invoiceNumber || "-"}>
                          {payment.invoice?.invoiceNumber || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${payment.type === "advance" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>
                          {payment.type === "advance" ? "Advance" : "Invoice"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{formatCurrency(payment.amount, (payment as any).currency === 'PKR' ? 'PKR' : 'USD')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payment.reference}</td>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <Eye className="h-4 w-4" />
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

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <div className="space-y-6">
          {/* Invoice Statistics */}
          {invoiceStats && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Total Outstanding</p>
                <div className="mt-1 space-y-1">
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(invoiceStats.totalOutstandingUSD || 0, 'USD')} <span className="text-xs text-gray-500">USD</span></p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(invoiceStats.totalOutstandingPKR || 0, 'PKR')} <span className="text-xs text-gray-500">PKR</span></p>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Total Paid</p>
                <div className="mt-1 space-y-1">
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(invoiceStats.totalPaidUSD || 0, 'USD')} <span className="text-xs text-gray-500">USD</span></p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(invoiceStats.totalPaidPKR || 0, 'PKR')} <span className="text-xs text-gray-500">PKR</span></p>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Overdue</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {invoiceStats.overdueCount}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Total Invoices</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {invoiceStats.totalCount}
                </p>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
            </select>

            <select
              value={invoiceDateFilter}
              onChange={(e) => setInvoiceDateFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Dates</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="overdue">Overdue</option>
            </select>

            <div className="flex items-center text-sm text-gray-600">
              {invoices ? `${filteredInvoices?.length || 0} invoices found` : <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />}
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
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[6%]">
                      Actions
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
                        <td className="px-6 py-4"><div className="w-8 h-4 bg-gray-200 rounded animate-pulse" /></td>
                      </tr>
                    ))
                  ) : filteredInvoices?.length === 0 ? (
                    // Empty state
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <FileText className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Invoices will appear here when orders are confirmed.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    // Invoice rows
                    filteredInvoices?.map((invoice) => (
                      <tr
                        key={invoice._id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedInvoiceId(invoice._id);
                          setIsInvoiceModalOpen(true);
                        }}
                      >
                        <td className="px-4 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{invoice.invoiceNumber || "N/A"}</div>
                            <div className="text-xs text-gray-500">Order: {invoice.order?.orderNumber}</div>
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
                            {new Date(invoice.issueDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(invoice.amount, (invoice as any).currency === 'PKR' ? 'PKR' : 'USD')}
                          </div>
                          <div className="text-xs text-gray-500">
                            Paid: {formatCurrency(invoice.totalPaid, (invoice as any).currency === 'PKR' ? 'PKR' : 'USD')}
                          </div>
                          {invoice.outstandingBalance > 0 && (
                            <div className="text-xs text-red-600 font-medium">
                              Outstanding: {formatCurrency(invoice.outstandingBalance, (invoice as any).currency === 'PKR' ? 'PKR' : 'USD')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full ${getStatusColor(invoice.status)}`}>
                            {getStatusIcon(invoice.status)}
                            <span className="ml-1 capitalize">
                              {invoice.status.replace("_", " ")}
                            </span>
                          </span>
                        </td>
                        <td className="py-2 text-sm text-center">
                          <div className="flex items-center justify-center">
                            <button
                              className="flex items-center justify-center w-8 h-8 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                              title="View Details"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInvoiceId(invoice._id);
                                setIsInvoiceModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
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

      {/* Banks Tab */}
      {activeTab === "banks" && (
        <div className="space-y-6">
          {/* Bank Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Accounts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {bankStats?.totalAccounts || 0}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Active Accounts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {bankStats?.activeAccounts || 0}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Currencies</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Object.keys(bankStats?.accountsByCurrency || {}).length}
              </p>
            </div>
          </div>

          {/* Bank Accounts Table */}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">
                      Account Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                      Bank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                      Currency
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[5%]">
                      View
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
                          <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="animate-pulse h-4 bg-gray-200 rounded w-1/3"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="animate-pulse h-4 bg-gray-200 rounded w-2/3"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="animate-pulse h-6 bg-gray-200 rounded w-16"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="animate-pulse h-4 bg-gray-200 rounded w-8"></div>
                        </td>
                      </tr>
                    ))
                  ) : bankAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
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
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {account.accountType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{account.currency}</div>
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
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center justify-center">
                            <Eye className="h-4 w-4 text-gray-400" />
                          </div>
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
    </ErrorBoundary>
  );
}