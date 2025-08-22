"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Plus, Eye, Package, Clock, CheckCircle, XCircle, Truck, Archive, Download, Search } from "lucide-react";
import CreateOrderModal from "@/app/components/orders/CreateOrderModal";
import OrderDetailModal from "@/app/components/orders/OrderDetailModal";

import { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useSearchParams } from "next/navigation";
import { getCurrentFiscalYear, getFiscalYearOptions, getFiscalYearLabel } from "@/app/utils/fiscalYear";

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState<Id<"clients"> | undefined>(undefined);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | undefined>(undefined);

  // Get client filter from URL params
  useEffect(() => {
    const clientId = searchParams.get("client");
    if (clientId) {
      setClientFilter(clientId as Id<"clients">);
    }
  }, [searchParams]);

  // Fetch orders with filters
  const orders = useQuery(api.orders.list, {
    status: statusFilter === "all" ? undefined : statusFilter,
    clientId: clientFilter,
    fiscalYear: selectedFiscalYear,
  });

  const formatCurrency = (amount: number, currency: string) => {
    // Use appropriate locale based on currency
    const locale = currency === 'USD' ? 'en-US' : 
                   currency === 'PKR' ? 'en-PK' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "confirmed":
        return <CheckCircle className="h-4 w-4" />;
      case "in_production":
        return <Package className="h-4 w-4" />;
      case "shipped":
        return <Truck className="h-4 w-4" />;
      case "delivered":
        return <Archive className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "in_production":
        return "bg-purple-100 text-purple-800";
      case "shipped":
        return "bg-indigo-100 text-indigo-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };



  const exportToCSV = () => {
    if (!orders) return;

    const csvContent = [
      ["Order Number", "Client", "Status", "Total Amount", "Currency", "Delivery Date", "Created Date"],
      ...orders.map(order => [
        order.orderNumber,
        order.client?.name || "",
        order.status,
        order.totalAmount.toFixed(2),
        order.currency,
        order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : "Not set",
        new Date(order.createdAt).toLocaleDateString()
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Orders exported successfully");
  };

  // Get client name for filter display
  const clientName = clientFilter && orders?.find(order => order.clientId === clientFilter)?.client?.name;

  // Filter orders based on search term
  const filteredOrders = orders?.filter(order => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.client?.name?.toLowerCase().includes(searchLower) ||
      order.status.toLowerCase().includes(searchLower)
    );
  });

  const clearClientFilter = () => {
    setClientFilter(undefined);
    // Update URL to remove client parameter
    const url = new URL(window.location.href);
    url.searchParams.delete("client");
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-600">
            {clientFilter && clientName 
              ? `Orders for ${clientName}`
              : "Track and manage all customer orders"
            }
          </p>
          {clientFilter && clientName && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Filtered by client
              </span>
              <button
                onClick={clearClientFilter}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="cancelled">Cancelled</option>
          <option value="confirmed">Confirmed</option>
          <option value="delivered">Delivered</option>
          <option value="in_production">In Production</option>
          <option value="pending">Pending</option>
          <option value="shipped">Shipped</option>
        </select>
        <select
          value={selectedFiscalYear || ""}
          onChange={(e) => setSelectedFiscalYear(e.target.value ? Number(e.target.value) : undefined)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="">All Fiscal Years</option>
          {getFiscalYearOptions().map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <div className="flex items-center text-sm text-gray-600">
          {orders ? `${filteredOrders?.length || 0} orders found` : <Skeleton width={100} />}
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed divide-y divide-gray-200">
                            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                  Order Number
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
              {!orders ? (
                // Loading skeletons
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-4"><Skeleton width={100} /></td>
                    <td className="px-4 py-4"><Skeleton height={40} /></td>
                    <td className="px-4 py-4"><Skeleton width={80} /></td>
                    <td className="px-4 py-4"><Skeleton width={100} /></td>
                    <td className="px-4 py-4"><Skeleton width={100} /></td>
                    <td className="px-4 py-4"><Skeleton width={100} /></td>
                    <td className="px-4 py-4"><Skeleton width={40} /></td>
                  </tr>
                ))
              ) : filteredOrders && filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrderId(order._id)}>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">
                    <div className="truncate" title={order.orderNumber}>
                      {order.orderNumber}
                    </div>
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
                      {getStatusIcon(order.status)}
                      <span className="ml-1 capitalize">
                        {order.status.replace("_", " ")}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    <div className="truncate" title={order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : 'Not set'}>
                      {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : 'Not set'}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    <div className="truncate" title={new Date(order.createdAt).toLocaleDateString()}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrderId(order._id);
                        }}
                        className="text-primary hover:text-primary-dark p-1 rounded hover:bg-gray-100"
                        title="View Details"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              ) : (
                // Empty state when no orders match filters
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {searchTerm || statusFilter !== "all" 
                        ? "Try adjusting your filters"
                        : "Get started by creating a new order."}
                    </p>
                    {(!searchTerm && statusFilter === "all") && (
                      <div className="mt-6">
                        <button
                          onClick={() => setIsCreateModalOpen(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark"
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

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          toast.success("Order created successfully");
        }}
      />

      {/* Order Detail Modal */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          isOpen={!!selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
}