"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  Truck, 
  Package, 
  MapPin, 
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Download,
  Search,
  Filter,
  Navigation
} from "lucide-react";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Id } from "@/convex/_generated/dataModel";

export default function DeliveriesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "thisWeek" | "thisMonth">("all");

  // Calculate date range based on filter
  const getDateRange = () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (dateFilter) {
      case "today":
        return { startDate: startOfDay.getTime(), endDate: now.getTime() };
      case "thisWeek":
        return { startDate: startOfWeek.getTime(), endDate: now.getTime() };
      case "thisMonth":
        return { startDate: startOfMonth.getTime(), endDate: now.getTime() };
      default:
        return {};
    }
  };

  const { startDate, endDate } = getDateRange();

  // Fetch deliveries with filters
  const deliveries = useQuery(api.deliveries.list, {
    status: statusFilter === "all" ? undefined : statusFilter,
    startDate,
    endDate,
  });

  const stats = useQuery(api.deliveries.getStats, {});
  const updateStatus = useMutation(api.deliveries.updateStatus);

  // Filter deliveries based on search
  const filteredDeliveries = deliveries?.filter(delivery => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      delivery.order?.invoiceNumber?.toLowerCase().includes(searchLower) ||
      delivery.client?.name?.toLowerCase().includes(searchLower) ||
      delivery.trackingNumber?.toLowerCase().includes(searchLower) ||
      delivery.address?.toLowerCase().includes(searchLower)
    );
  });

  const handleStatusUpdate = async (deliveryId: Id<"deliveries">, newStatus: string) => {
    try {
      await updateStatus({
        deliveryId,
        status: newStatus as any,
      });
      toast.success("Delivery status updated successfully");
    } catch (error) {
      toast.error("Failed to update delivery status");
    }
  };

  const exportToCSV = () => {
    if (!filteredDeliveries) return;

    const csvContent = [
      ["Order", "Client", "Status", "Tracking Number", "Address", "Carrier", "Scheduled Date", "Delivered Date"],
      ...filteredDeliveries.map(delivery => [
        delivery.order?.invoiceNumber || "",
        delivery.client?.name || "",
        delivery.status,
        delivery.trackingNumber || "",
        delivery.address || "",
        delivery.carrier || "",
        delivery.scheduledDate ? new Date(delivery.scheduledDate).toLocaleDateString() : "",
        delivery.deliveredDate ? new Date(delivery.deliveredDate).toLocaleDateString() : ""
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deliveries-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Deliveries exported successfully");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "in_transit":
        return <Truck className="h-4 w-4" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4" />;
      case "failed":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in_transit":
        return "bg-blue-100 text-blue-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track and manage order deliveries
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Deliveries</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats ? stats.total : <Skeleton width={50} />}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Transit</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats ? stats.inTransit : <Skeleton width={50} />}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Truck className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Delivered</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats ? stats.delivered : <Skeleton width={50} />}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Delivery Rate</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats ? `${stats.deliveryRate.toFixed(1)}%` : <Skeleton width={70} />}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Navigation className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search deliveries..."
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
          <option value="pending">Pending</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="thisWeek">This Week</option>
          <option value="thisMonth">This Month</option>
        </select>

        <div className="flex items-center text-sm text-gray-600">
          {filteredDeliveries ? `${filteredDeliveries.length} deliveries found` : <Skeleton width={100} />}
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tracking
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scheduled
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!filteredDeliveries ? (
                // Loading skeletons
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton width={100} /></td>
                    <td className="px-6 py-4"><Skeleton width={150} /></td>
                    <td className="px-6 py-4"><Skeleton width={80} /></td>
                    <td className="px-6 py-4"><Skeleton width={120} /></td>
                    <td className="px-6 py-4"><Skeleton width={200} /></td>
                    <td className="px-6 py-4"><Skeleton width={100} /></td>
                    <td className="px-6 py-4"><Skeleton width={120} /></td>
                  </tr>
                ))
              ) : filteredDeliveries.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Truck className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No deliveries found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {searchTerm || statusFilter !== "all" || dateFilter !== "all"
                        ? "Try adjusting your filters"
                        : "No deliveries have been scheduled yet."}
                    </p>
                  </td>
                </tr>
              ) : (
                // Delivery rows
                filteredDeliveries.map((delivery) => (
                  <tr key={delivery._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {delivery.order?.invoiceNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-0">
                      <div className="text-sm text-gray-900 truncate" title={delivery.client?.name}>{delivery.client?.name}</div>
                      <div className="text-xs text-gray-500 capitalize truncate" title={delivery.client?.type}>{delivery.client?.type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(delivery.status)}`}>
                        {getStatusIcon(delivery.status)}
                        <span className="ml-1 capitalize">
                          {delivery.status.replace("_", " ")}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{delivery.trackingNumber || "-"}</div>
                      <div className="text-xs text-gray-500">{delivery.carrier || "Not assigned"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={delivery.address}>
                        <MapPin className="inline h-3 w-3 mr-1" />
                        {delivery.address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {delivery.scheduledDate 
                          ? new Date(delivery.scheduledDate).toLocaleDateString()
                          : "-"}
                      </div>
                      {delivery.deliveredDate && (
                        <div className="text-xs text-green-600">
                          Delivered: {new Date(delivery.deliveredDate).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={delivery.status}
                        onChange={(e) => handleStatusUpdate(delivery._id, e.target.value)}
                        className="text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_transit">In Transit</option>
                        <option value="delivered">Delivered</option>
                        <option value="failed">Failed</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}