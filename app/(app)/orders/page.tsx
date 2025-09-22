"use client";

import { useState, Suspense, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Plus, Package, Clock, CheckCircle2, XCircle, Truck, Download, Search } from "lucide-react";
import CreateOrderModal from "@/app/components/orders/CreateOrderModal";
import OrderDetailModal from "@/app/components/orders/OrderDetailModal";

import { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useSearchParams, useRouter } from "next/navigation";
import { getFiscalYearOptions } from "@/app/utils/fiscalYear";
import { timestampToDateString } from "@/app/utils/dateUtils";
import { formatCurrency } from "@/app/utils/currencyFormat";
import { usePagination } from "@/app/hooks/usePagination";
import Pagination from "@/app/components/ui/Pagination";
import { shouldHighlightOrderYellowWithTransfers, shouldHighlightOrderRed, getOrderHighlightClassesWithRed, getOrderTextHighlightClassesWithRed } from "@/app/utils/orderHighlighting";

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // Initialize search from URL (?search=...)
  useEffect(() => {
    const initial = searchParams?.get("search") || "";
    if (initial && initial !== searchTerm) {
      setSearchTerm(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | undefined>(undefined);

  // Pagination hook
  const ordersPagination = usePagination({ pageSize: 10 });

  // Fetch orders with filters and pagination
  const ordersData = useQuery(api.orders.list, {
    fiscalYear: selectedFiscalYear,
    searchTerm: searchTerm || undefined,
    paginationOpts: ordersPagination.paginationOpts,
  });

  // Check bank validation
  const bankValidation = useQuery(api.banks.checkAllBanksHaveCountries);
  // Check order validation
  const orderValidation = useQuery(api.orders.checkAllOrdersHaveBanks);
  // Fetch bank accounts for highlighting
  const bankAccounts = useQuery(api.banks.list);
  
  // Get invoice IDs for batch transfer status check (from orders that have invoices)
  const ordersList = Array.isArray(ordersData) ? ordersData : ordersData?.page || [];
  const invoiceIds = ordersList
    ?.filter(order => order.invoice?._id)
    ?.map(order => order.invoice!._id) || [];
  const batchTransferStatus = useQuery(api.interBankTransfers.getBatchTransferStatus, 
    invoiceIds.length > 0 ? { invoiceIds } : "skip"
  );


  // Helper function to calculate financial metrics for an order
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
    const orders = Array.isArray(ordersData) ? ordersData : ordersData?.page || [];
    if (!orders.length) return;

    const csvContent = [
      ["Invoice Number", "Client", "Status", "Total Amount", "Paid Amount", "Receivables Amount", "Currency", "Bloom & Quantity", "Factory Departure Date"],
      ...orders.map(order => {
        const metrics = calculateFinancialMetrics(order);
        return [
          order.invoiceNumber,
          order.client?.name || "",
          order.status,
          (metrics.total as number).toFixed(2),
          (metrics.paid as number).toFixed(2),
          (metrics.outstanding as number).toFixed(2),
          order.currency,
          order.items && order.items.length > 0 
            ? order.items.map(item => 
                item.bloom ? `${item.bloom}: ${(item.quantityKg || 0).toLocaleString()} kg` : `No Bloom: ${(item.quantityKg || 0).toLocaleString()} kg`
              ).join(' | ')
            : "No Items",
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
    a.download = `orders-${timestampToDateString(Date.now())}.csv`;
    a.click();
    toast.success("Orders exported successfully");
  };

  // Orders are now filtered by the backend, no need for frontend filtering
  const filteredOrders = Array.isArray(ordersData) ? ordersData : ordersData?.page || [];

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
            disabled={(bankValidation && !bankValidation.allHaveCountries) || (orderValidation && !orderValidation.allHaveBanks)}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
              (bankValidation && !bankValidation.allHaveCountries) || (orderValidation && !orderValidation.allHaveBanks)
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-orange-600 hover:bg-orange-700"
            }`}
            title={
              bankValidation && !bankValidation.allHaveCountries 
                ? "Cannot create orders until all banks have countries assigned" 
                : orderValidation && !orderValidation.allHaveBanks
                ? "Cannot create orders until all existing orders have banks assigned"
                : ""
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Order
          </button>
        </div>
      </div>

      {/* FAB for creating order on mobile */}
      <div className="lg:hidden fixed bottom-20 right-5 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          disabled={(bankValidation && !bankValidation.allHaveCountries) || (orderValidation && !orderValidation.allHaveBanks)}
          className={`h-14 w-14 rounded-full shadow-lg flex items-center justify-center text-white ${
            (bankValidation && !bankValidation.allHaveCountries) || (orderValidation && !orderValidation.allHaveBanks)
              ? "bg-gray-400"
              : "bg-orange-600 hover:bg-orange-700 active:bg-orange-800"
          }`}
          aria-label="Create Order"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Bank Validation Warning */}
      {bankValidation && !bankValidation.allHaveCountries && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Package className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Order Creation Blocked
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  Cannot create new orders until all bank accounts have countries assigned. 
                  This is required for proper transaction processing and order management.
                </p>
                <p className="mt-2 font-medium">
                  Please visit the Finance → Banks section to assign countries to all bank accounts.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-end">
          {/* Universal Search */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchTerm(val);
                  const url = new URL(window.location.href);
                  if (val) url.searchParams.set("search", val);
                  else url.searchParams.delete("search");
                  router.replace(url.pathname + (url.search ? url.search : ""));
                }}
                placeholder="Search orders, invoices, clients..."
                className="pl-10 pr-3 py-2 w-full h-11 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Fiscal Year Filter */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
            <select
              value={selectedFiscalYear || ""}
              onChange={(e) => setSelectedFiscalYear(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 h-11 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Years</option>
              {getFiscalYearOptions().map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Order Validation Warning */}
      {orderValidation && !orderValidation.allHaveBanks && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Package className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Order Creation Blocked
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  Cannot create new orders until all existing orders have banks assigned. 
                  This is required for proper payment processing and order management.
                </p>
                <p className="mt-2 font-medium">
                  Orders missing banks ({orderValidation.ordersWithoutBanks.length}):
                </p>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  {orderValidation.ordersWithoutBanks.map((order: any) => (
                    <li key={order._id}>
                      <button
                        onClick={() => setSelectedOrderId(order._id)}
                        className="text-red-600 hover:text-red-800 underline"
                      >
                        {order.orderNumber} ({order.invoiceNumber})
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-medium">
                  ⚠️ You cannot create new orders until all existing orders have banks assigned.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders List - Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {!ordersData ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4">
              <Skeleton height={18} width={160} />
              <div className="mt-3">
                <Skeleton height={14} />
                <Skeleton height={14} width={120} />
              </div>
            </div>
          ))
        ) : (sortedOrders && sortedOrders.length > 0) ? (
          sortedOrders.map((order) => {
            const metrics = calculateFinancialMetrics(order);
            const bankAccount = bankAccounts?.find(bank => bank._id === order.bankAccountId);
            const transferStatus = order.invoice?._id ? batchTransferStatus?.[order.invoice._id] : undefined;
            const shouldHighlightYellow = shouldHighlightOrderYellowWithTransfers(order, bankAccount, transferStatus);
            const shouldHighlightRed = shouldHighlightOrderRed(order, bankAccount, transferStatus);
            return (
              <button
                key={order._id}
                className={`w-full text-left bg-white rounded-lg shadow p-4 active:bg-gray-50 ${getOrderHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}
                onClick={() => setSelectedOrderId(order._id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-base font-semibold ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>
                      {order.invoiceNumber}
                    </div>
                    <div className={`mt-1 text-sm ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>{order.client?.name || "Unknown Client"}</div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    <span className="ml-1 capitalize">{order.status.replace("_", " ")}</span>
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Amount</div>
                    <div className={`text-sm font-medium ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>
                      {formatCurrency(metrics.total as number, order.currency as any)}
                    </div>
                    <div className="text-xs text-gray-500">Paid</div>
                    <div className={`text-xs ${shouldHighlightYellow || shouldHighlightRed ? 'text-gray-700' : 'text-gray-600'}`}>{formatCurrency(metrics.paid as number, order.currency as any)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Receivables</div>
                    <div className={`text-sm font-medium ${(metrics.outstanding as number) > 0 ? 'text-red-600' : shouldHighlightYellow || shouldHighlightRed ? 'text-gray-700' : 'text-gray-500'}`}>
                      {(metrics.outstanding as number) > 0 ? formatCurrency(metrics.outstanding as number, order.currency as any) : order.status === "shipped" || order.status === "delivered" ? formatCurrency(0, order.currency as any) : "Not due"}
                    </div>
                    <div className="text-xs text-gray-500">Departure</div>
                    <div className={`text-xs ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>{order.factoryDepartureDate ? new Date(order.factoryDepartureDate).toLocaleDateString() : 'Not set'}</div>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
            <p className="mt-1 text-sm text-gray-500">{searchTerm || selectedFiscalYear ? "Try adjusting your filters" : "Get started by creating a new order."}</p>
          </div>
        )}
      </div>

      {/* Orders Table - Desktop */}
      <div className="hidden lg:block bg-white shadow overflow-hidden sm:rounded-md">
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
              {!ordersData ? (
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
                  // Find the associated bank account
                  const bankAccount = bankAccounts?.find(bank => bank._id === order.bankAccountId);
                  const transferStatus = order.invoice?._id ? batchTransferStatus?.[order.invoice._id] : undefined;
                  const shouldHighlightYellow = shouldHighlightOrderYellowWithTransfers(order, bankAccount, transferStatus);
                  const shouldHighlightRed = shouldHighlightOrderRed(order, bankAccount, transferStatus);
                  
                  return (
                    <tr 
                      key={order._id} 
                      className={`${getOrderHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)} hover:bg-gray-50 cursor-pointer transition-colors`}
                      onClick={() => setSelectedOrderId(order._id)}
                    >
                      <td className="px-4 py-4" style={{width: '15%'}}>
                        <div className={`text-sm font-medium ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>
                          {order.invoiceNumber}
                        </div>
                      </td>
                      <td className="px-4 py-4" style={{width: '20%'}}>
                        <div className={`text-sm ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)} break-words`}>{order.client?.name || "Unknown Client"}</div>
                      </td>
                      <td className="px-4 py-4" style={{width: '12%'}}>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                            <span className="ml-1 capitalize">
                              {order.status.replace("_", " ")}
                            </span>
                          </span>
                          {(!order.bankAccountId || order.bankAccountId === null) && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              No Bank
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center" style={{width: '18%'}}>
                        <div className="space-y-1">
                          <div className={`text-sm font-medium ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>
                            {formatCurrency(metrics.total as number, order.currency as "USD" | "EUR" | "PKR" | "AED")}
                          </div>
                          <div className={`text-xs ${shouldHighlightYellow || shouldHighlightRed ? 'text-gray-700' : 'text-gray-600'}`}>
                            Paid: {formatCurrency(metrics.paid as number, order.currency as "USD" | "EUR" | "PKR" | "AED")}
                            {(metrics.advancePaid as number) > 0 && (
                              <span className="text-blue-600">
                                {" "}({formatCurrency(metrics.advancePaid as number, order.currency as "USD" | "EUR" | "PKR" | "AED")} advance)
                              </span>
                            )}
                          </div>
                          <div className={`text-xs font-medium ${(metrics.outstanding as number) > 0 ? 'text-red-600' : shouldHighlightYellow || shouldHighlightRed ? 'text-gray-700' : 'text-gray-500'}`}>
                            Receivables: {(metrics.outstanding as number) > 0 ? formatCurrency(metrics.outstanding as number, order.currency as "USD" | "EUR" | "PKR" | "AED") : 
                                         order.status === "shipped" || order.status === "delivered" ? formatCurrency(0, order.currency as "USD" | "EUR" | "PKR" | "AED") : 
                                         "Not due"}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm" style={{width: '20%'}}>
                        <div className={`space-y-1 ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`}>
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
                      <td className="px-4 py-4 text-sm" style={{width: '15%'}}>
                        <div className={`truncate ${getOrderTextHighlightClassesWithRed(shouldHighlightYellow, shouldHighlightRed)}`} title={order.factoryDepartureDate ? new Date(order.factoryDepartureDate).toLocaleDateString() : 'Not set'}>
                          {order.factoryDepartureDate ? new Date(order.factoryDepartureDate).toLocaleDateString() : 'Not set'}
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
                          disabled={(bankValidation && !bankValidation.allHaveCountries) || (orderValidation && !orderValidation.allHaveBanks)}
                          className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                            (bankValidation && !bankValidation.allHaveCountries) || (orderValidation && !orderValidation.allHaveBanks)
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-primary hover:bg-primary-dark"
                          }`}
                          title={
                            bankValidation && !bankValidation.allHaveCountries 
                              ? "Cannot create orders until all banks have countries assigned" 
                              : orderValidation && !orderValidation.allHaveBanks
                              ? "Cannot create orders until all existing orders have banks assigned"
                              : ""
                          }
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
        {ordersData && (Array.isArray(ordersData) ? ordersData : ordersData?.page || []).length > 0 && (
          <Pagination
            currentPage={ordersPagination.currentPage}
            totalPages={Math.ceil((!Array.isArray(ordersData) ? ordersData.totalCount || 0 : 0) / ordersPagination.pageSize)}
            onPageChange={ordersPagination.goToPage}
            isLoading={!ordersData}
          />
        )}
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