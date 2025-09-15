"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import TabNavigation, { useTabNavigation } from "@/app/components/TabNavigation";
import CustomerCard from "@/app/components/clients/CustomerCard";
import OrderDetailModal from "@/app/components/orders/OrderDetailModal";
import AddCustomerModal from "@/app/components/clients/AddCustomerModal";
import EditCustomerModal from "@/app/components/clients/EditCustomerModal";
import DeleteConfirmModal from "@/app/components/clients/DeleteConfirmModal";
import CreateOrderModal from "@/app/components/orders/CreateOrderModal";
import { 
  Search, 
  Plus, 
  LayoutGrid, 
  Package, 
  TrendingUp,
  Filter,
  Calendar,
  ChevronDown,
  Building2,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2,
  DollarSign,
  AlertCircle,
  Users,
  CheckCircle
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { getCurrentFiscalYear, getFiscalYearOptions, getFiscalYearLabel, formatFiscalYear } from "@/app/utils/fiscalYear";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function InternationalClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [selectedClientForOrder, setSelectedClientForOrder] = useState<Id<"clients"> | null>(null);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | undefined>(undefined);
  
  // Get fiscal year for dashboard display (from settings or smart default)
  const [dashboardFiscalYear, setDashboardFiscalYear] = useState<number>(Math.max(2025, getCurrentFiscalYear()));
  const [isCustomFiscalYear, setIsCustomFiscalYear] = useState<boolean>(false);
  
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

  const router = useRouter();



  // Internal tabs (Dashboard, Orders, Customers)
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "orders", label: "Orders", icon: <Package className="h-4 w-4" /> },
    { id: "customers", label: "Clients", icon: <LayoutGrid className="h-4 w-4" /> },
  ];

  const { activeTab, setActiveTab } = useTabNavigation(tabs, "dashboard");

  // Fetch data
  const clients = useQuery(api.clients.list, {
    type: "international",
    search: searchQuery,
  });

  const orders = useQuery(api.orders.list, {
    clientType: "international",
    fiscalYear: selectedFiscalYear,
  });

  const stats = useQuery(api.clients.getStats, {
    type: "international",
    fiscalYear: dashboardFiscalYear,
  });

  const orderStats = useQuery(api.orders.getStats, {
    clientType: "international",
    fiscalYear: dashboardFiscalYear,
  });
  const clientSummary = useQuery(api.clients.getClientSummary, { 
    type: "international",
    fiscalYear: dashboardFiscalYear,
  });

  // Filter orders
  const filteredOrders = orders?.filter((order) => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (
        (order.invoiceNumber || order.orderNumber).toLowerCase().includes(searchLower) ||
        order.client?.name?.toLowerCase().includes(searchLower) ||
        order.client?.city?.toLowerCase().includes(searchLower) ||
        order.client?.country?.toLowerCase().includes(searchLower) ||
        order.status.toLowerCase().includes(searchLower) ||
        order.currency.toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;
    }
    
    return true;
  });

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
    // Finally sort by creation date (descending - latest first)
    return b.createdAt - a.createdAt;
  });

  // Get unique customers for filter
  const uniqueCustomers = orders 
    ? Array.from(new Set(orders.map(order => order.client?.name).filter(Boolean) as string[])).sort()
    : [];

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    // For EUR, use custom formatting to ensure symbol appears before number
    if (currency === 'EUR') {
      return `€${new Intl.NumberFormat('en-DE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount)}`;
    }
    
    // Use appropriate locale based on currency for other currencies
    const locale = currency === 'USD' ? 'en-US' : 
                   currency === 'PKR' ? 'en-PK' : 
                   currency === 'AED' ? 'en-AE' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "in_production":
        return "bg-blue-100 text-blue-800";
      case "shipped":
        return "bg-orange-100 text-orange-800";
      case "delivered":
        return "bg-green-500 text-white font-semibold shadow-sm";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "partially_paid":
        return "bg-yellow-100 text-yellow-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">International Clients</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your international client relationships
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Quantity */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-6 border border-indigo-200 shadow-sm">
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
                  <p className="text-xs text-indigo-600 mt-1">International production volume</p>
                </div>
              </div>

              {/* Orders Count */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-emerald-200 rounded-lg">
                    <Users className="h-6 w-6 text-emerald-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Orders</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-700 mb-1">Total Orders</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {stats ? `${stats.totalOrders || 0}` : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">International orders</p>
                </div>
              </div>

              {/* Active Orders */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-amber-200 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-amber-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Active</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-700 mb-1">Active Orders</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {stats ? `${stats.activeOrders || 0}` : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">Currently processing</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Order Value */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-200 rounded-lg">
                    <Package className="h-6 w-6 text-blue-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Pipeline</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-1">Total Order Value</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {stats ? (
                      stats.orderValueByCurrency ? 
                        Object.entries(stats.orderValueByCurrency)
                          .filter(([currency, amount]) => (amount as number) > 0)
                          .map(([currency, amount]) => (
                            <div key={currency} className="text-lg">
                              {formatCurrency(amount as number, currency)}
                            </div>
                          ))
                        : formatCurrency(stats.totalOrderValue || 0, 'USD')
                    ) : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">International orders in pipeline</p>
                </div>
              </div>

              {/* Revenue */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200 shadow-sm">
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
                    {stats ? (
                      stats.revenueByCurrency ? 
                        Object.entries(stats.revenueByCurrency)
                          .filter(([currency, amount]) => (amount as number) > 0)
                          .map(([currency, amount]) => (
                            <div key={currency} className="text-lg">
                              {formatCurrency(amount as number, currency)}
                            </div>
                          ))
                        : formatCurrency(stats.totalRevenue || 0, 'USD')
                    ) : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-green-600 mt-1">International payments received</p>
                </div>
              </div>

              {/* Advance Payments */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 shadow-sm">
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
                    {stats ? (
                      stats.advancePaymentsByCurrency ? 
                        Object.entries(stats.advancePaymentsByCurrency)
                          .filter(([currency, amount]) => (amount as number) > 0)
                          .map(([currency, amount]) => (
                            <div key={currency} className="text-lg">
                              {formatCurrency(amount as number, currency)}
                            </div>
                          ))
                        : formatCurrency(stats.advancePayments || 0, 'USD')
                    ) : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">Pre-shipment payments</p>
                </div>
              </div>

              {/* Outstanding */}
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-red-200 rounded-lg">
                    <AlertCircle className="h-6 w-6 text-red-700" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Pending</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700 mb-1">Outstanding</p>
                  <p className="text-2xl font-bold text-red-900">
                    {stats ? (
                      stats.outstandingByCurrency ? 
                        Object.entries(stats.outstandingByCurrency)
                          .filter(([currency, amount]) => (amount as number) > 0)
                          .map(([currency, amount]) => (
                            <div key={currency} className="text-lg">
                              {formatCurrency(amount as number, currency)}
                            </div>
                          ))
                        : formatCurrency(stats.outstandingAmount || 0, 'USD')
                    ) : <Skeleton width={100} height={32} />}
                  </p>
                  <p className="text-xs text-red-600 mt-1">Shipped awaiting payment</p>
                </div>
              </div>
            </div>
          </div>





          {/* Client Summary Table */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Client Summary
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Outstanding amounts and total quantities by client
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[50%]">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">
                      Outstanding Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">
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
                          Start by adding your first international client or check if there are orders for this fiscal year.
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
                            {client.outstandingByCurrency ? 
                              Object.entries(client.outstandingByCurrency)
                                .filter(([currency, amount]) => (amount as number) > 0)
                                .map(([currency, amount]) => (
                                  <div key={currency} className="mb-1">
                                    {formatCurrency(amount as number, currency)}
                                  </div>
                                ))
                              : formatCurrency(client.outstandingAmount, client.outstandingCurrency)
                            }
                          </div>
                          {client.outstandingAmount > 0 && (
                            <div className="text-xs text-red-600 font-medium">
                              Outstanding
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
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">International Orders</h2>
              <p className="text-gray-600 mt-1">
                Manage and track all international customer orders
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AMOUNT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivery Date
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
                      </tr>
                    ))
                  ) : (sortedOrders && sortedOrders.length > 0) ? (
                    sortedOrders.map((order) => {
                      // Calculate financial metrics for international orders
                      const calculateFinancialMetrics = (order: any) => {
                        if (!order.invoice) {
                          return {
                            total: order.totalAmount,
                            paid: 0,
                            advancePaid: 0,
                            invoicePaid: 0,
                            outstanding: order.totalAmount
                          };
                        }

                        const payments = order.payments || [];
                        const advancePaid = payments
                          .filter((p: any) => p.type === "advance")
                          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                        
                        const invoicePaid = payments
                          .filter((p: any) => p.type !== "advance")
                          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                        
                        const totalPaid = advancePaid + invoicePaid;
                        
                        // Outstanding balance should only be calculated for shipped/delivered orders
                        const outstanding = (order.status === "shipped" || order.status === "delivered") 
                          ? Math.max(0, order.invoice.amount - totalPaid)
                          : 0;
                        
                        return {
                          total: order.invoice.amount,
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
                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {order.invoiceNumber || order.orderNumber}
                            </div>
                            {order.invoiceNumber && (
                              <div className="text-xs text-gray-500">
                                Order: {order.orderNumber}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900">{order.client?.name || "Unknown Client"}</div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              <span className="ml-1 capitalize">
                                {order.status.replace("_", " ")}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(metrics.total, order.currency)}
                              </div>
                              <div className="text-xs text-gray-600">
                                Paid: {formatCurrency(metrics.paid, order.currency)}
                                {metrics.advancePaid > 0 && (
                                  <span className="text-blue-600">
                                    {" "}({formatCurrency(metrics.advancePaid, order.currency)} advance)
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs font-medium ${metrics.outstanding > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                Outstanding: {metrics.outstanding > 0 ? formatCurrency(metrics.outstanding, order.currency) : 
                                             order.status === "shipped" || order.status === "delivered" ? formatCurrency(0, order.currency) : 
                                             "Not due"}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            <div className="text-sm font-medium text-gray-900">
                              {order.items?.reduce((total, item) => total + (item.quantityKg || 0), 0).toLocaleString()} kg
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            <div className="truncate" title={order.deliveryDate ? formatDate(order.deliveryDate) : 'Not set'}>
                              {order.deliveryDate ? formatDate(order.deliveryDate) : 'Not set'}
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
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No international orders found</h3>
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
              <p className="text-sm text-gray-600 mt-1">Manage your international customers</p>
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
            {clients?.map((client) => (
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
                  
                  {/* Secondary Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedClientForEdit(client);
                        setIsEditCustomerOpen(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedClientForEdit(client);
                        setIsDeleteConfirmOpen(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {clients?.length === 0 && (
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
        type="international"
      />

      <EditCustomerModal
        isOpen={isEditCustomerOpen}
        onClose={() => {
          setIsEditCustomerOpen(false);
          setSelectedClientForEdit(null);
        }}
        client={selectedClientForEdit}
      />

      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setSelectedClientForEdit(null);
        }}
        client={selectedClientForEdit}
        onSuccess={() => {
          toast.success("Customer deleted successfully!");
        }}
      />
    </div>
  );
}