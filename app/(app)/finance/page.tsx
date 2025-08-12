"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import TabNavigation, { useTabNavigation } from "@/app/components/TabNavigation";
import RecordPaymentModal from "@/app/components/finance/RecordPaymentModal";
import { 
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Calendar,
  CreditCard,
  Plus,
  Download,
  FileText,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function FinancePage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
  ];

  const { activeTab, setActiveTab } = useTabNavigation(tabs, "dashboard");

  // Fetch dashboard data
  const dashboardStats = useQuery(api.finance.getDashboardStats, { year: selectedYear });
  const monthlyStats = useQuery(api.finance.getMonthlyOrderStats, { year: selectedYear });
  const revenueByType = useQuery(api.finance.getRevenueByCustomerType);
  const topCustomers = useQuery(api.finance.getTopCustomers, { limit: 5 });
  
  // Fetch payments data
  const payments = useQuery(api.payments.list);
  const paymentStats = useQuery(api.payments.getStats);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      bank_transfer: "Bank Transfer",
      check: "Check",
      cash: "Cash",
      credit_card: "Credit Card",
      other: "Other",
    };
    return labels[method] || method;
  };

  const COLORS = ["#B8621B", "#D4722C", "#96501A", "#E88A3C", "#A65E2A"];

  // Prepare pie chart data for revenue by type
  const pieData = revenueByType ? [
    { name: "Local", value: revenueByType.local.revenue },
    { name: "International", value: revenueByType.international.revenue },
  ].filter(d => d.value > 0) : [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor financial performance and manage payments
          </p>
        </div>
        <button
          onClick={() => setIsRecordPaymentOpen(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
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
          {/* Year Selector */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            >
              {[currentYear - 2, currentYear - 1, currentYear].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* This Year's Sale Summary */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedYear} Sales Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-2">
                  <Package className="h-8 w-8 text-primary" />
                  {dashboardStats && (
                    <span className="text-xs text-gray-500">
                      {dashboardStats.activeOrders} active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">Number of Orders</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {dashboardStats?.numberOfOrders || 0}
                </p>
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between mb-2">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-sm text-gray-500">Total Quantity (KG)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatNumber(dashboardStats?.totalQuantityKg || 0)}
                </p>
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-sm text-gray-500">Average Order Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(dashboardStats?.averageOrderAmount || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(dashboardStats?.totalRevenue || 0)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="text-xl font-bold text-green-600 mt-1">
                {formatCurrency(dashboardStats?.totalPaid || 0)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="text-xl font-bold text-orange-600 mt-1">
                {formatCurrency(dashboardStats?.totalOutstanding || 0)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Overdue Invoices</p>
              <p className="text-xl font-bold text-red-600 mt-1">
                {dashboardStats?.overdueInvoices || 0}
              </p>
            </div>
          </div>

          {/* All Time Sales Performance */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              All Time Sales Performance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Orders</p>
                <p className="text-xl font-bold text-gray-900">
                  {dashboardStats?.allTime.totalOrders || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(dashboardStats?.allTime.totalRevenue || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Quantity</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatNumber(dashboardStats?.allTime.totalQuantityKg || 0)} kg
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg Order Value</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(dashboardStats?.allTime.averageOrderValue || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly Orders Chart */}
            <div className="lg:col-span-2 card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Number of Orders per Month
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyStats || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatNumber(Number(value))} />
                  <Legend />
                  <Bar dataKey="orders" fill="#B8621B" name="Total Orders" />
                  <Bar dataKey="activeOrders" fill="#4ADE80" name="Active Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue by Type Pie Chart */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Revenue by Customer Type
              </h2>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Top Customers */}
          {topCustomers && topCustomers.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Top Customers by Revenue
              </h2>
              <div className="space-y-3">
                {topCustomers.map((customer, index) => (
                  <div key={customer.clientId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-xs text-gray-500">
                          {customer.city}, {customer.country} • {customer.orderCount} orders
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(customer.revenue)}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        customer.type === "local" 
                          ? "bg-blue-100 text-blue-800" 
                          : "bg-green-100 text-green-800"
                      }`}>
                        {customer.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          {/* Payment Statistics */}
          {paymentStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-sm text-gray-500">Total Payments</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {paymentStats.totalCount}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(paymentStats.totalAmount)}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Average Payment</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(paymentStats.averagePayment)}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Daily Average</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(paymentStats.dailyAverage)}
                </p>
              </div>
            </div>
          )}

          {/* Payment Methods Breakdown */}
          {paymentStats && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Payment Methods
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(paymentStats.methodStats).map(([method, stats]) => (
                  <div key={method} className="text-center">
                    <p className="text-sm text-gray-500">{getMethodLabel(method)}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {stats.count}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(stats.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payments History */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Payment History
              </h3>
            </div>
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
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recorded By
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments?.map((payment) => (
                    <tr key={payment._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.paymentDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.client?.name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.invoice?.invoiceNumber || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          {getMethodLabel(payment.method)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.reference}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payment.recordedByUser?.name || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments?.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No payments recorded yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
      />
    </div>
  );
}