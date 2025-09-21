"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { 
  Calendar, 
  DollarSign, 
  FileText, 
  User, 
  X, 
  Edit3, 
  Save, 
  XCircle,
  CreditCard,
  CheckCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { formatCurrency, SupportedCurrency } from "@/app/utils/currencyFormat";
import { useModalBodyScrollLock } from "@/app/hooks/useBodyScrollLock";

interface StandaloneInvoiceDetailModalProps {
  invoiceId: Id<"invoices">;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function StandaloneInvoiceDetailModal({
  invoiceId,
  isOpen,
  onClose,
  onUpdate,
}: StandaloneInvoiceDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    amount: "",
    currency: "USD" as SupportedCurrency,
    issueDate: "",
    notes: "",
    source: "previous_platform",
  });

  const invoice = useQuery(api.invoices.get, invoiceId ? { id: invoiceId } : "skip");
  const updateStandaloneInvoice = useMutation(api.invoices.updateStandalone);

  // Lock body scroll when modal is open
  useModalBodyScrollLock(isOpen);

  // Update form data when invoice loads
  useEffect(() => {
    if (invoice) {
      setFormData({
        invoiceNumber: invoice.invoiceNumber || "",
        amount: invoice.amount.toString(),
        currency: invoice.currency as SupportedCurrency,
        issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString().split('T')[0] : "",
        notes: invoice.notes || "",
        source: invoice.source || "previous_platform",
      });
    }
  }, [invoice]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.invoiceNumber || !formData.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateStandaloneInvoice({
        invoiceId,
        invoiceNumber: formData.invoiceNumber,
        amount,
        currency: formData.currency,
        issueDate: formData.issueDate ? new Date(formData.issueDate).getTime() : undefined,
        notes: formData.notes,
        source: formData.source,
      });

      toast.success("Invoice updated successfully");
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (invoice) {
      setFormData({
        invoiceNumber: invoice.invoiceNumber || "",
        amount: invoice.amount.toString(),
        currency: invoice.currency as SupportedCurrency,
        issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString().split('T')[0] : "",
        notes: invoice.notes || "",
        source: invoice.source || "previous_platform",
      });
    }
    setIsEditing(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "partially_paid":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-red-100 text-red-800";
    }
  };

  if (!invoice) {
    return (
      <div className={`fixed inset-0 z-50 overflow-hidden ${isOpen ? 'block' : 'hidden'}`}>
        <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
        <div className={`absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="flex flex-col h-full">
            <div className="p-6">
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if this is actually a standalone invoice
  if (!invoice.isStandalone) {
    return (
      <div className={`fixed inset-0 z-50 overflow-hidden ${isOpen ? 'block' : 'hidden'}`}>
        <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
        <div className={`absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="flex flex-col h-full">
            <div className="p-6">
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <FileText className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Invalid Invoice</h3>
                <p className="text-sm text-gray-500 mb-4">
                  This is not a standalone invoice and cannot be edited here.
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden ${isOpen ? 'block' : 'hidden'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
      
      {/* Side Panel */}
      <div className={`absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center">
              <div className="p-2 bg-primary/10 rounded-lg mr-3">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {isEditing ? "Edit Invoice" : "Invoice Details"}
                </h2>
                <p className="text-sm text-gray-500">Standalone Invoice</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSubmitting}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit
                </button>
              )}
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">


              {/* Invoice Details */}
              <div className="space-y-4">
                {/* Invoice Number */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Number *
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => handleInputChange("invoiceNumber", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                  )}
                </div>

                {/* Amount and Currency */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount *
                    </label>
                    {isEditing ? (
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.amount}
                          onChange={(e) => handleInputChange("amount", e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                          disabled={isSubmitting}
                        />
                      </div>
                    ) : (
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(invoice.amount, invoice.currency as SupportedCurrency)}
                      </p>
                    )}
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
                    {isEditing ? (
                      <select
                        value={formData.currency}
                        onChange={(e) => handleInputChange("currency", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        disabled={isSubmitting}
                      >
                        <option value="USD">USD</option>
                        <option value="PKR">PKR</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    ) : (
                      <p className="text-lg font-semibold text-gray-900">{invoice.currency}</p>
                    )}
                  </div>
                </div>

                {/* Issue Date */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issue Date
                  </label>
                  {isEditing ? (
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="date"
                        value={formData.issueDate}
                        onChange={(e) => handleInputChange("issueDate", e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        disabled={isSubmitting}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-900">{formatDate(invoice.issueDate)}</p>
                  )}
                </div>

                {/* Source and Notes */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Source
                    </label>
                    {isEditing ? (
                      <select
                        value={formData.source}
                        onChange={(e) => handleInputChange("source", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        disabled={isSubmitting}
                      >
                        <option value="previous_platform">Previous Platform</option>
                        <option value="current_system">Current System</option>
                        <option value="manual_entry">Manual Entry</option>
                      </select>
                    ) : (
                      <p className="text-sm text-gray-900 capitalize">
                        {invoice.source?.replace("_", " ")}
                      </p>
                    )}
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    {isEditing ? (
                      <textarea
                        value={formData.notes}
                        onChange={(e) => handleInputChange("notes", e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        disabled={isSubmitting}
                        placeholder="Add any additional notes..."
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{invoice.notes || "No notes"}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                  <CreditCard className="h-5 w-5 text-green-600 mr-2" />
                  Payment Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Amount:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(invoice.amount, invoice.currency as SupportedCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Paid:</span>
                    <span className="text-sm font-semibold text-green-600">
                      {formatCurrency(invoice.totalPaid, invoice.currency as SupportedCurrency)}
                    </span>
                  </div>
                  <div className="border-t border-green-200 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900">Outstanding:</span>
                      <span className="text-lg font-bold text-red-600">
                        {formatCurrency(invoice.outstandingBalance, invoice.currency as SupportedCurrency)}
                      </span>
                    </div>
                  </div>
                </div>
                {invoice.outstandingBalance > 0 && (
                  <button
                    className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  onClick={() => {
                    toast("Payment recording feature coming soon", { icon: "ℹ️" });
                  }}
                  >
                    Record Payment
                  </button>
                )}
              </div>

              {/* Metadata */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Calendar className="h-5 w-5 text-gray-600 mr-2" />
                  Invoice Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created:</span>
                    <span className="text-gray-900">{formatDate(invoice.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Updated:</span>
                    <span className="text-gray-900">{formatDate(invoice.updatedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type:</span>
                    <span className="text-gray-900 font-medium">Standalone Invoice</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
