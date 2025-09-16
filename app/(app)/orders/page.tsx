"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Plus, Eye, Package, Clock, CheckCircle, CheckCircle2, XCircle, Truck, Archive, Download, Search } from "lucide-react";
import CreateOrderModal from "@/app/components/orders/CreateOrderModal";
import OrderDetailModal from "@/app/components/orders/OrderDetailModal";

import { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useSearchParams } from "next/navigation";
import { getCurrentFiscalYear, getFiscalYearOptions, getFiscalYearLabel } from "@/app/utils/fiscalYear";

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | undefined>(undefined);


  // Fetch orders with filters
  const orders = useQuery(api.orders.list, {
    fiscalYear: selectedFiscalYear,
  });

  const formatCurrency = (amount: number, currency: string) => {
    // For EUR, use custom formatting to ensure symbol appears before number
    if (currency === 'EUR') {
      return `€${new Intl.NumberFormat('en-DE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount || 0)}`;
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
    }).format(amount || 0);
  };

  // Helper function to calculate financial metrics for an order
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "in_production":
        return <Package className="h-4 w-4" />;
      case "shipped":
        return <Truck className="h-4 w-4" />;
      case "delivered":
        return <CheckCircle2 className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
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



  const exportToCSV = () => {
    if (!orders) return;

    const csvContent = [
      ["Invoice Number", "Client", "Status", "Total Amount", "Paid Amount", "Outstanding Amount", "Currency", "Quantity (kg)", "Delivery Date", "Factory Departure Date"],
      ...orders.map(order => {
        const metrics = calculateFinancialMetrics(order);
        return [
          order.invoiceNumber || order.orderNumber,
          order.client?.name || "",
          order.status,
          metrics.total.toFixed(2),
          metrics.paid.toFixed(2),
          metrics.outstanding.toFixed(2),
          order.currency,
          order.items?.reduce((total, item) => total + (item.quantityKg || 0), 0).toFixed(2) || "0",
          order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "Not set",
          order.factoryDepartureDate ? new Date(order.factoryDepartureDate).toLocaleDateString() : 
            order.orderCreationDate ? new Date(order.orderCreationDate).toLocaleDateString() : 
            new Date(order.createdAt).toLocaleDateString()
        ];
      })
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Orders exported successfully");
  };

  // Filter orders based on search term
  const filteredOrders = orders?.filter(order => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (order.invoiceNumber || order.orderNumber).toLowerCase().includes(searchLower) ||
      order.client?.name?.toLowerCase().includes(searchLower) ||
      order.client?.city?.toLowerCase().includes(searchLower) ||
      order.client?.country?.toLowerCase().includes(searchLower) ||
      order.status.toLowerCase().includes(searchLower) ||
      order.currency.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Sort filtered orders by status priority
  const statusPriority = {
    pending: 1,
    in_production: 2,
    shipped: 3,
    delivered: 4,
    cancelled: 5
  };

  const sortedOrders = filteredOrders.sort((a, b) => {
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


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-2">
            Manage and track all customer orders
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          {/* Universal Search */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search orders, invoices, clients..."
                className="pl-10 pr-3 py-2 w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Fiscal Year Filter */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
            <select
              value={selectedFiscalYear || ""}
              onChange={(e) => setSelectedFiscalYear(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
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
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
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
                  Fac. Dep. Date
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
                    <td className="px-4 py-4"><Skeleton /></td>
                  </tr>
                ))
              ) : (sortedOrders && sortedOrders.length > 0) ? (
                sortedOrders.map((order) => {
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
                          {getStatusIcon(order.status)}
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
                        <div className="truncate" title={order.factoryDepartureDate ? new Date(order.factoryDepartureDate).toLocaleDateString() : 'Not set'}>
                          {order.factoryDepartureDate ? new Date(order.factoryDepartureDate).toLocaleDateString() : 'Not set'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <div className="truncate" title={order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'Not set'}>
                          {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'Not set'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                // Empty state when no orders match filters
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {searchTerm || selectedFiscalYear 
                        ? "Try adjusting your filters"
                        : "Get started by creating a new order."}
                    </p>
                    {(!searchTerm && !selectedFiscalYear) && (
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

export default function OrdersPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <OrdersPageContent />
    </Suspense>
  );
}