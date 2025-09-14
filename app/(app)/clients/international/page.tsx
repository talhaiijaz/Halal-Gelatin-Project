"use client";

import { useState } from "react";
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
  Trash2
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { getCurrentFiscalYear, getFiscalYearOptions, getFiscalYearLabel } from "@/app/utils/fiscalYear";

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

  const router = useRouter();



  // Internal tabs (Dashboard, Orders, Customers)
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "orders", label: "Orders", icon: <Package className="h-4 w-4" /> },
    { id: "customers", label: "Customers", icon: <LayoutGrid className="h-4 w-4" /> },
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
  });

  const orderStats = useQuery(api.orders.getStats, {
    clientType: "international",
  });
  const clientSummary = useQuery(api.clients.getClientSummary, { type: "international" });

  // Filter orders
  const filteredOrders = orders?.filter((order) => {
    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesCustomer = !customerFilter || order.client?.name?.toLowerCase().includes(customerFilter.toLowerCase());
    return matchesStatus && matchesCustomer;
  });

  // Get unique customers for filter
  const uniqueCustomers = orders 
    ? Array.from(new Set(orders.map(order => order.client?.name).filter(Boolean) as string[])).sort()
    : [];

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
              <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">International Clients</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your international client relationships
            </p>
          </div>
        <button
          onClick={() => setIsAddCustomerOpen(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </button>
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
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.totalClients || 0}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Active Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.activeOrders || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Total Orders: {stats?.totalOrders || 0}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats?.totalRevenue || 0)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Outstanding</p>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {(stats as any)?.outstandingByCurrency ? 
                  Object.entries((stats as any).outstandingByCurrency)
                    .filter(([currency, amount]) => (amount as number) > 0)
                    .map(([currency, amount]) => (
                      <div key={currency} className="text-lg">
                        {formatCurrency(amount as number, currency)}
                      </div>
                    ))
                  : formatCurrency(stats?.outstandingAmount || 0, 'USD')
                }
              </div>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Quantity (kg)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {(orderStats?.totalQuantity || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Order Status Overview */}
          {orderStats && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Order Status Overview
              </h2>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {Object.entries(orderStats.statusCounts).map(([status, count]) => (
                  <div key={status} className="text-center">
                    <div className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(status)} mb-2`}>
                      {status.replace("_", " ")}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* Client Summary Table */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Client Summary
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Outstanding amounts and total quantities by client
              </p>
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
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No clients found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Start by adding your first international client.
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
        <div className="space-y-4">
          {/* Filters */}
          <div className="card p-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Processing Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_production">In Production</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer
                </label>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                >
                  <option value="">All Customers</option>
                  {uniqueCustomers.map(customer => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fiscal Year
                </label>
                <select
                  value={selectedFiscalYear || ""}
                  onChange={(e) => setSelectedFiscalYear(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                >
                  <option value="">All Fiscal Years</option>
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
              <table className="w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                      Invoice Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                      Total Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[13%]">
                      Delivery Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[13%]">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[7%]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500">No orders found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders?.map((order) => (
                      <tr
                        key={order._id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedOrderId(order._id)}
                      >
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">
                          <div className="truncate" title={order.invoiceNumber || order.orderNumber}>
                            {order.invoiceNumber || order.orderNumber}
                          </div>
                          {order.invoiceNumber && (
                            <div className="text-xs text-gray-500 truncate">
                              Order: {order.orderNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 max-w-0">
                          <div className="w-full">
                            <div className="text-sm font-medium text-gray-900 truncate" title={order.client?.name}>
                              {order.client?.name}
                            </div>
                            <div className="text-sm text-gray-500 truncate" title={`${order.client?.city}, ${order.client?.country}`}>
                              {order.client?.city}, {order.client?.country}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(order.totalAmount, order.currency)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          <div className="truncate" title={order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : 'Not set'}>
                            {order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : 'Not set'}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          <div className="truncate" title={formatDate(order.createdAt)}>
                            {formatDate(order.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm font-medium">
                          <div className="flex items-center justify-center">
                            <div className="text-primary p-1 rounded">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </div>
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

      {/* Customers Tab */}
      {activeTab === "customers" && (
        <div className="space-y-4">
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
                {/* Header with icon, name and status */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 p-3 bg-primary/10 rounded-lg">
                      <Building2 className="h-6 w-6 text-primary" />
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