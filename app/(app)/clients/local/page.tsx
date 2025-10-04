"use client";

import { useState, useEffect, useId } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import TabNavigation, { useTabNavigation } from "@/app/components/TabNavigation";
import ProtectedRoute from "@/app/components/ProtectedRoute";
// import CustomerCard from "@/app/components/clients/CustomerCard";
import OrderDetailModal from "@/app/components/orders/OrderDetailModal";
import AddCustomerModal from "@/app/components/clients/AddCustomerModal";
import CreateOrderModal from "@/app/components/orders/CreateOrderModal";
import { 
  Search, 
  Plus, 
  LayoutGrid, 
  Package, 
  TrendingUp,
  Building2,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  AlertCircle,
  Users,
  CheckCircle
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import toast from "react-hot-toast";
// import { useRouter } from "next/navigation";
import { getCurrentFiscalYear, getFiscalYearOptions, formatFiscalYear } from "@/app/utils/fiscalYear";
import { formatDateForDisplay } from "@/app/utils/dateUtils";
import { formatCurrency } from "@/app/utils/currencyFormat";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { usePagination } from "@/app/hooks/usePagination";
import Pagination from "@/app/components/ui/Pagination";
import { useModalManager } from "@/app/hooks/useModalManager";

function LocalClientsPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [selectedClientForOrder, setSelectedClientForOrder] = useState<Id<"clients"> | null>(null);
  // const [statusFilter, setStatusFilter] = useState<string>("");
  // const [customerFilter, setCustomerFilter] = useState<string>("");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | undefined>(undefined);
  
  // Pagination hook
  const clientsPagination = usePagination({ pageSize: 10 });
  
  // Get fiscal year for dashboard display (from settings or smart default)
  const [dashboardFiscalYear, setDashboardFiscalYear] = useState<number>(Math.max(2025, getCurrentFiscalYear()));
  const [isCustomFiscalYear, setIsCustomFiscalYear] = useState<boolean>(false);
  
  // State for expanded metric modal
  const [expandedMetric, setExpandedMetric] = useState<null | { metric: 'revenue' | 'pending' | 'advance' | 'receivables' | 'total_quantity' | 'pending_quantity' | 'processed_quantity'; audience: 'local' }>(null);

  // Manage scroll locking for expanded metric modal
  const expandedMetricModalId = useId();
  useModalManager(expandedMetricModalId, !!expandedMetric);
  
  // Load fiscal year setting from localStorage and listen for changes
  useEffect(() => {
    const loadFiscalYear = () => {
      const saved = localStorage.getItem('selectedFiscalYear');
      if (saved) {
        const savedYear = parseInt(saved);
        setDashboardFiscalYear(savedYear);
        setIsCustomFiscalYear(savedYear !== getCurrentFiscalYear());
      } else {
        const defaultYear = Math.max(2025, getCurrentFiscalYear());
        setDashboardFiscalYear(defaultYear);
        setIsCustomFiscalYear(false);
      }
    };

    // Load initial value
    loadFiscalYear();

    // Listen for localStorage changes (when settings are updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedFiscalYear') {
        loadFiscalYear();
      }
    };

    // Listen for custom events (for same-tab updates)
    const handleCustomStorageChange = (e: CustomEvent) => {
      if (e.detail.key === 'selectedFiscalYear') {
        loadFiscalYear();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageChange', handleCustomStorageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleCustomStorageChange as EventListener);
    };
  }, []);

  // const router = useRouter();



  // Internal tabs (Dashboard, Orders, Customers)
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "orders", label: "Orders", icon: <Package className="h-4 w-4" /> },
    { id: "customers", label: "Clients", icon: <LayoutGrid className="h-4 w-4" /> },
  ];

  const { activeTab, setActiveTab } = useTabNavigation(tabs, "dashboard");

  // Fetch data with pagination
  const clientsData = useQuery(api.clients.list, { 
    type: "local",
    search: searchQuery || undefined,
    paginationOpts: clientsPagination.paginationOpts,
  });

  // Pagination for orders
  const ordersPagination = usePagination({ pageSize: 10 });

  const ordersData = useQuery(api.orders.list, { 
    clientType: "local",
    fiscalYear: selectedFiscalYear,
    searchTerm: searchQuery || undefined,
    paginationOpts: ordersPagination.paginationOpts,
  });
  
  // Extract orders array (handle both paginated and non-paginated responses)
  const orders = Array.isArray(ordersData) ? ordersData : ordersData?.page || [];

  const stats = useQuery(api.clients.getStats, { 
    type: "local",
    fiscalYear: dashboardFiscalYear,
  });
  const orderStats = useQuery(api.orders.getStats, { 
    clientType: "local",
    fiscalYear: dashboardFiscalYear,
  });
  const clientSummary = useQuery(api.clients.getClientSummary, { 
    type: "local",
    fiscalYear: dashboardFiscalYear,
  });

  // Query for dashboard orders (uses dashboardFiscalYear)
  const dashboardOrdersData = useQuery(api.orders.list, { 
    clientType: "local",
    fiscalYear: dashboardFiscalYear,
  });
  
  // Extract dashboard orders array (handle both paginated and non-paginated responses)
  const dashboardOrders = Array.isArray(dashboardOrdersData) ? dashboardOrdersData : dashboardOrdersData?.page || [];

  // Query for ALL orders (no fiscal year filter) to get complete processed quantity
  const allOrdersData = useQuery(api.orders.list, { 
    clientType: "local",
  });
  
  // Extract all orders array (handle both paginated and non-paginated responses)
  const allOrders = Array.isArray(allOrdersData) ? allOrdersData : allOrdersData?.page || [];

  // Close modal on Escape
  useEffect(() => {
    if (!expandedMetric) return;
    
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedMetric(null);
    };
    window.addEventListener('keydown', onKey);
    
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [expandedMetric]);

  // Detail queries (lazy-loaded when a metric is expanded)
  const receivablesDetails = useQuery(
    api.dashboard.getReceivablesDetails,
    expandedMetric && expandedMetric.metric === 'receivables'
      ? { type: expandedMetric.audience } // Rolling - no fiscal year filter
      : 'skip'
  );
  const advanceDetails = useQuery(
    api.dashboard.getAdvancePaymentsDetails,
    expandedMetric && expandedMetric.metric === 'advance'
      ? { type: expandedMetric.audience } // Rolling - no fiscal year filter
      : 'skip'
  );
  const revenueDetails = useQuery(
    api.dashboard.getRevenueDetails,
    expandedMetric && expandedMetric.metric === 'revenue'
      ? { fiscalYear: dashboardFiscalYear, type: expandedMetric.audience }
      : 'skip'
  );
  const pendingOrdersDetails = useQuery(
    api.dashboard.getPendingOrdersDetails,
    expandedMetric && expandedMetric.metric === 'pending'
      ? { type: expandedMetric.audience } // Rolling - no fiscal year filter
      : 'skip'
  );
  
  // Specific order views
  const totalOrdersDetailsData = useQuery(
    api.orders.list,
    expandedMetric && expandedMetric.metric === 'total_quantity'
      ? { clientType: 'local', fiscalYear: dashboardFiscalYear }
      : 'skip'
  );
  
  // Extract orders array (handle both paginated and non-paginated responses)
  const totalOrdersDetails = Array.isArray(totalOrdersDetailsData) ? totalOrdersDetailsData : totalOrdersDetailsData?.page || [];
  
  const pendingQuantityDetailsData = useQuery(
    api.orders.list,
    expandedMetric && expandedMetric.metric === 'pending_quantity'
      ? { clientType: 'local', fiscalYear: dashboardFiscalYear }
      : 'skip'
  );
  
  // Extract orders array (handle both paginated and non-paginated responses)
  const pendingQuantityDetails = Array.isArray(pendingQuantityDetailsData) ? pendingQuantityDetailsData : pendingQuantityDetailsData?.page || [];
  
  const processedQuantityDetailsData = useQuery(
    api.orders.list,
    expandedMetric && expandedMetric.metric === 'processed_quantity'
      ? { clientType: 'local' }
      : 'skip'
  );
  
  // Extract orders array (handle both paginated and non-paginated responses)
  const processedQuantityDetails = Array.isArray(processedQuantityDetailsData) ? processedQuantityDetailsData : processedQuantityDetailsData?.page || [];

  // Orders are now filtered by the backend, no need for frontend filtering
  const filteredOrders = orders || [];

  // Sort filtered orders by status priority
  const statusPriority = {
    pending: 1,
    in_production: 2,
    shipped: 3,
    delivered: 4,
    cancelled: 5
  };

  const sortedOrders = filteredOrders?.sort((a, b) => {
    // First sort by fiscal year (descending - latest year first)
    if (a.fiscalYear !== b.fiscalYear) {
      return (b.fiscalYear || 0) - (a.fiscalYear || 0);
    }
    // Then sort by status priority (pending first, then in_production, shipped, delivered, cancelled)
    const statusA = statusPriority[a.status as keyof typeof statusPriority] || 6;
    const statusB = statusPriority[b.status as keyof typeof statusPriority] || 6;
    if (statusA !== statusB) {
      return statusA - statusB;
    }
    // Finally sort by factory departure date (ascending - nearest first)
    // Use factoryDepartureDate if available, fallback to orderCreationDate, then createdAt
    const dateA = a.factoryDepartureDate || a.orderCreationDate || a.createdAt;
    const dateB = b.factoryDepartureDate || b.orderCreationDate || b.createdAt;
    return dateA - dateB;
  });

  // Get unique values for filters
  // const uniqueCustomers = orders 
  //   ? Array.from(new Set(orders.map(o => o.client?.name).filter(Boolean) as string[])).sort()
  //   : [];


  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-gray-100 text-gray-800",
      in_production: "bg-blue-100 text-blue-800",
      shipped: "bg-orange-100 text-orange-800",
      delivered: "bg-green-500 text-white font-semibold shadow-sm",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  // const getPaymentStatusColor = (status: string) => {
  //   const colors: Record<string, string> = {
  //     draft: "bg-gray-100 text-gray-800",
  //     sent: "bg-blue-100 text-blue-800",
  //     due: "bg-yellow-100 text-yellow-800",
  //     partially_paid: "bg-orange-100 text-orange-800",
  //     paid: "bg-green-100 text-green-800",
  //     overdue: "bg-red-100 text-red-800",
  //   };
  //   return colors[status] || "bg-gray-100 text-gray-800";
  // };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Local Clients</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your domestic client relationships
          </p>
        </div>
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
        <div className="space-y-8">
          {/* Overview Summary */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
              <div className={`text-sm px-3 py-1 rounded-full ${
                isCustomFiscalYear 
                  ? 'text-purple-700 bg-purple-100 border border-purple-200' 
                  : 'text-gray-500 bg-gray-100'
              }`}>
                {formatFiscalYear(dashboardFiscalYear)} Fiscal Year
                {isCustomFiscalYear && (
                  <span className="ml-1 text-xs">(Custom)</span>
                )}
              </div>
            </div>
            
            {/* Overview Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Total Quantity */}
              <div
                className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-6 border border-indigo-200 shadow-sm cursor-pointer hover:shadow-md transition"
                role="button"
                onClick={() => setExpandedMetric({ metric: 'total_quantity', audience: 'local' })}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-indigo-200 rounded-lg">
                    <Package className="h-6 w-6 text-indigo-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-indigo-600 font-medium uppercase tracking-wide">Volume</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-indigo-700 mb-1">Total Quantity</p>
                  <p className="text-2xl font-bold text-indigo-900">
                    {orderStats ? `${(orderStats.totalQuantity || 0).toLocaleString()} kg` : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-indigo-600 mt-1">Local order volume</p>
                </div>
              </div>

              {/* Pending Quantity */}
              <div
                className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200 shadow-sm cursor-pointer hover:shadow-md transition"
                role="button"
                onClick={() => setExpandedMetric({ metric: 'pending_quantity', audience: 'local' })}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-orange-200 rounded-lg">
                    <AlertCircle className="h-6 w-6 text-orange-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Pending</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-700 mb-1">Pending Quantity</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {orderStats ? `${(orderStats.pendingQuantity || 0).toLocaleString()} kg` : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">In production or pending</p>
                </div>
              </div>

              {/* Processed Quantity */}
              <div
                className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200 shadow-sm cursor-pointer hover:shadow-md transition"
                role="button"
                onClick={() => setExpandedMetric({ metric: 'processed_quantity', audience: 'local' })}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-green-200 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Processed</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700 mb-1">Dispatched Quantity</p>
                  <p className="text-2xl font-bold text-green-900">
                    {allOrders ? `${allOrders
                      .filter(order => order.status === 'shipped' || order.status === 'delivered')
                      .reduce((total, order) => total + (order.items?.reduce((sum, item) => sum + (item.quantityKg || 0), 0) || 0), 0)
                      .toLocaleString()} kg` : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Shipped or delivered</p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Performance Summary */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Financial Performance</h2>
              <div className={`text-sm px-3 py-1 rounded-full ${
                isCustomFiscalYear 
                  ? 'text-purple-700 bg-purple-100 border border-purple-200' 
                  : 'text-gray-500 bg-gray-100'
              }`}>
                {formatFiscalYear(dashboardFiscalYear)} Fiscal Year
                {isCustomFiscalYear && (
                  <span className="ml-1 text-xs">(Custom)</span>
                )}
              </div>
            </div>
            
            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {/* Revenue */}
                <div
                  className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200 shadow-sm cursor-pointer hover:shadow-md transition"
                  role="button"
                  onClick={() => setExpandedMetric({ metric: 'revenue', audience: 'local' })}
                >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-green-200 rounded-lg">
                    <DollarSign className="h-6 w-6 text-green-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Received</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-900">
                    {stats ? formatCurrency(stats.totalRevenue || 0) : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Local payments received</p>
                </div>
              </div>

                {/* Current Pending Orders Value */}
                <div
                  className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-sm cursor-pointer hover:shadow-md transition"
                  role="button"
                  onClick={() => setExpandedMetric({ metric: 'pending', audience: 'local' })}
                >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-200 rounded-lg">
                    <Package className="h-6 w-6 text-blue-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Pipeline</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-1">Current Pending Orders Value</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {stats ? formatCurrency(((stats as Record<string, unknown>).currentPendingOrdersValue as number) || stats.totalOrderValue || 0) : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Local orders in pipeline</p>
                </div>
              </div>

                {/* Advance Payments */}
                <div
                  className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 shadow-sm cursor-pointer hover:shadow-md transition"
                  role="button"
                  onClick={() => setExpandedMetric({ metric: 'advance', audience: 'local' })}
                >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-purple-200 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-purple-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Advance</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-700 mb-1">Advance Payments</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {stats ? formatCurrency(stats.advancePayments || 0) : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">Pre-shipment payments</p>
                </div>
              </div>

                {/* Receivables */}
                <div
                  className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 shadow-sm cursor-pointer hover:shadow-md transition"
                  role="button"
                  onClick={() => setExpandedMetric({ metric: 'receivables', audience: 'local' })}
                >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-red-200 rounded-lg">
                    <AlertCircle className="h-6 w-6 text-red-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Pending</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700 mb-1">Receivables</p>
                  <p className="text-2xl font-bold text-red-900">
                    {stats ? formatCurrency(stats.outstandingAmount || 0) : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-red-600 mt-1">Shipped awaiting payment</p>
                </div>
              </div>
            </div>
          </div>





          {/* Client Summary - Mobile */}
          <div className="lg:hidden space-y-3">
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Client Summary</h2>
                  <p className="text-xs text-gray-500">Receivables and total quantities</p>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {formatFiscalYear(dashboardFiscalYear)}
                </span>
              </div>
            </div>

            {!clientSummary ? (
              [...Array(4)].map((_, index) => (
                <div key={index} className="card p-4 animate-pulse space-y-3">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                </div>
              ))
            ) : clientSummary.length === 0 ? (
              <div className="card p-6 text-center text-gray-500">
                <Building2 className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                <p>No clients with data for {formatFiscalYear(dashboardFiscalYear)}</p>
              </div>
            ) : (
              clientSummary.map((client) => (
                <div key={client.clientId} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                        {client.clientName?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{client.clientName}</p>
                        <p className="text-xs text-gray-500 truncate" title={client.clientEmail}>{client.clientEmail}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Receivables</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(client.outstandingAmount || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Total Quantity</span>
                    <span>{(client.totalQuantity || 0).toLocaleString()} kg</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Client Summary Table */}
          <div className="hidden lg:block">
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Client Summary
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Receivables amounts and total quantities by client
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {formatFiscalYear(dashboardFiscalYear)} Fiscal Year
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed divide-y divide-gray-200">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[50%]">
                      Client
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">
                      Receivables Amount
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">
                      Total Quantity (kg)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!clientSummary ? (
                    // Loading skeletons
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse mr-3" />
                            <div>
                              <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
                              <div className="w-24 h-3 bg-gray-200 rounded animate-pulse mt-1" />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><div className="w-20 h-4 bg-gray-200 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="w-16 h-4 bg-gray-200 rounded animate-pulse" /></td>
                      </tr>
                    ))
                  ) : clientSummary.length === 0 ? (
                    // Empty state
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center">
                        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">
                          No clients with data for {dashboardFiscalYear}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Start by adding your first local client or check if there are orders for this fiscal year.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    // Client rows
                    clientSummary.map((client) => (
                      <tr key={client.clientId} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                                                         <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                               <span className="text-white text-sm font-medium">
                                 {client.clientName?.charAt(0).toUpperCase() || "?"}
                               </span>
                             </div>
                            <div className="ml-3 min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate" title={client.clientName}>
                                {client.clientName}
                              </p>
                              <p className="text-xs text-gray-500 truncate" title={client.clientEmail}>
                                {client.clientEmail}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(client.outstandingAmount)}
                          </div>
                          {client.outstandingAmount > 0 && (
                            <div className="text-xs text-red-600 font-medium">
                              Receivables
                            </div>
                          )}
                        </td>
                                                 <td className="px-6 py-4">
                           <div className="text-sm text-gray-900">
                             {(client.totalQuantity || 0).toLocaleString()}
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
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Local Orders</h2>
              <p className="text-gray-600 mt-1">
                Manage and track all local customer orders
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsCreateOrderOpen(true)}
                className="btn-primary flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Order
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="card p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Universal Search */}
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search orders, invoices, clients..."
                    className="pl-10 pr-3 py-2 w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Fiscal Year Filter */}
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
                <select
                  value={selectedFiscalYear || ""}
                  onChange={(e) => setSelectedFiscalYear(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Years</option>
                  {getFiscalYearOptions().map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '15%'}}>
                      Invoice Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '20%'}}>
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '12%'}}>
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '18%'}}>
                      AMOUNT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '20%'}}>
                      Bloom & Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '15%'}}>
                      Fac. Dep. Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!orders ? (
                    // Loading state
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td className="px-4 py-4"><Skeleton /></td>
                        <td className="px-4 py-4"><Skeleton /></td>
                        <td className="px-4 py-4"><Skeleton /></td>
                        <td className="px-4 py-4"><Skeleton /></td>
                        <td className="px-4 py-4"><Skeleton /></td>
                        <td className="px-4 py-4"><Skeleton /></td>
                        <td className="px-4 py-4"><Skeleton /></td>
                      </tr>
                    ))
                  ) : (sortedOrders && sortedOrders.length > 0) ? (
                    sortedOrders.map((order) => {
                      // Calculate financial metrics for local orders
                      const calculateFinancialMetrics = (order: Record<string, unknown>) => {
                        if (!order.invoice) {
                          return {
                            total: order.totalAmount,
                            paid: 0,
                            advancePaid: 0,
                            invoicePaid: 0,
                            outstanding: order.totalAmount
                          };
                        }

                        const payments = Array.isArray(order.payments) ? order.payments : [];
                        const advancePaid = payments
                          .filter((p: Record<string, unknown>) => p.type === "advance")
                          .reduce((sum: number, p: Record<string, unknown>) => sum + ((p.amount as number) || 0), 0);
                        
                        const invoicePaid = payments
                          .filter((p: Record<string, unknown>) => p.type !== "advance")
                          .reduce((sum: number, p: Record<string, unknown>) => sum + ((p.amount as number) || 0), 0);
                        
                        const totalPaid = advancePaid + invoicePaid;
                        
                        // Outstanding balance should only be calculated for shipped/delivered orders
                        const outstanding = (order.status === "shipped" || order.status === "delivered")
                          ? Math.max(0, ((order.invoice as Record<string, unknown>)?.amount as number || 0) - totalPaid)
                          : 0;
                        
                        return {
                          total: (order.invoice as Record<string, unknown>)?.amount as number || 0,
                          paid: totalPaid,
                          advancePaid: advancePaid,
                          invoicePaid: invoicePaid,
                          outstanding: outstanding
                        };
                      };

                      const metrics = calculateFinancialMetrics(order);
                      return (
                        <tr 
                          key={order._id} 
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedOrderId(order._id)}
                        >
                          <td className="px-4 py-4" style={{width: '15%'}}>
                            <div className="text-sm font-medium text-gray-900">
                              {order.invoiceNumber}
                            </div>
                          </td>
                          <td className="px-4 py-4" style={{width: '20%'}}>
                            <div className="text-sm text-gray-900 break-words">{order.client?.name || "Unknown Client"}</div>
                          </td>
                          <td className="px-4 py-4" style={{width: '12%'}}>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              <span className="ml-1 capitalize">
                                {order.status.replace("_", " ")}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center" style={{width: '18%'}}>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(metrics.total as number)}
                              </div>
                              <div className="text-xs text-gray-600">
                                Paid: {formatCurrency(metrics.paid as number)}
                                {(metrics.advancePaid as number) > 0 && (
                                  <span className="text-blue-600">
                                    {" "}({formatCurrency(metrics.advancePaid as number)} advance)
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs font-medium ${(metrics.outstanding as number) > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                Receivables: {(metrics.outstanding as number) > 0 ? formatCurrency(metrics.outstanding as number) : 
                                             order.status === "shipped" || order.status === "delivered" ? formatCurrency(0) : 
                                             "Not due"}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900" style={{width: '20%'}}>
                            <div className="space-y-1">
                              {order.items && order.items.length > 0 ? (
                                order.items.map((item, index) => (
                                  <div key={index} className="text-sm">
                                    {item.bloom ? `${item.bloom}: ${(item.quantityKg || 0).toLocaleString()} kg` : `No Bloom: ${(item.quantityKg || 0).toLocaleString()} kg`}
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm">No Items</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900" style={{width: '15%'}}>
                            <div className="truncate" title={order.factoryDepartureDate ? formatDate(order.factoryDepartureDate) : 'Not set'}>
                              {order.factoryDepartureDate ? formatDate(order.factoryDepartureDate) : 'Not set'}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    // Empty state when no orders match filters
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Package className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No local orders found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {searchQuery || selectedFiscalYear 
                            ? "Try adjusting your filters"
                            : "Get started by creating a new order."}
                        </p>
                        {(!searchQuery && !selectedFiscalYear) && (
                          <div className="mt-6">
                            <button
                              onClick={() => setIsCreateOrderOpen(true)}
                              className="btn-primary flex items-center mx-auto"
                            >
                              <Plus className="h-5 w-5 mr-2" />
                              Create Order
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination for orders */}
            {ordersData && !Array.isArray(ordersData) && ordersData.page && ordersData.page.length > 0 && (
              <div className="mt-6">
                <Pagination
                  currentPage={ordersPagination.currentPage}
                  totalPages={Math.ceil((!Array.isArray(ordersData) ? ordersData.totalCount || 0 : 0) / ordersPagination.pageSize)}
                  onPageChange={ordersPagination.goToPage}
                  isLoading={!ordersData}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          {/* Header with Add Customer Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Customers</h2>
              <p className="text-sm text-gray-600 mt-1">Manage your local customers</p>
            </div>
            <button
              onClick={() => setIsAddCustomerOpen(true)}
              className="btn-primary flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customers by name, city, or country..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Customer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(Array.isArray(clientsData) ? clientsData : clientsData?.page || []).map((client) => (
              <div key={client._id} className="card-hover p-6 flex flex-col h-full">
                {/* Header with profile picture, name and status */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {client.profilePictureId ? (
                        <div className="relative">
                          <img
                            src={`/api/files/${client.profilePictureId}`}
                            alt={client.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                            onError={(e) => {
                              // Hide the image and show fallback
                              const img = e.currentTarget;
                              const fallback = img.nextElementSibling as HTMLElement;
                              img.style.display = 'none';
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center hidden">
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {client.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 truncate">{client.contactPerson}</p>
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 ml-2 inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                      client.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {client.status}
                  </span>
                </div>

                {/* Contact Information */}
                <div className="space-y-3 flex-1 mb-6">
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">
                      {client.city}, {client.country}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 mr-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-4 w-4 mr-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{client.phone}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 mt-auto">
                  {/* Primary Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedClientForOrder(client._id);
                        setIsCreateOrderOpen(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Order
                    </button>
                    <Link
                      href={`/clients/${client._id}`}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                  
                </div>
              </div>
            ))}
          </div>

          {clientsData && !Array.isArray(clientsData) && clientsData.page && clientsData.page.length > 0 && (
            <Pagination
              currentPage={clientsPagination.currentPage}
              totalPages={Math.ceil((!Array.isArray(clientsData) ? clientsData.totalCount || 0 : 0) / clientsPagination.pageSize)}
              onPageChange={clientsPagination.goToPage}
              isLoading={!clientsData}
            />
          )}

          {(Array.isArray(clientsData) ? clientsData : clientsData?.page || []).length === 0 && (
            <div className="text-center py-12 card">
              <p className="text-gray-500 mb-4">No customers found</p>
              <button
                onClick={() => setIsAddCustomerOpen(true)}
                className="btn-primary"
              >
                Add Your First Customer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <OrderDetailModal
        orderId={selectedOrderId}
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />

      <CreateOrderModal
        isOpen={isCreateOrderOpen}
        onClose={() => {
          setIsCreateOrderOpen(false);
          setSelectedClientForOrder(null);
        }}
        preselectedClientId={selectedClientForOrder || undefined}
        onSuccess={() => {
          setIsCreateOrderOpen(false);
          setSelectedClientForOrder(null);
          toast.success("Order created successfully!");
        }}
      />

      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        type="local"
      />

      {/* Modal for Details */}
      {expandedMetric && (
        <div className="fixed inset-0 z-[9999] flex items-stretch sm:items-start justify-center pt-0 sm:pt-4" style={{ width: '100vw', height: '100vh' }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setExpandedMetric(null)} />
          <div className="relative bg-white sm:rounded-2xl rounded-none shadow-2xl w-full max-w-6xl h-[100vh] sm:h-[calc(100vh-2rem)] mx-0 sm:mx-4 overflow-hidden border border-gray-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4 sticky top-0" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
              <div className="flex items-center justify-between">
                <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-1">
                        {expandedMetric.metric === 'pending' && 'Current Pending Orders'}
                        {expandedMetric.metric === 'advance' && 'Advance Payments'}
                        {expandedMetric.metric === 'receivables' && 'Receivables'}
                        {expandedMetric.metric === 'revenue' && 'Total Revenue'}
                        {expandedMetric.metric === 'total_quantity' && 'Total Quantity Breakdown'}
                        {expandedMetric.metric === 'pending_quantity' && 'Pending Quantity Orders'}
                        {expandedMetric.metric === 'processed_quantity' && 'All Processed Orders (Shipped/Delivered)'}
                      </h2>
                  <p className="text-sm text-gray-600">
                    {expandedMetric.metric === 'processed_quantity' 
                      ? 'Local Clients • All Time (All Fiscal Years)' 
                      : `Local Clients • ${formatFiscalYear(dashboardFiscalYear)} Fiscal Year`}
                  </p>
                </div>
                <button
                  onClick={() => setExpandedMetric(null)}
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-full p-2 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-auto h-[calc(100vh-64px)] sm:h-[calc(100vh-2rem-80px)] bg-gray-50" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
              {expandedMetric.metric === 'pending' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {!pendingOrdersDetails ? (
                    <div className="p-8">
                      <Skeleton count={5} height={48} />
                    </div>
                  ) : pendingOrdersDetails.length === 0 ? (
                    <div className="p-8 text-center">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-600">No pending orders found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty (kg)</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fac. Dep. Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pendingOrdersDetails.map((row: any) => (
                            <tr key={String(row.orderId)} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.invoiceNumber || '—'}</td>
                              <td className="px-3 sm:px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={row.clientName || '—'}>{row.clientName || '—'}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  row.status === 'pending' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.totalQuantity.toLocaleString()}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(row.totalAmount)}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.currency}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.factoryDepartureDate ? formatDateForDisplay(row.factoryDepartureDate) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {expandedMetric.metric === 'advance' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {!advanceDetails ? (
                    <div className="p-8">
                      <Skeleton count={5} height={48} />
                    </div>
                  ) : advanceDetails.length === 0 ? (
                    <div className="p-8 text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-600">No advance payments found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advance Paid</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {advanceDetails.map((row: any) => (
                            <tr key={String(row.invoiceId)} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.invoiceNumber || '—'}</td>
                              <td className="px-3 sm:px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={row.clientName || '—'}>{row.clientName || '—'}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{formatCurrency(row.advancePaid)}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.currency}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(row.issueDate).toLocaleDateString()}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(row.dueDate).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {expandedMetric.metric === 'receivables' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {!receivablesDetails ? (
                    <div className="p-8">
                      <Skeleton count={5} height={48} />
                    </div>
                  ) : receivablesDetails.length === 0 ? (
                    <div className="p-8 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-600">No receivables found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {receivablesDetails.map((row: any) => (
                            <tr key={String(row.invoiceId)} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.invoiceNumber || '—'}</td>
                              <td className="px-3 sm:px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={row.clientName || '—'}>{row.clientName || '—'}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">{formatCurrency(row.outstandingBalance)}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.currency}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(row.issueDate).toLocaleDateString()}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(row.dueDate).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {expandedMetric.metric === 'revenue' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {!revenueDetails ? (
                    <div className="p-8">
                      <Skeleton count={5} height={48} />
                    </div>
                  ) : revenueDetails.length === 0 ? (
                    <div className="p-8 text-center">
                      <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-600">No revenue payments found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {revenueDetails.map((row: any) => (
                            <tr key={String(row.paymentId)} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(row.paymentDate).toLocaleDateString()}</td>
                              <td className="px-3 sm:px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={row.clientName || '—'}>{row.clientName || '—'}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.invoiceNumber || '—'}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{formatCurrency(row.amount)}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.currency}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.method}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.reference}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Total Quantity */}
              {expandedMetric.metric === 'total_quantity' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {!totalOrdersDetails ? (
                    <div className="p-8">
                      <Skeleton count={5} height={48} />
                    </div>
                  ) : totalOrdersDetails.length === 0 ? (
                    <div className="p-8 text-center">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-600">No orders found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty (kg)</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fac. Dep. Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {totalOrdersDetails.map((order) => (
                            <tr key={order._id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedOrderId(order._id)}>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.invoiceNumber}</td>
                              <td className="px-3 sm:px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={order.client?.name || 'Unknown Client'}>{order.client?.name || 'Unknown Client'}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  order.status === 'pending' ? 'bg-orange-100 text-orange-800' : 
                                  order.status === 'in_production' ? 'bg-blue-100 text-blue-800' :
                                  order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                                  order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {order.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {order.items?.reduce((sum, item) => sum + item.quantityKg, 0).toLocaleString() || '0'}
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount)}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.currency}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.factoryDepartureDate ? formatDateForDisplay(order.factoryDepartureDate) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Pending Quantity */}
              {expandedMetric.metric === 'pending_quantity' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {!pendingQuantityDetails ? (
                    <div className="p-8">
                      <Skeleton count={5} height={48} />
                    </div>
                  ) : pendingQuantityDetails.length === 0 ? (
                    <div className="p-8 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-600">No pending orders found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty (kg)</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fac. Dep. Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pendingQuantityDetails?.filter(order => order.status === 'pending' || order.status === 'in_production').map((order) => (
                            <tr key={order._id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedOrderId(order._id)}>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.invoiceNumber}</td>
                              <td className="px-3 sm:px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={order.client?.name || 'Unknown Client'}>{order.client?.name || 'Unknown Client'}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  order.status === 'pending' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {order.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {order.items?.reduce((sum, item) => sum + item.quantityKg, 0).toLocaleString() || '0'}
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount)}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.currency}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.factoryDepartureDate ? formatDateForDisplay(order.factoryDepartureDate) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Processed Quantity */}
              {expandedMetric.metric === 'processed_quantity' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {!processedQuantityDetails ? (
                    <div className="p-8">
                      <Skeleton count={5} height={48} />
                    </div>
                  ) : processedQuantityDetails.length === 0 ? (
                    <div className="p-8 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-600">No processed orders found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty (kg)</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fac. Dep. Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {processedQuantityDetails?.filter(order => order.status === 'shipped' || order.status === 'delivered').map((order) => (
                            <tr key={order._id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedOrderId(order._id)}>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.invoiceNumber}</td>
                              <td className="px-3 sm:px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={order.client?.name || 'Unknown Client'}>{order.client?.name || 'Unknown Client'}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  order.status === 'shipped' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {order.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {order.items?.reduce((sum, item) => sum + item.quantityKg, 0).toLocaleString() || '0'}
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount)}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.currency}</td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.factoryDepartureDate ? formatDateForDisplay(order.factoryDepartureDate) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function LocalClientsPage() {
  return (
    <ProtectedRoute route="/clients/local">
      <LocalClientsPageContent />
    </ProtectedRoute>
  );
}
