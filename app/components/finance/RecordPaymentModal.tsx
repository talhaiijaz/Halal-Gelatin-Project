"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedInvoiceId?: Id<"invoices">;
  preselectedClientId?: Id<"clients">;
}

export default function RecordPaymentModal({ 
  isOpen, 
  onClose, 
  preselectedInvoiceId,
  preselectedClientId 
}: RecordPaymentModalProps) {
  const recordPayment = useMutation(api.payments.recordPayment);
  const clients = useQuery(api.clients.list, { status: "active" });
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || "");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(preselectedInvoiceId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get unpaid invoices for selected client
  const unpaidInvoices = useQuery(
    api.payments.getUnpaidInvoices,
    selectedClientId ? { clientId: selectedClientId as Id<"clients"> } : {}
  );

  const [formData, setFormData] = useState({
    amount: "",
    method: "bank_transfer" as const,
    reference: "",
    paymentDate: new Date().toISOString().split('T')[0],
    notes: "",
  });

  useEffect(() => {
    if (preselectedClientId) {
      setSelectedClientId(preselectedClientId);
    }
    if (preselectedInvoiceId) {
      setSelectedInvoiceId(preselectedInvoiceId);
    }
  }, [preselectedClientId, preselectedInvoiceId]);

  // Auto-fill amount when invoice is selected
  useEffect(() => {
    if (selectedInvoiceId && unpaidInvoices) {
      const invoice = unpaidInvoices.find(inv => inv._id === selectedInvoiceId);
      if (invoice) {
        setFormData(prev => ({
          ...prev,
          amount: invoice.outstandingBalance.toString(),
        }));
      }
    }
  }, [selectedInvoiceId, unpaidInvoices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInvoiceId) {
      alert("Please select an invoice");
      return;
    }

    setIsSubmitting(true);
    try {
      await recordPayment({
        invoiceId: selectedInvoiceId as Id<"invoices">,
        amount: parseFloat(formData.amount),
        method: formData.method,
        reference: formData.reference,
        paymentDate: new Date(formData.paymentDate).getTime(),
        notes: formData.notes || undefined,
      });
      
      // Reset form
      setFormData({
        amount: "",
        method: "bank_transfer",
        reference: "",
        paymentDate: new Date().toISOString().split('T')[0],
        notes: "",
      });
      setSelectedClientId("");
      setSelectedInvoiceId("");
      onClose();
    } catch (error: any) {
      alert(error.message || "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Record Payment
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              {/* Customer Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer *
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setSelectedInvoiceId("");
                  }}
                  required
                  disabled={!!preselectedClientId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-50"
                >
                  <option value="">Select a customer</option>
                  {clients?.map(client => (
                    <option key={client._id} value={client._id}>
                      {client.name} ({client.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice Selector */}
              {selectedClientId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice *
                  </label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    required
                    disabled={!!preselectedInvoiceId}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-50"
                  >
                    <option value="">Select an invoice</option>
                    {unpaidInvoices?.map(invoice => (
                      <option key={invoice._id} value={invoice._id}>
                        {invoice.invoiceNumber} - {formatCurrency(invoice.outstandingBalance)} outstanding
                      </option>
                    ))}
                  </select>
                  {unpaidInvoices?.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      No unpaid invoices for this customer
                    </p>
                  )}
                </div>
              )}

              {/* Selected Invoice Details */}
              {selectedInvoiceId && unpaidInvoices && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">
                    Invoice Details:
                  </p>
                  {(() => {
                    const invoice = unpaidInvoices.find(inv => inv._id === selectedInvoiceId);
                    if (!invoice) return null;
                    return (
                      <div className="mt-1 space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">Total Amount:</span> {formatCurrency(invoice.amount)}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Paid:</span> {formatCurrency(invoice.totalPaid)}
                        </p>
                        <p className="text-sm font-medium text-primary">
                          Outstanding: {formatCurrency(invoice.outstandingBalance)}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount *
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method *
                </label>
                <select
                  name="method"
                  value={formData.method}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="check">Check</option>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number *
                </label>
                <input
                  type="text"
                  name="reference"
                  value={formData.reference}
                  onChange={handleChange}
                  required
                  placeholder="Transaction ID, Check number, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  name="paymentDate"
                  value={formData.paymentDate}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  placeholder="Additional notes about this payment..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedInvoiceId}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}