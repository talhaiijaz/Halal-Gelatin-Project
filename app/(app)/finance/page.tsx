"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import TabNavigation, { useTabNavigation } from "@/app/components/TabNavigation";
import RecordPaymentModal from "@/app/components/finance/RecordPaymentModal";
import EditPaymentModal from "@/app/components/finance/EditPaymentModal";
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
  CreditCard,
  Plus,
  FileText,
  Clock,
  CheckCircle,
  Building2,
  Settings
} from "lucide-react";
 

import { getCurrentFiscalYear, getFiscalYearLabel } from "@/app/utils/fiscalYear";
import { formatDateForDisplay } from "@/app/utils/dateUtils";
// import { useMutation } from "convex/react";
import { formatCurrency, type SupportedCurrency } from "@/app/utils/currencyFormat";
import { usePagination } from "@/app/hooks/usePagination";
import Pagination from "@/app/components/ui/Pagination";
import { shouldHighlightOrderYellowWithTransfers, shouldHighlightOrderRed, getOrderHighlightClassesWithRed, getOrderTextHighlightClassesWithRed } from "@/app/utils/orderHighlighting";

// Note: formatCurrency is now imported from utils/currencyFormat

export default function FinancePage() {
  // Calculate current fiscal year
  const currentFiscalYear = getCurrentFiscalYear();
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [preselectedInvoiceId, setPreselectedInvoiceId] = useState<string | null>(null);
  const [preselectedClientId, setPreselectedClientId] = useState<string | null>(null);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isDeleteBankModalOpen, setIsDeleteBankModalOpen] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState<Record<string, unknown> | null>(null);
  const [isBankDetailModalOpen, setIsBankDetailModalOpen] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<Id<"bankAccounts"> | null>(null);
  const [isEditBankModalOpen, setIsEditBankModalOpen] = useState(false);
  const [bankAccountToEdit, setBankAccountToEdit] = useState<Record<string, unknown> | null>(null);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  // const [selectedPayment, setSelectedPayment] = useState<EditablePayment | null>(null);
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  
  // Search states
  const [invoicesSearchTerm, setInvoicesSearchTerm] = useState("");
  const [paymentsSearchTerm, setPaymentsSearchTerm] = useState("");
  const [pakistanSearchTerm, setPakistanSearchTerm] = useState("");
  
  // Filter states
  const [invoicesStatusFilter, setInvoicesStatusFilter] = useState<string>("all");
  const [pakistanTransferFilter, setPakistanTransferFilter] = useState<string>("all");
  
  // Pagination hooks
  const paymentsPagination = usePagination({ pageSize: 10 });
  const invoicesPagination = usePagination({ pageSize: 10 });
  const pakistanFilterPagination = usePagination({ pageSize: 10 });

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "invoices", label: "Invoices", icon: <FileText className="h-4 w-4" /> },
    { id: "payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
    { id: "banks", label: "Banks", icon: <Building2 className="h-4 w-4" /> },
  ];

  const { activeTab, setActiveTab } = useTabNavigation(tabs, "dashboard");

  // Reset Pakistan filter pagination when filter changes
  useEffect(() => {
    pakistanFilterPagination.goToPage(0);
  }, [pakistanTransferFilter, invoicesStatusFilter]);

  // Fetch dashboard data
  const dashboardStats = useQuery(api.finance.getDashboardStats, { year: currentFiscalYear });
  
  // Fetch invoices data with pagination
  const invoicesData = useQuery(api.invoices.list, { 
    search: invoicesSearchTerm || undefined,
    status: invoicesStatusFilter !== "all" ? invoicesStatusFilter : undefined,
    paginationOpts: invoicesPagination.paginationOpts
  });

  // Fetch all invoices for Pakistan transfer filtering (needed for the Invoices tab)
  const allInvoicesForPakistanFilter = useQuery(api.invoices.list, {
    paginationOpts: { numItems: 1000, cursor: null }
  });
  // const invoiceStats = useQuery(api.finance.getInvoiceStats, { 
  //   fiscalYear: invoiceFiscalYearFilter === "all" ? undefined : invoiceFiscalYearFilter
  // });
  
  // Fetch payments data with pagination
  const paymentsData = useQuery(api.payments.list, { 
    searchTerm: paymentsSearchTerm || undefined,
    paginationOpts: paymentsPagination.paginationOpts
  });
  // const paymentStats = useQuery(api.payments.getStats, { 
  //   fiscalYear: paymentFiscalYearFilter === "all" ? undefined : paymentFiscalYearFilter 
  // });
  
  // Fetch banks data
  const bankAccounts = useQuery(api.banks.listWithBalances);
  const bankValidation = useQuery(api.banks.checkAllBanksHaveCountries);
  
  // Fetch orders data for highlighting
  const ordersData = useQuery(api.orders.list, {
    fiscalYear: currentFiscalYear,
    paginationOpts: { numItems: 1000, cursor: null }
  });
  
  // Get invoice IDs for batch transfer status check
  const invoiceIds = Array.isArray(invoicesData) ? 
    invoicesData.map(invoice => invoice._id) : 
    invoicesData?.page?.map(invoice => invoice._id) || [];
  const batchTransferStatus = useQuery(api.interBankTransfers.getBatchTransferStatus, 
    invoiceIds.length > 0 ? { invoiceIds } : "skip"
  );

  // Fetch invoices that need to come to Pakistan (international, <70% transferred)
  const needToComeInvoices = useQuery(api.invoices.listForInterbankTransfers, {
    paginationOpts: { numItems: 10, cursor: null }
  });

  // Fetch all international invoices to check which ones have come to Pakistan
  const allInternationalInvoices = useQuery(api.invoices.list, {
    paginationOpts: { numItems: 1000, cursor: null }
  });

  // Get international invoice IDs for Pakistan transfer status check
  const internationalInvoiceIds = Array.isArray(allInternationalInvoices) ? 
    allInternationalInvoices
      .filter(invoice => invoice.client?.type === "international")
      .map(invoice => invoice._id) : 
    allInternationalInvoices?.page
      ?.filter(invoice => invoice.client?.type === "international")
      .map(invoice => invoice._id) || [];
  
  const internationalTransferStatus = useQuery(api.interBankTransfers.getBatchTransferStatus, 
    internationalInvoiceIds.length > 0 ? { invoiceIds: internationalInvoiceIds } : "skip"
  );

  // Get all invoice IDs for Pakistan transfer filtering on Invoices tab
  const allInvoiceIdsForPakistanFilter = Array.isArray(allInvoicesForPakistanFilter) ? 
    allInvoicesForPakistanFilter.map(invoice => invoice._id) : 
    allInvoicesForPakistanFilter?.page?.map(invoice => invoice._id) || [];
  
  const allTransferStatus = useQuery(api.interBankTransfers.getBatchTransferStatus, 
    allInvoiceIdsForPakistanFilter.length > 0 ? { invoiceIds: allInvoiceIdsForPakistanFilter } : "skip"
  );
  
  // const bankStats = useQuery(api.banks.getStats);
  
  // Mutations
  // const deletePayment = useMutation(api.payments.deletePayment);

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

  // const getMethodLabel = (method: string) => {
  //   const labels: Record<string, string> = {
  //     bank_transfer: "Bank Transfer",
  //     check: "Check",
  //     cash: "Cash",
  //     credit_card: "Credit Card",
  //     other: "Other",
  //   };
  //   return labels[method] || method;
  // };

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

  // Get invoices from paginated data
  let baseInvoices: any[] = [];
  let totalFilteredCount = 0;
  let isUsingPakistanFilter = false;
  
  // Apply Pakistan transfer filters if selected (only on Invoices tab)
  if (activeTab === "invoices" && pakistanTransferFilter !== "all") {
    isUsingPakistanFilter = true;
    // Use all invoices data for Pakistan filtering to get complete dataset
    const allInvoices = Array.isArray(allInvoicesForPakistanFilter) ? allInvoicesForPakistanFilter : allInvoicesForPakistanFilter?.page || [];
    
    // First apply Pakistan transfer filter
    let pakistanFilteredInvoices = allInvoices;
    if (pakistanTransferFilter === "need_to_come") {
      pakistanFilteredInvoices = allInvoices.filter((invoice: any) => {
        if (invoice.client?.type !== "international") return false;
        const transferStatus = allTransferStatus?.[invoice._id];
        return !transferStatus?.hasMetThreshold;
      });
    } else if (pakistanTransferFilter === "came_to_pakistan") {
      pakistanFilteredInvoices = allInvoices.filter((invoice: any) => {
        if (invoice.client?.type !== "international") return false;
        const transferStatus = allTransferStatus?.[invoice._id];
        return transferStatus?.hasMetThreshold === true;
      });
    }
    
    // Then apply payment status filter on the Pakistan-filtered results
    if (invoicesStatusFilter !== "all") {
      pakistanFilteredInvoices = pakistanFilteredInvoices.filter((invoice: any) => invoice.status === invoicesStatusFilter);
    }
    
    // Sort the filtered results based on Pakistan transfer type
    let sortedFilteredInvoices;
    if (pakistanTransferFilter === "need_to_come") {
      // Sort by factory departure date (earliest first) - most urgent at top
      sortedFilteredInvoices = pakistanFilteredInvoices.sort((a: any, b: any) => {
        const aFactoryDate = (a.order as any)?.factoryDepartureDate;
        const bFactoryDate = (b.order as any)?.factoryDepartureDate;
        
        // Use factory departure date if available, otherwise use issue date
        const aShippedDate = aFactoryDate || a.issueDate;
        const bShippedDate = bFactoryDate || b.issueDate;
        
        return aShippedDate - bShippedDate;
      });
    } else if (pakistanTransferFilter === "came_to_pakistan") {
      // Sort by latest fulfillment (most recent first) - newest completions at top
      sortedFilteredInvoices = pakistanFilteredInvoices.sort((a: any, b: any) => {
        const aTransferStatus = allTransferStatus?.[a._id];
        const bTransferStatus = allTransferStatus?.[b._id];
        
        // Get the latest transfer date for each invoice
        const aLatestTransfer = aTransferStatus?.transfers?.length > 0 
          ? Math.max(...aTransferStatus.transfers.map((t: any) => t.createdAt || 0))
          : 0;
        const bLatestTransfer = bTransferStatus?.transfers?.length > 0 
          ? Math.max(...bTransferStatus.transfers.map((t: any) => t.createdAt || 0))
          : 0;
        
        return bLatestTransfer - aLatestTransfer;
      });
    } else {
      // Default sort by issue date for other filters
      sortedFilteredInvoices = pakistanFilteredInvoices.sort((a: any, b: any) => {
        return b.issueDate - a.issueDate;
      });
    }
    
    // Apply pagination to the filtered results
    totalFilteredCount = sortedFilteredInvoices.length;
    const startIndex = pakistanFilterPagination.currentPage * pakistanFilterPagination.pageSize;
    const endIndex = startIndex + pakistanFilterPagination.pageSize;
    baseInvoices = sortedFilteredInvoices.slice(startIndex, endIndex);
  } else {
    // Use regular pagination for normal invoice queries
    const regularInvoices = Array.isArray(invoicesData) ? invoicesData : invoicesData?.page || [];
    const sortedInvoices = regularInvoices?.sort((a: any, b: any) => {
      return b.issueDate - a.issueDate;
    });
    baseInvoices = sortedInvoices || [];
  }

  // Process Pakistan transfer lists
  const needToComeList = Array.isArray(needToComeInvoices) ? needToComeInvoices : needToComeInvoices?.page || [];
  
  // Filter international invoices that have come to Pakistan (≥70% transferred)
  const cameToPakistanList = Array.isArray(allInternationalInvoices) ? 
    allInternationalInvoices.filter(invoice => {
      if (invoice.client?.type !== "international") return false;
      const transferStatus = internationalTransferStatus?.[invoice._id];
      return transferStatus?.hasMetThreshold === true;
    }) : 
    allInternationalInvoices?.page?.filter(invoice => {
      if (invoice.client?.type !== "international") return false;
      const transferStatus = internationalTransferStatus?.[invoice._id];
      return transferStatus?.hasMetThreshold === true;
    }) || [];

  // Sort Pakistan transfer lists by priority
  const sortedNeedToComeList = needToComeList.sort((a: any, b: any) => {
    // Sort by factory departure date (earliest first) - most urgent at top
    const aFactoryDate = (a.order as any)?.factoryDepartureDate;
    const bFactoryDate = (b.order as any)?.factoryDepartureDate;
    
    // Use factory departure date if available, otherwise use issue date
    const aShippedDate = aFactoryDate || a.issueDate;
    const bShippedDate = bFactoryDate || b.issueDate;
    
    return aShippedDate - bShippedDate;
  });

  const sortedCameToPakistanList = cameToPakistanList.sort((a: any, b: any) => {
    // Sort by latest fulfillment (most recent first) - newest completions at top
    const aTransferStatus = internationalTransferStatus?.[a._id];
    const bTransferStatus = internationalTransferStatus?.[b._id];
    
    // Get the latest transfer date for each invoice
    const aLatestTransfer = aTransferStatus?.transfers?.length > 0 
      ? Math.max(...aTransferStatus.transfers.map((t: any) => t.createdAt || 0))
      : 0;
    const bLatestTransfer = bTransferStatus?.transfers?.length > 0 
      ? Math.max(...bTransferStatus.transfers.map((t: any) => t.createdAt || 0))
      : 0;
    
    return bLatestTransfer - aLatestTransfer;
  });

  // Filter Pakistan lists by search term
  const filteredNeedToComeList = sortedNeedToComeList.filter(invoice => {
    if (!pakistanSearchTerm) return true;
    const searchLower = pakistanSearchTerm.toLowerCase();
    return (
      invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
      invoice.client?.name?.toLowerCase().includes(searchLower) ||
      invoice.client?.email?.toLowerCase().includes(searchLower)
    );
  });

  const filteredCameToPakistanList = sortedCameToPakistanList.filter(invoice => {
    if (!pakistanSearchTerm) return true;
    const searchLower = pakistanSearchTerm.toLowerCase();
    return (
      invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
      invoice.client?.name?.toLowerCase().includes(searchLower) ||
      invoice.client?.email?.toLowerCase().includes(searchLower)
    );
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
        <div className="hidden lg:block">
          <button
            onClick={() => setIsRecordPaymentOpen(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </button>
        </div>
      </div>


      {/* Tab Navigation */}
      <TabNavigation
        tabs={tabs}
        value={activeTab}
        onTabChange={setActiveTab}
        className="mb-6"
      />

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Fiscal Year Sales Summary */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {getFiscalYearLabel(currentFiscalYear)} Sales Summary
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
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValueUSD as number || 0, 'USD')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValuePKR as number || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValueEUR as number || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValueAED as number || 0, 'AED')}</p>
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

          {/* Pakistan Transfer Lists Search */}
          <div className="card p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="pakistan-search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Pakistan Transfer Lists
                </label>
                <input
                  id="pakistan-search"
                  type="text"
                  placeholder="Search by invoice number, client name, email..."
                  value={pakistanSearchTerm}
                  onChange={(e) => setPakistanSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Pakistan Transfer Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Need to Come to Pakistan */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-orange-600" />
                  Need to Come to Pakistan
                </h2>
                <span className="text-sm text-gray-500">{filteredNeedToComeList.length} invoices</span>
              </div>
              
              <div className="space-y-3">
                {!needToComeInvoices ? (
                  // Loading skeletons
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="bg-orange-50 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="h-4 w-20 bg-orange-200 rounded animate-pulse" />
                          <div className="h-3 w-32 bg-orange-200 rounded animate-pulse" />
                        </div>
                        <div className="h-6 w-16 bg-orange-200 rounded animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : filteredNeedToComeList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p>All international invoices have been transferred to Pakistan</p>
                  </div>
                ) : (
                  filteredNeedToComeList.slice(0, 5).map((invoice: any) => {
                    const transferStatus = internationalTransferStatus?.[invoice._id];
                    
                    // Calculate days since factory departure for Pakistan transfer
                    const factoryDepartureDate = (invoice.order as any)?.factoryDepartureDate;
                    const currentDate = Date.now();
                    
                    let daysDisplay = "";
                    let daysColor = "";
                    
                    if (factoryDepartureDate) {
                      // Check if factory departure date is in the future
                      if (factoryDepartureDate > currentDate) {
                        daysDisplay = "Not yet shipped";
                        daysColor = "text-gray-500";
                      } else {
                        // Calculate days since factory departure
                        const daysSinceShipped = Math.floor((currentDate - factoryDepartureDate) / (1000 * 60 * 60 * 24));
                        
                        if (daysSinceShipped < 20) {
                          const daysLeft = 20 - daysSinceShipped;
                          daysDisplay = `${daysSinceShipped} days since shipped (${daysLeft} days left)`;
                          daysColor = daysLeft <= 5 ? "text-red-600" : daysLeft <= 10 ? "text-orange-600" : "text-green-600";
                        } else {
                          daysDisplay = `${daysSinceShipped} days since shipped (overdue)`;
                          daysColor = "text-red-600";
                        }
                      }
                    } else {
                      // No factory departure date - not yet shipped
                      daysDisplay = "Not yet shipped";
                      daysColor = "text-gray-500";
                    }
                    
                    
                    return (
                      <button
                        key={invoice._id}
                        className="w-full text-left bg-orange-50 rounded-lg p-4 hover:bg-orange-100 transition-colors"
                        onClick={() => {
                          setSelectedInvoiceId(invoice._id);
                          setIsInvoiceModalOpen(true);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-orange-800">
                              {invoice.invoiceNumber || "N/A"}
                            </div>
                            <div className="text-xs text-orange-600">
                              {invoice.client?.name}
                            </div>
                            <div className="text-xs text-orange-700 font-medium">
                              {formatCurrency(invoice.amount, invoice.currency as SupportedCurrency)}
                            </div>
                            <div className={`text-xs font-medium ${daysColor}`}>
                              {daysDisplay}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-orange-600">
                              {transferStatus ? `${transferStatus.percentageTransferred.toFixed(1)}%` : "0%"}
                            </div>
                            <div className="text-xs text-orange-500">
                              {invoice.order?.status || "N/A"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              
            </div>

            {/* Came to Pakistan */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  Came to Pakistan
                </h2>
                <span className="text-sm text-gray-500">{filteredCameToPakistanList.length} invoices</span>
              </div>
              
              <div className="space-y-3">
                {!allInternationalInvoices ? (
                  // Loading skeletons
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="bg-green-50 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="h-4 w-20 bg-green-200 rounded animate-pulse" />
                          <div className="h-3 w-32 bg-green-200 rounded animate-pulse" />
                        </div>
                        <div className="h-6 w-16 bg-green-200 rounded animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : filteredCameToPakistanList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p>No international invoices have reached 70% transfer threshold</p>
                  </div>
                ) : (
                  filteredCameToPakistanList.slice(0, 5).map((invoice) => {
                    const transferStatus = internationalTransferStatus?.[invoice._id];
                    return (
                      <button
                        key={invoice._id}
                        className="w-full text-left bg-green-50 rounded-lg p-4 hover:bg-green-100 transition-colors"
                        onClick={() => {
                          setSelectedInvoiceId(invoice._id);
                          setIsInvoiceModalOpen(true);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-green-800">
                              {invoice.invoiceNumber || "N/A"}
                            </div>
                            <div className="text-xs text-green-600">
                              {invoice.client?.name}
                            </div>
                            <div className="text-xs text-green-700 font-medium">
                              {formatCurrency(invoice.amount, invoice.currency as SupportedCurrency)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-green-600">
                              {transferStatus ? `${transferStatus.percentageTransferred.toFixed(1)}%` : "0%"}
                            </div>
                            <div className="text-xs text-green-500">
                              {invoice.order?.status || "N/A"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              
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
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValueUSD as number || 0, 'USD')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValuePKR as number || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValueEUR as number || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValueAED as number || 0, 'AED')}</p>
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

          


          {/* Search and Filter Inputs for Invoices */}
          <div className="card p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="invoices-search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Invoices
                </label>
                <input
                  id="invoices-search"
                  type="text"
                  placeholder="Search by invoice number, client name, email, city, country..."
                  value={invoicesSearchTerm}
                  onChange={(e) => setInvoicesSearchTerm(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="invoices-status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Payment Status
                </label>
                <select
                  id="invoices-status-filter"
                  value={invoicesStatusFilter}
                  onChange={(e) => setInvoicesStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Payment Statuses</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div>
                <label htmlFor="pakistan-transfer-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Payment to Pakistan
                </label>
                <select
                  id="pakistan-transfer-filter"
                  value={pakistanTransferFilter}
                  onChange={(e) => {
                    setPakistanTransferFilter(e.target.value);
                    // Automatically switch to invoices tab when any Pakistan filter is selected
                    setActiveTab("invoices");
                  }}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Invoices</option>
                  <option value="need_to_come">Need to Come to Pakistan</option>
                  <option value="came_to_pakistan">Came to Pakistan</option>
                </select>
              </div>
            </div>
          </div>

      {/* Invoices - Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {!invoicesData ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
                <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))
        ) : baseInvoices?.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
            <p className="mt-1 text-sm text-gray-500">Invoices will appear here once orders move to production.</p>
          </div>
        ) : (
          baseInvoices?.map((invoice) => {
            const ordersList = Array.isArray(ordersData) ? ordersData : ordersData?.page || [];
            const associatedOrder = ordersList.find((order: any) => order._id === invoice.orderId);
            const bankAccount = bankAccounts?.find(bank => bank._id === associatedOrder?.bankAccountId);
            const transferStatus = batchTransferStatus?.[invoice._id];
            const shouldHighlightYellow = shouldHighlightOrderYellowWithTransfers(
              associatedOrder || { status: "pending" },
              bankAccount,
              transferStatus
            );
            const shouldHighlightRed = shouldHighlightOrderRed(
              associatedOrder || { status: "pending" },
              bankAccount,
              transferStatus
            );
            return (
              <button
                key={invoice._id}
                className={`w-full text-left bg-white rounded-lg shadow p-4 active:bg-gray-50 ${getOrderHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}
                onClick={() => {
                  setSelectedInvoiceId(invoice._id);
                  setIsInvoiceModalOpen(true);
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-base font-semibold ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>{invoice.invoiceNumber || "N/A"}</div>
                    <div className={`mt-1 text-sm ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>{invoice.client?.name}</div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                    {getStatusIcon(invoice.status)}
                    <span className="ml-1 capitalize">{invoice.status.replace("_", " ")}</span>
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Amount</div>
                    <div className={`text-sm font-medium ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>{formatCurrency(invoice.amount, invoice.currency as SupportedCurrency)}</div>
                    <div className="text-xs text-gray-500">Paid</div>
                    <div className={`text-xs ${shouldHighlightYellow || shouldHighlightRed ? 'text-gray-700' : 'text-gray-600'}`}>{formatCurrency(invoice.totalPaid, invoice.currency as SupportedCurrency)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Issue Date</div>
                    <div className={`text-sm ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>{formatDateForDisplay(invoice.issueDate)}</div>
                    {(invoice.order?.status === "shipped" || invoice.order?.status === "delivered") && invoice.outstandingBalance > 0 && (
                      <div className="text-xs text-red-600 font-medium">Receivables: {formatCurrency(invoice.outstandingBalance, invoice.currency as SupportedCurrency)}</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Invoices Table - Desktop */}
      <div className="hidden lg:block card overflow-hidden">
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
                    {pakistanTransferFilter === "need_to_come" ? (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">
                        Days Left/Due
                      </th>
                    ) : (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">
                        Order Status
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!invoicesData ? (
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
                  ) : baseInvoices?.length === 0 ? (
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
                    baseInvoices?.map((invoice) => {
                      // Find associated order and bank account for highlighting
                      const ordersList = Array.isArray(ordersData) ? ordersData : ordersData?.page || [];
                      const associatedOrder = ordersList.find((order: any) => order._id === invoice.orderId);
                      const bankAccount = bankAccounts?.find(bank => bank._id === associatedOrder?.bankAccountId);
                      const transferStatus = batchTransferStatus?.[invoice._id];
                      const shouldHighlightYellow = shouldHighlightOrderYellowWithTransfers(
                        associatedOrder || { status: "pending" }, 
                        bankAccount, 
                        transferStatus
                      );
                      const shouldHighlightRed = shouldHighlightOrderRed(
                        associatedOrder || { status: "pending" }, 
                        bankAccount, 
                        transferStatus
                      );
                      
                      return (
                      <tr
                        key={invoice._id}
                        className={`${getOrderHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)} hover:bg-gray-50 cursor-pointer transition-colors`}
                        onClick={() => {
                          setSelectedInvoiceId(invoice._id);
                          setIsInvoiceModalOpen(true);
                        }}
                      >
                        <td className="px-4 py-4">
                          <div>
                            <div className={`text-sm font-medium ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>{invoice.invoiceNumber || "N/A"}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 min-w-0">
                          <div className="min-w-0">
                            <div className={`text-sm ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)} truncate`} title={invoice.client?.name}>
                              {invoice.client?.name}
                            </div>
                            <div className={`text-xs ${shouldHighlightYellow || shouldHighlightRed ? 'text-gray-600' : 'text-gray-500'} truncate`} title={invoice.client?.email}>
                              {invoice.client?.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-sm font-medium ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>
                            {formatDateForDisplay(invoice.issueDate)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-sm font-medium ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>
                            {formatCurrency(invoice.amount, invoice.currency as SupportedCurrency)}
                          </div>
                          <div className={`text-xs ${shouldHighlightYellow || shouldHighlightRed ? 'text-gray-600' : 'text-gray-500'}`}>
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
                          {pakistanTransferFilter === "need_to_come" ? (
                            // Show days since factory departure for "Need to Come to Pakistan" filter
                            (() => {
                              const factoryDepartureDate = (invoice.order as any)?.factoryDepartureDate;
                              const currentDate = Date.now();
                              
                              let daysDisplay = "";
                              let daysColor = "";
                              
                              if (factoryDepartureDate) {
                                 // Check if factory departure date is in the future
                                 if (factoryDepartureDate > currentDate) {
                                   daysDisplay = "Not yet shipped";
                                   daysColor = "text-gray-500";
                                } else {
                                  // Calculate days since factory departure
                                  const daysSinceShipped = Math.floor((currentDate - factoryDepartureDate) / (1000 * 60 * 60 * 24));
                                  
                                  if (daysSinceShipped < 20) {
                                    const daysLeft = 20 - daysSinceShipped;
                                    daysDisplay = `${daysSinceShipped} days since shipped (${daysLeft} days left)`;
                                    daysColor = daysLeft <= 5 ? "text-red-600" : daysLeft <= 10 ? "text-orange-600" : "text-green-600";
                                  } else {
                                    daysDisplay = `${daysSinceShipped} days since shipped (overdue)`;
                                    daysColor = "text-red-600";
                                  }
                                }
                              } else {
                                // No factory departure date - not yet shipped
                                daysDisplay = "Not yet shipped";
                                daysColor = "text-gray-500";
                              }
                              
                              return (
                                <span className={`text-sm font-medium ${daysColor}`}>
                                  {daysDisplay}
                                </span>
                              );
                            })()
                          ) : (
                            // Show order status for other filters
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
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {invoicesData && baseInvoices.length > 0 && (
              <Pagination
                currentPage={isUsingPakistanFilter ? pakistanFilterPagination.currentPage : invoicesPagination.currentPage}
                totalPages={isUsingPakistanFilter 
                  ? Math.ceil(totalFilteredCount / pakistanFilterPagination.pageSize)
                  : Math.ceil((!Array.isArray(invoicesData) ? invoicesData.totalCount || 0 : 0) / invoicesPagination.pageSize)
                }
                onPageChange={isUsingPakistanFilter ? pakistanFilterPagination.goToPage : invoicesPagination.goToPage}
                isLoading={!invoicesData}
              />
            )}
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
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValueUSD as number || 0, 'USD')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValuePKR as number || 0, 'PKR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValueEUR as number || 0, 'EUR')}</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency((dashboardStats as Record<string, unknown>)?.pendingOrdersValueAED as number || 0, 'AED')}</p>
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

          


          {/* Search Input for Payments */}
          <div className="card p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="payments-search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Payments
                </label>
                <input
                  id="payments-search"
                  type="text"
                  placeholder="Search by payment method, client name, email, city, country, invoice number, notes..."
                  value={paymentsSearchTerm}
                  onChange={(e) => setPaymentsSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Payments - Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {(Array.isArray(paymentsData) ? paymentsData : paymentsData?.page || []).map((payment) => (
              <button
                key={payment._id}
                className="w-full text-left bg-white rounded-lg shadow p-4 active:bg-gray-50"
                onClick={() => {
                  setSelectedPaymentId(payment._id as string);
                  setIsPaymentDetailOpen(true);
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-gray-500">{formatDate(payment.paymentDate)}</div>
                    <div className="text-base font-semibold text-gray-900 mt-0.5">{payment.client?.name || '-'}</div>
                    <div className="text-xs text-gray-500">{payment.invoice?.invoiceNumber || '-'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-600">{formatCurrency(payment.amount, payment.currency as SupportedCurrency)}</div>
                    <span className={`inline-flex mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${payment.type === 'advance' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>{payment.type === 'advance' ? 'Advance' : 'Invoice'}</span>
                  </div>
                </div>
                {payment.bankAccount && (
                  <div className="mt-2 text-xs text-gray-500">{payment.bankAccount.accountName} • {payment.bankAccount.bankName}</div>
                )}
              </button>
            ))}
            {(Array.isArray(paymentsData) ? paymentsData : paymentsData?.page || []).length === 0 && (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No payments recorded yet</div>
            )}
            {/* Mobile FAB to record payment */}
            <div className="fixed bottom-20 right-5 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <button
                onClick={() => setIsRecordPaymentOpen(true)}
                className="h-14 w-14 rounded-full shadow-lg flex items-center justify-center text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800"
                aria-label="Record Payment"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Payments History - Desktop */}
          <div className="hidden lg:block card overflow-hidden">
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
                  {(Array.isArray(paymentsData) ? paymentsData : paymentsData?.page || []).map((payment) => (
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
                        
                        {/* Show converted amount if there was a currency conversion */}
                        {(() => {
                          const bankAccount = payment.bankAccount;
                          const currencyMismatch = bankAccount && bankAccount.currency !== payment.currency;
                          
                          
                          // Show converted amount if there's a currency mismatch
                          if (currencyMismatch && bankAccount) {
                            let convertedAmount = payment.amount;
                            const convertedCurrency = bankAccount.currency;
                            
                            // Use stored conversion data if available
                            if (payment.conversionRateToUSD) {
                              convertedAmount = payment.amount * payment.conversionRateToUSD;
                            } else {
                              // Fallback for testing - use a reasonable rate for USD to PKR
                              if (payment.currency === "USD" && bankAccount.currency === "PKR") {
                                convertedAmount = payment.amount * 280; // Test rate
                              }
                            }
                            
                            return (
                              <div className="text-xs text-gray-500">
                                ≈ {formatCurrency(convertedAmount, convertedCurrency as SupportedCurrency)}
                              </div>
                            );
                          }
                          return null;
                        })()}
                        
                        {/* Show withholding info */}
                        {payment.withheldTaxAmount && payment.withheldTaxAmount > 0 && (
                          <div className="text-xs text-orange-600">
                            {(() => {
                              const bankAccount = payment.bankAccount;
                              
                              // For international payments where currencies don't match, show withholding in bank currency
                              if (bankAccount && bankAccount.currency !== payment.currency && payment.conversionRateToUSD) {
                                // Convert the withheld amount using the same conversion rate
                                const withheldInBankCurrency = payment.withheldTaxAmount * payment.conversionRateToUSD;
                                return `-${formatCurrency(withheldInBankCurrency, bankAccount.currency as SupportedCurrency)} withheld`;
                              }
                              
                              // For same currency or other cases, show in original currency
                              return `-${formatCurrency(payment.withheldTaxAmount, payment.currency as SupportedCurrency)} withheld`;
                            })()}
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
              {(Array.isArray(paymentsData) ? paymentsData : paymentsData?.page || []).length === 0 && (
                <div className="text-center py-8 text-gray-500">No payments recorded yet</div>
              )}
            </div>
            {paymentsData && (Array.isArray(paymentsData) ? paymentsData : paymentsData?.page || []).length > 0 && (
              <Pagination
                currentPage={paymentsPagination.currentPage}
              totalPages={Math.ceil((!Array.isArray(paymentsData) ? paymentsData.totalCount || 0 : 0) / paymentsPagination.pageSize)}
                onPageChange={paymentsPagination.goToPage}
                isLoading={!paymentsData}
              />
            )}
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
              disabled={bankValidation && !bankValidation.allHaveCountries}
            >
              <Plus className="h-4 w-4" />
              <span>Add Bank Account</span>
            </button>
          </div>

          {/* Bank Validation Warning */}
          {bankValidation && !bankValidation.allHaveCountries && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Settings className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Bank Setup Required
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      {bankValidation.banksWithoutCountries.length} bank account(s) are missing country information. 
                      This is required for proper transaction processing and order management.
                    </p>
                    <div className="mt-3">
                      <p className="font-medium">Banks needing country assignment:</p>
                      <ul className="mt-1 list-disc list-inside space-y-1">
                        {bankValidation.banksWithoutCountries.map((bank: any) => (
                          <li key={bank._id}>
                            <button
                              onClick={() => {
                                setBankAccountToEdit(bank);
                                setIsEditBankModalOpen(true);
                              }}
                              className="text-red-600 hover:text-red-800 underline"
                            >
                              {bank.accountName} ({bank.bankName}) - {bank.accountNumber}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-3 font-medium">
                      ⚠️ You cannot create new banks or orders until all banks have countries assigned.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bank Account Selection */}
          {bankAccounts && bankAccounts.length > 0 && (
            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Bank Account</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bankAccounts.map((account: any) => (
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
                        {(!account.country || account.country.trim() === '') && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            No Country
                          </span>
                        )}
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
                      <p className="text-xs text-gray-500 mb-1">
                        {account.country ? `Country: ${account.country}` : 'Country: No Country'}
                      </p>
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
                      Country
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
                      <td colSpan={6} className="px-6 py-12 text-center">
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
                    bankAccounts.map((account: any) => (
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
                          <div className="text-sm text-gray-900">
                            {account.country ? (
                              <span className="text-sm text-gray-900">
                                {account.country}
                              </span>
                            ) : (
                              <span className="text-red-500 text-xs">No Country</span>
                            )}
                          </div>
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
        preselectedInvoiceId={preselectedInvoiceId as Id<"invoices"> | undefined}
        preselectedClientId={preselectedClientId as Id<"clients"> | undefined}
      />

      <InvoiceDetailModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoiceId={selectedInvoiceId as Id<"invoices"> | null}
        onRecordPayment={(invId, clientId) => {
          setIsInvoiceModalOpen(false);
          setPreselectedInvoiceId(invId as Id<"invoices">);
          setPreselectedClientId(clientId as Id<"clients">);
          setIsRecordPaymentOpen(true);
        }}
      />

      {/* Bank Account Modal */}
      <BankAccountModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        bankAccount={selectedBankAccount as any}
        onSuccess={() => {
          // Refresh data
        }}
      />

      {/* Delete Bank Confirmation Modal */}
      <DeleteBankConfirmModal
        isOpen={isDeleteBankModalOpen}
        onClose={() => setIsDeleteBankModalOpen(false)}
        bankAccount={selectedBankAccount as any}
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
        bankAccount={bankAccountToEdit as any}
      />

      <EditPaymentModal
        isOpen={isEditPaymentOpen}
        onClose={() => setIsEditPaymentOpen(false)}
        payment={null}
      />

      {/* Payment Detail Modal */}
      <PaymentDetailModal
        isOpen={isPaymentDetailOpen}
        onClose={() => {
          setIsPaymentDetailOpen(false);
          setSelectedPaymentId(null);
        }}
        paymentId={selectedPaymentId as Id<"payments"> | null}
      />

      {/* Bank Account Detail Modal */}
      <BankAccountDetailModal
        isOpen={isBankDetailModalOpen}
        onClose={() => {
          setIsBankDetailModalOpen(false);
          setSelectedBankAccountId(null);
        }}
        bankAccountId={selectedBankAccountId as Id<"bankAccounts"> | null}
      />
    </div>
  );
}
