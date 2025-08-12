"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  FileText, 
  Search, 
  Download, 
  Send, 
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Mail,
  Filter
} from "lucide-react";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Id } from "@/convex/_generated/dataModel";

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "thisMonth" | "lastMonth" | "custom">("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<Id<"invoices"> | null>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Calculate date range based on filter
  const getDateRange = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    switch (dateFilter) {
      case "thisMonth":
        return { startDate: startOfMonth.getTime(), endDate: now.getTime() };
      case "lastMonth":
        return { startDate: startOfLastMonth.getTime(), endDate: endOfLastMonth.getTime() };
      default:
        return {};
    }
  };

  const { startDate, endDate } = getDateRange();

  const invoices = useQuery(api.invoices.list, {
    status: statusFilter === "all" ? undefined : statusFilter,
    search: searchTerm || undefined,
    startDate,
    endDate,
  });

  const stats = useQuery(api.invoices.getStats);
  const sendReminder = useMutation(api.invoices.sendReminder);
  const recordPayment = useMutation(api.invoices.recordPayment);

  const handleSendReminder = async (invoiceId: Id<"invoices">) => {
    if (!window.confirm("Send payment reminder to client?")) return;
    
    try {
      await sendReminder({ id: invoiceId });
      toast.success("Reminder sent successfully");
    } catch (error) {
      toast.error("Failed to send reminder");
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoiceId || !paymentAmount) return;

    try {
      await recordPayment({
        invoiceId: selectedInvoiceId,
        amount: parseFloat(paymentAmount),
        paymentMethod,
        referenceNumber: paymentReference || undefined,
        notes: paymentNotes || undefined,
      });
      
      toast.success("Payment recorded successfully");
      setIsRecordPaymentOpen(false);
      setSelectedInvoiceId(null);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
    } catch (error: any) {
      toast.error(error.message || "Failed to record payment");
    }
  };

  const exportToCSV = () => {
    if (!invoices) return;

    const csvContent = [
      ["Invoice Number", "Client", "Order", "Issue Date", "Due Date", "Amount", "Paid", "Outstanding", "Status"],
      ...invoices.map(invoice => [
        invoice.invoiceNumber,
        invoice.client?.name || "",
        invoice.order?.orderNumber || "",
        new Date(invoice.issueDate).toLocaleDateString(),
        new Date(invoice.dueDate).toLocaleDateString(),
        invoice.amount.toFixed(2),
        invoice.totalPaid.toFixed(2),
        invoice.outstandingBalance.toFixed(2),
        invoice.status
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Invoices exported successfully");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4" />;
      case "sent":
        return <Send className="h-4 w-4" />;
      case "due":
        return <Clock className="h-4 w-4" />;
      case "overdue":
        return <AlertCircle className="h-4 w-4" />;
      case "partially_paid":
        return <DollarSign className="h-4 w-4" />;
      case "paid":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "due":
        return "bg-yellow-100 text-yellow-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      case "partially_paid":
        return "bg-orange-100 text-orange-800";
      case "paid":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage and track all invoices
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
              <p className="text-sm font-medium text-gray-600">Total Outstanding</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats ? `$${stats.totalOutstanding.toFixed(2)}` : <Skeleton width={100} />}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <DollarSign className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Paid</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats ? `$${stats.totalPaid.toFixed(2)}` : <Skeleton width={100} />}
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
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats ? stats.byStatus.overdue : <Skeleton width={50} />}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Invoices</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats ? stats.total : <Skeleton width={50} />}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="h-6 w-6 text-blue-600" />
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
            placeholder="Search invoices..."
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
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="due">Due</option>
          <option value="overdue">Overdue</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Dates</option>
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
        </select>

        <div className="flex items-center text-sm text-gray-600">
          {invoices ? `${invoices.length} invoices found` : <Skeleton width={100} />}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!invoices ? (
                // Loading skeletons
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton height={40} /></td>
                    <td className="px-6 py-4"><Skeleton width={150} /></td>
                    <td className="px-6 py-4"><Skeleton width={120} /></td>
                    <td className="px-6 py-4"><Skeleton width={100} /></td>
                    <td className="px-6 py-4"><Skeleton width={80} /></td>
                    <td className="px-6 py-4"><Skeleton width={100} /></td>
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <FileText className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Invoices will appear here when orders are confirmed.
                    </p>
                  </td>
                </tr>
              ) : (
                // Invoice rows
                invoices.map((invoice) => (
                  <tr key={invoice._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</div>
                        <div className="text-xs text-gray-500">Order: {invoice.order?.orderNumber}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{invoice.client?.name}</div>
                      <div className="text-xs text-gray-500">{invoice.client?.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        Issued: {new Date(invoice.issueDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Due: {new Date(invoice.dueDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${invoice.amount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Paid: ${invoice.totalPaid.toFixed(2)}
                      </div>
                      {invoice.outstandingBalance > 0 && (
                        <div className="text-xs text-red-600 font-medium">
                          Outstanding: ${invoice.outstandingBalance.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        <span className="ml-1 capitalize">
                          {invoice.status.replace("_", " ")}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        {(invoice.status === "due" || invoice.status === "overdue" || invoice.status === "partially_paid") && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedInvoiceId(invoice._id);
                                setIsRecordPaymentOpen(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Record Payment"
                            >
                              <DollarSign className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleSendReminder(invoice._id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Send Reminder"
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button className="text-gray-600 hover:text-gray-900" title="View Details">
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isRecordPaymentOpen && selectedInvoiceId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setIsRecordPaymentOpen(false)} />
            
            <div className="relative bg-white rounded-lg w-full max-w-md p-6">
              <h3 className="text-lg font-medium mb-4">Record Payment</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Amount
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="Transaction ID or check number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setIsRecordPaymentOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordPayment}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}