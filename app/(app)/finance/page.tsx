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

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    // Use appropriate locale based on currency
    const locale = currency === 'USD' ? 'en-US' : 
                   currency === 'PKR' ? 'en-PK' : 'en-US';
    return new Intl.NumberFormat(locale, {
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
  ].filter((d) => d.value > 0) : [];

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
          <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
          <p>Dashboard content will be here</p>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
          <p>Invoices content will be here</p>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
          <p>Payments content will be here</p>
        </div>
      )}

      {/* Banks Tab */}
      {activeTab === "banks" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Banks</h2>
          <p>Banks content will be here</p>
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
  );
}