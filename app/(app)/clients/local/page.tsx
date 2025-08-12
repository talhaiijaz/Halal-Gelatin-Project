"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import TabNavigation, { useTabNavigation } from "@/app/components/TabNavigation";
import CustomerCard from "@/app/components/clients/CustomerCard";
import OrderDetailModal from "@/app/components/orders/OrderDetailModal";
import AddCustomerModal from "@/app/components/clients/AddCustomerModal";
import { 
  Search, 
  Plus, 
  LayoutGrid, 
  Package, 
  TrendingUp,
  Filter,
  Calendar,
  ChevronDown
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

export default function LocalClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("");

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "orders", label: "Orders", icon: <Package className="h-4 w-4" /> },
    { id: "customers", label: "Customers", icon: <LayoutGrid className="h-4 w-4" /> },
  ];

  const { activeTab, setActiveTab } = useTabNavigation(tabs, "dashboard");

  // Fetch data
  const clients = useQuery(api.clients.list, { 
    type: "local",
    search: searchQuery || undefined,
  });

  const orders = useQuery(api.orders.list, { 
    clientType: "local",
  });

  const stats = useQuery(api.clients.getStats, { type: "local" });
  const orderStats = useQuery(api.orders.getStats, { clientType: "local" });

  // Filter orders
  const filteredOrders = orders?.filter(order => {
    if (statusFilter && order.status !== statusFilter) return false;
    if (customerFilter && order.client?.name !== customerFilter) return false;
    if (productFilter) {
      const hasProduct = order.items.some(item => 
        item.product.toLowerCase().includes(productFilter.toLowerCase())
      );
      if (!hasProduct) return false;
    }
    return true;
  });

  // Get unique values for filters
  const uniqueCustomers = [...new Set(orders?.map(o => o.client?.name).filter(Boolean))];
  const uniqueProducts = [...new Set(
    orders?.flatMap(o => o.items.map(i => i.product)) || []
  )];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      in_production: "bg-purple-100 text-purple-800",
      shipped: "bg-indigo-100 text-indigo-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      due: "bg-yellow-100 text-yellow-800",
      partially_paid: "bg-orange-100 text-orange-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Local Clients</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your domestic client base
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
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.totalClients || 0}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {stats?.activeClients || 0} active
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.totalOrders || 0}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {stats?.activeOrders || 0} active
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
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats?.outstandingAmount || 0)}
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

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Average Order Value</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(orderStats?.averageOrderValue || 0)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Quantity (kg)</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {orderStats?.totalQuantity?.toLocaleString() || 0}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Active Orders</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {orderStats?.activeOrders || 0}
              </p>
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
                  <option value="confirmed">Confirmed</option>
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
                  Product
                </label>
                <input
                  type="text"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  placeholder="Search product..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Detail
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Processing Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders?.map((order) => (
                    <tr
                      key={order._id}
                      onClick={() => setSelectedOrderId(order._id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.client?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                          {order.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate">
                          {order.items.map(item => item.product).join(", ")}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {order.invoice ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(order.invoice.status)}`}>
                            {order.invoice.status.replace("_", " ")}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">No invoice</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders?.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No orders found
                </div>
              )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients?.map((client) => (
              <CustomerCard key={client._id} customer={client} />
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

      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        type="local"
      />
    </div>
  );
}