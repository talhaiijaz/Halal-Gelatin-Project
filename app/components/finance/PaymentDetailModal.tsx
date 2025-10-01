"use client";

import { useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, DollarSign, Calendar, User, Building, FileText, Edit, Eye } from "lucide-react";
import ActivityLog from "../ActivityLog";
import EditPaymentModal from "./EditPaymentModal";
import { useModalManager } from "@/app/hooks/useModalManager";
import { formatCurrency, SupportedCurrency } from "@/app/utils/currencyFormat";

interface PaymentDetailModalProps {
  paymentId: Id<"payments"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PaymentDetailModal({ paymentId, isOpen, onClose }: PaymentDetailModalProps) {
  const payment = useQuery(api.payments.get, paymentId ? { id: paymentId } : "skip");
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Generate unique modal ID and manage modal state
  const modalId = useId();
  useModalManager(modalId, isOpen);

  if (!isOpen || !paymentId) return null;

  const formatDate = (ts?: number) => (ts ? new Date(ts).toLocaleDateString() : "-");

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "bank_transfer":
        return <Building className="h-4 w-4" />;
      case "check":
        return <FileText className="h-4 w-4" />;
      case "cash":
        return <DollarSign className="h-4 w-4" />;
      case "credit_card":
        return <DollarSign className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "bank_transfer":
        return "bg-blue-100 text-blue-800";
      case "check":
        return "bg-green-100 text-green-800";
      case "cash":
        return "bg-yellow-100 text-yellow-800";
      case "credit_card":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type: string) => {
    return type === "advance" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800";
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <DollarSign className="h-5 w-5 mr-2" /> Payment Details
              </h2>
              {payment && (
                <p className="text-sm text-gray-600 mt-1">
                  {payment.type === "advance" ? "Advance Payment" : "Invoice Payment"} - {payment.reference}
                </p>
              )}
            </div>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!payment ? (
              <div className="h-full flex items-center justify-center text-gray-500">Loading…</div>
            ) : (
              <>
                {/* Payment Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className={`text-xl font-bold ${((payment as any).isReversed ? 'line-through opacity-60' : 'text-gray-900')}`}>{formatCurrency(payment.amount, payment.currency as any)}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Payment Date</p>
                    <p className="text-xl font-bold text-gray-900">{formatDate(payment.paymentDate)}</p>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" /> Payment Information
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Type</label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(payment.type)}`}>
                          {payment.type === "advance" ? "Advance" : "Invoice"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500">Method</label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMethodColor(payment.method)}`}>
                          {getMethodIcon(payment.method)}
                          <span className="ml-1 capitalize">{payment.method.replace("_", " ")}</span>
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500">Reference</label>
                      <p className="mt-1 text-sm text-gray-900 truncate" title={payment.reference}>
                        {payment.reference}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500">Currency</label>
                      <p className="mt-1 text-sm text-gray-900">{payment.currency}</p>
                    </div>
                    {(payment as any).isReversed && (
                      <div className="col-span-2">
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Reversed</span>
                          </div>
                          <div className="text-sm text-gray-900">
                            <div><strong>Reversed:</strong> {formatDate((payment as any).reversedAt)}</div>
                            <div><strong>Reason:</strong> {(payment as any).reversalReason || 'No reason provided'}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Conversion Details for International Payments */}
                    {(() => {
                      // Only show conversion details if there's an actual currency mismatch between payment and bank account
                      const bankAccount = (payment as any).bankAccount;
                      const hasConversionFields = payment.conversionRateToUSD && payment.convertedAmountUSD;
                      const currencyMismatch = bankAccount && bankAccount.currency !== payment.currency;
                      
                      if (hasConversionFields && currencyMismatch) {
                        return (
                          <div className="col-span-2">
                            <div className="bg-blue-50 rounded-md p-3 mt-2">
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Currency Conversion</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600">Original Amount:</span>
                                  <span className="font-medium">{formatCurrency(payment.amount, payment.currency as any)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600">Conversion Rate:</span>
                                  <span className="font-medium">1 {payment.currency} = {payment.conversionRateToUSD} {bankAccount.currency}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600">Converted to {bankAccount.currency}:</span>
                                  <span className="font-medium text-blue-800">{formatCurrency(payment.convertedAmountUSD || 0, bankAccount.currency as any)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {payment.notes && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-gray-500">Notes</label>
                      <p className="mt-1 text-sm text-gray-900">{payment.notes}</p>
                    </div>
                  )}
                </div>

                {/* Client Information */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                    <User className="h-4 w-4 mr-2" /> Client Information
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Name</label>
                      <p className="text-sm font-medium text-gray-900 truncate" title={(payment as any).client?.name}>
                        {(payment as any).client?.name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Email</label>
                      <p className="text-sm text-gray-600 truncate" title={(payment as any).client?.email}>
                        {(payment as any).client?.email || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Invoice Information (if applicable) */}
                {payment.invoiceId && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                      <FileText className="h-4 w-4 mr-2" /> Invoice Information
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Invoice Number</label>
                        <p className="text-sm font-medium text-gray-900 truncate" title={`Invoice #${(payment as any).invoice?.invoiceNumber || payment.invoiceId}`}>
                          Invoice #{(payment as any).invoice?.invoiceNumber || payment.invoiceId}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Amount</label>
                        <p className="text-sm text-gray-600">
                          {formatCurrency((payment as any).invoice?.amount || 0, payment.currency as SupportedCurrency)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bank Information (if applicable) */}
                {payment.bankAccountId && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                      <Building className="h-4 w-4 mr-2" /> Bank Information
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Account Name</label>
                        <p className="text-sm font-medium text-gray-900 truncate" title={(payment as any).bankAccount?.accountName}>
                          {(payment as any).bankAccount?.accountName || "Bank Account"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Bank Name</label>
                        <p className="text-sm text-gray-600 truncate" title={(payment as any).bankAccount?.bankName}>
                          {(payment as any).bankAccount?.bankName || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Withholding Information (if applicable) */}
                {payment.withheldTaxAmount && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-4">Withholding Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Cash Received</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {(() => {
                            // For international payments to PKR banks, show cash received in PKR
                            const bankAccount = (payment as any).bankAccount;
                            const bankTransaction = (payment as any).bankTransaction;
                            if (bankAccount && bankAccount.currency === "PKR" && payment.currency !== "PKR" && bankTransaction) {
                              // Use the bank transaction amount (which is in PKR)
                              return formatCurrency(Math.abs(bankTransaction.amount), bankAccount.currency as SupportedCurrency);
                            }
                            return formatCurrency(payment.cashReceived || 0, payment.currency as SupportedCurrency);
                          })()}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Tax Withheld</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {(() => {
                            // For international payments to PKR banks, show tax withheld in PKR
                            const bankAccount = (payment as any).bankAccount;
                            const bankTransaction = (payment as any).bankTransaction;
                            if (bankAccount && bankAccount.currency === "PKR" && payment.currency !== "PKR" && bankTransaction) {
                              // Calculate the actual PKR withholding amount
                              const convertedAmount = payment.amount * (payment.conversionRateToUSD || 1);
                              const pkrWithholding = Math.round((convertedAmount * (payment.withheldTaxRate || 0)) / 100);
                              return formatCurrency(pkrWithholding, bankAccount.currency as SupportedCurrency);
                            }
                            return formatCurrency(payment.withheldTaxAmount, payment.currency as SupportedCurrency);
                          })()}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Tax Rate</label>
                        <p className="mt-1 text-sm text-gray-900">{payment.withheldTaxRate}%</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity Log */}
                <ActivityLog entityId={String(paymentId)} entityTable="payments" title="Payment Activity" limit={5} collapsible={true} defaultExpanded={false} />
              </>
            )}
          </div>

          {/* Footer */}
          {payment && (
            <div className="border-t px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Created: <span className="font-semibold">{formatDate(payment.createdAt)}</span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Payment Modal */}
      <EditPaymentModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        payment={payment ? {
          _id: payment._id,
          clientId: payment.clientId,
          invoiceId: payment.invoiceId,
          type: payment.type,
          amount: payment.amount,
          reference: payment.reference,
          paymentDate: payment.paymentDate,
          notes: payment.notes,
          bankAccountId: payment.bankAccountId,
          conversionRateToUSD: payment.conversionRateToUSD,
          withheldTaxRate: payment.withheldTaxRate,
          currency: payment.currency,
        } : null}
      />

    </div>
  );

  // Use portal to render modal directly to document.body
  return createPortal(modalContent, document.body);
}
