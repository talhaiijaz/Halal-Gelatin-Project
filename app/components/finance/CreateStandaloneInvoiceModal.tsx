"use client";

import { useState, useId } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Modal from "@/app/components/ui/Modal";
import { Calendar, DollarSign, FileText, User, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { getCurrencyForClientType, SupportedCurrency } from "@/app/utils/currencyFormat";
import { useModalManager } from "@/app/hooks/useModalManager";

interface CreateStandaloneInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: Id<"clients">;
  clientName: string;
  clientType: "local" | "international";
  onSuccess?: () => void;
}

export default function CreateStandaloneInvoiceModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  clientType,
  onSuccess,
}: CreateStandaloneInvoiceModalProps) {
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    amount: "",
    currency: getCurrencyForClientType(clientType, "USD"),
    issueDate: "",
    notes: "",
    source: "previous_platform",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createStandaloneInvoice = useMutation(api.invoices.createStandalone);

  // Generate unique modal ID and manage modal state
  const modalId = useId();
  useModalManager(modalId, isOpen);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      await createStandaloneInvoice({
        clientId,
        invoiceNumber: formData.invoiceNumber,
        amount,
        currency: formData.currency as SupportedCurrency,
        issueDate: formData.issueDate ? new Date(formData.issueDate).getTime() : undefined,
        notes: formData.notes,
        source: formData.source,
      });

      toast.success("Standalone invoice created successfully");
      onSuccess?.();
      onClose();
      
      // Reset form
      setFormData({
        invoiceNumber: "",
        amount: "",
        currency: getCurrencyForClientType(clientType, "USD"),
        issueDate: "",
        notes: "",
        source: "previous_platform",
      });
    } catch (error) {
      console.error("Error creating standalone invoice:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create standalone invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-primary mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">
              Create Standalone Invoice
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Client Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <User className="h-5 w-5 text-gray-400 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-900">{clientName}</p>
              <p className="text-xs text-gray-500 capitalize">{clientType} client</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invoice Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Number *
            </label>
            <input
              type="text"
              value={formData.invoiceNumber}
              onChange={(e) => handleInputChange("invoiceNumber", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., INV-2024-001"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => handleInputChange("amount", e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="0.00"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
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
            </div>
          </div>

          {/* Issue Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Issue Date
            </label>
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
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source
            </label>
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
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Additional notes about this invoice..."
              disabled={isSubmitting}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
