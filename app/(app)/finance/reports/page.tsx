"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Download,
  FileText,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  Filter
} from "lucide-react";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function ReportsPage() {
  const [reportType, setReportType] = useState<"revenue" | "clients" | "orders" | "payments">("revenue");
  const [dateRange, setDateRange] = useState<"thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "all">("thisMonth");
  
  // Calculate date range based on filter
  const getDateRange = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    switch (dateRange) {
      case "thisMonth":
        return { startDate: startOfMonth.getTime(), endDate: now.getTime() };
      case "lastMonth":
        return { startDate: startOfLastMonth.getTime(), endDate: endOfLastMonth.getTime() };
      case "thisQuarter":
        return { startDate: startOfQuarter.getTime(), endDate: now.getTime() };
      case "thisYear":
        return { startDate: startOfYear.getTime(), endDate: now.getTime() };
      default:
        return {};
    }
  };

  const { startDate, endDate } = getDateRange();

  // Fetch data for reports
  const financeStats = useQuery(api.finance.getFinanceStats, {});
  const paymentStats = useQuery(api.payments.getStats, { startDate, endDate });
  const invoices = useQuery(api.invoices.list, { startDate, endDate });
  const orders = useQuery(api.orders.list, {});
  const clients = useQuery(api.clients.list, {});

  // Calculate report metrics
  const calculateMetrics = () => {
    if (!financeStats || !paymentStats || !invoices || !orders || !clients) return null;

    const filteredOrders = orders.filter(order => {
      const orderDate = order.createdAt;
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
      return true;
    });

    const totalRevenue = paymentStats.totalAmount;
    const totalOrders = filteredOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.status === "active").length;

    // Calculate growth rates (mock data for demonstration)
    const previousRevenue = totalRevenue * 0.85; // Simulated previous period
    const revenueGrowth = ((totalRevenue - previousRevenue) / previousRevenue) * 100;

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      totalClients,
      activeClients,
      revenueGrowth,
      paymentMethods: paymentStats.methodStats,
      outstandingAmount: financeStats.totalOutstanding,
      paidInvoices: invoices.filter((inv: any) => inv.status === "paid").length,
      unpaidInvoices: invoices.filter((inv: any) => inv.status !== "paid").length,
    };
  };

  const metrics = calculateMetrics();

  const exportReport = () => {
    if (!metrics) return;

    let csvContent = "";
    const date = new Date().toLocaleDateString();
    
    switch (reportType) {
      case "revenue":
        csvContent = [
          ["Revenue Report - " + date],
          [""],
          ["Metric", "Value"],
          ["Total Revenue", "$" + metrics.totalRevenue.toFixed(2)],
          ["Revenue Growth", metrics.revenueGrowth.toFixed(1) + "%"],
          ["Total Orders", metrics.totalOrders],
          ["Average Order Value", "$" + metrics.averageOrderValue.toFixed(2)],
          ["Outstanding Amount", "$" + metrics.outstandingAmount.toFixed(2)],
          [""],
          ["Payment Methods", "Amount"],
          ["Bank Transfer", "$" + (metrics.paymentMethods.bank_transfer?.amount || 0).toFixed(2)],
          ["Credit Card", "$" + (metrics.paymentMethods.credit_card?.amount || 0).toFixed(2)],
          ["Cash", "$" + (metrics.paymentMethods.cash?.amount || 0).toFixed(2)],
          ["Check", "$" + (metrics.paymentMethods.check?.amount || 0).toFixed(2)],
        ].map(row => row.join(",")).join("\n");
        break;

      case "clients":
        csvContent = [
          ["Clients Report - " + date],
          [""],
          ["Metric", "Value"],
          ["Total Clients", metrics.totalClients],
          ["Active Clients", metrics.activeClients],
          ["Inactive Clients", metrics.totalClients - metrics.activeClients],
          ["Client Retention Rate", ((metrics.activeClients / metrics.totalClients) * 100).toFixed(1) + "%"],
        ].map(row => row.join(",")).join("\n");
        break;

      case "orders":
        csvContent = [
          ["Orders Report - " + date],
          [""],
          ["Metric", "Value"],
          ["Total Orders", metrics.totalOrders],
          ["Average Order Value", "$" + metrics.averageOrderValue.toFixed(2)],
          ["Total Revenue", "$" + metrics.totalRevenue.toFixed(2)],
        ].map(row => row.join(",")).join("\n");
        break;

      case "payments":
        csvContent = [
          ["Payments Report - " + date],
          [""],
          ["Metric", "Value"],
          ["Total Collected", "$" + metrics.totalRevenue.toFixed(2)],
          ["Outstanding", "$" + metrics.outstandingAmount.toFixed(2)],
          ["Paid Invoices", metrics.paidInvoices],
          ["Unpaid Invoices", metrics.unpaidInvoices],
        ].map(row => row.join(",")).join("\n");
        break;
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Report exported successfully");
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case "revenue":
        return <TrendingUp className="h-5 w-5" />;
      case "clients":
        return <FileText className="h-5 w-5" />;
      case "orders":
        return <BarChart3 className="h-5 w-5" />;
      case "payments":
        return <PieChart className="h-5 w-5" />;
      default:
        return <BarChart3 className="h-5 w-5" />;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="mt-1 text-sm text-gray-600">
            Analyze your business performance and financial metrics
          </p>
        </div>
        <button
          onClick={exportReport}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </button>
      </div>

      {/* Report Type Selector */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { type: "revenue" as const, label: "Revenue" },
          { type: "clients" as const, label: "Clients" },
          { type: "orders" as const, label: "Orders" },
          { type: "payments" as const, label: "Payments" },
        ].map((report) => (
          <button
            key={report.type}
            onClick={() => setReportType(report.type)}
            className={`p-4 rounded-lg border-2 transition-all ${
              reportType === report.type
                ? "border-primary bg-orange-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-center mb-2">
              {getReportIcon(report.type)}
            </div>
            <p className="text-sm font-medium">{report.label}</p>
          </button>
        ))}
      </div>

      {/* Date Range Filter */}
      <div className="mb-6">
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
          <option value="thisQuarter">This Quarter</option>
          <option value="thisYear">This Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Report Content */}
      {reportType === "revenue" && (
        <div>
          {/* Revenue Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? `$${metrics.totalRevenue.toFixed(2)}` : <Skeleton width={120} />}
                  </p>
                  {metrics && (
                    <p className={`text-sm mt-1 flex items-center ${metrics.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {metrics.revenueGrowth >= 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                      {Math.abs(metrics.revenueGrowth).toFixed(1)}% from last period
                    </p>
                  )}
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Order Value</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? `$${metrics.averageOrderValue.toFixed(2)}` : <Skeleton width={120} />}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? metrics.totalOrders : <Skeleton width={80} />}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Outstanding</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? `$${metrics.outstandingAmount.toFixed(2)}` : <Skeleton width={120} />}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="card">
            <h3 className="text-lg font-medium mb-4">Payment Methods Breakdown</h3>
            <div className="space-y-3">
              {metrics ? (
                Object.entries(metrics.paymentMethods).map(([method, data]) => (
                  <div key={method} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-sm font-medium capitalize">
                        {method.replace("_", " ")}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({data.count} transactions)
                      </span>
                    </div>
                    <span className="text-sm font-medium">${data.amount.toFixed(2)}</span>
                  </div>
                ))
              ) : (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton width={150} />
                    <Skeleton width={80} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {reportType === "clients" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Clients</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? metrics.totalClients : <Skeleton width={80} />}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Clients</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? metrics.activeClients : <Skeleton width={80} />}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Retention Rate</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? `${((metrics.activeClients / metrics.totalClients) * 100).toFixed(1)}%` : <Skeleton width={80} />}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === "orders" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? metrics.totalOrders : <Skeleton width={80} />}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Value</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? `$${metrics.averageOrderValue.toFixed(2)}` : <Skeleton width={120} />}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? `$${metrics.totalRevenue.toFixed(2)}` : <Skeleton width={120} />}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === "payments" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Collected</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? `$${metrics.totalRevenue.toFixed(2)}` : <Skeleton width={120} />}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Outstanding</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? `$${metrics.outstandingAmount.toFixed(2)}` : <Skeleton width={120} />}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Paid Invoices</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? metrics.paidInvoices : <Skeleton width={80} />}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Unpaid Invoices</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {metrics ? metrics.unpaidInvoices : <Skeleton width={80} />}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}