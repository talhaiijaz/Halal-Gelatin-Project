"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  Search, 
  Filter,
  Download,
  Calendar,
  Clock,
  FileText,
  Users,
  Package,
  DollarSign,
  MapPin
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import { timestampToDateString } from "@/app/utils/dateUtils";
import "react-loading-skeleton/dist/skeleton.css";

export default function LogsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Fetch logs with pagination
  const logs = useQuery(api.dashboard.listLogs, { limit: 100 });

  // Compute date threshold based on filter
  const dateThreshold = (() => {
    if (dateFilter === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    if (dateFilter === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.getTime();
    }
    if (dateFilter === "month") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.getTime();
    }
    return 0; // all time
  })();

  // Filter logs based on search and filters
  const filteredLogs = logs?.filter(log => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const meta = log.metadata ? JSON.stringify(log.metadata).toLowerCase() : "";
      if (!log.message.toLowerCase().includes(searchLower) &&
          !log.entityTable.toLowerCase().includes(searchLower) &&
          !log.action.toLowerCase().includes(searchLower) &&
          !meta.includes(searchLower)) {
        return false;
      }
    }
    
    if (entityFilter !== "all" && log.entityTable !== entityFilter) {
      return false;
    }
    
    if (actionFilter !== "all" && log.action !== actionFilter) {
      return false;
    }
    
    if (dateFilter !== "all" && log.createdAt < dateThreshold) {
      return false;
    }
    
    return true;
  });

  // Get unique entity types and actions for filters
  const entityTypes = logs ? Array.from(new Set(logs.map(log => log.entityTable))).sort() : [];
  const actionTypes = logs ? Array.from(new Set(logs.map(log => log.action))).sort() : [];

  const getEntityIcon = (entityTable: string) => {
    switch (entityTable) {
      case "clients":
        return <Users className="h-4 w-4" />;
      case "orders":
        return <Package className="h-4 w-4" />;
      case "payments":
      case "invoices":
        return <DollarSign className="h-4 w-4" />;
      case "deliveries":
        return <MapPin className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800";
      case "update":
        return "bg-blue-100 text-blue-800";
      case "delete":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const exportToCSV = () => {
    if (!filteredLogs) return;

    const csvContent = [
      ["Action", "Entity", "Message", "Timestamp"],
      ...filteredLogs.map(log => [
        log.action.toUpperCase(),
        log.entityTable,
        log.message,
        new Date(log.createdAt).toLocaleString()
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-logs-${timestampToDateString(Date.now())}.csv`;
    a.click();
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage all system activity logs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Entities</option>
          {entityTypes.map(entity => (
            <option key={entity} value={entity}>{entity.charAt(0).toUpperCase() + entity.slice(1)}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Actions</option>
          {actionTypes.map(action => (
            <option key={action} value={action}>{action.charAt(0).toUpperCase() + action.slice(1)}</option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <div className="flex items-center text-sm text-gray-600">
          {logs ? `${filteredLogs?.length || 0} logs found` : <Skeleton width={100} />}
        </div>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!logs ? (
                // Loading skeletons
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton width={80} /></td>
                    <td className="px-6 py-4"><Skeleton width={100} /></td>
                    <td className="px-6 py-4"><Skeleton width={200} /></td>
                    <td className="px-6 py-4"><Skeleton width={120} /></td>
                  </tr>
                ))
              ) : filteredLogs && filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getEntityIcon(log.entityTable)}
                        <span className="ml-2 text-sm font-medium text-gray-900 capitalize">
                          {log.entityTable}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md truncate" title={log.message}>
                        {log.message}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                        {new Date(log.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center mt-1">
                        <Clock className="h-4 w-4 mr-1 text-gray-400" />
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                // Empty state
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <FileText className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No logs found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {searchTerm || entityFilter !== "all" || actionFilter !== "all"
                        ? "Try adjusting your filters"
                        : "No system logs have been generated yet."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
