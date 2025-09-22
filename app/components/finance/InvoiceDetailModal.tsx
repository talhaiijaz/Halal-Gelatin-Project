"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, FileText, User, Package, DollarSign, Calendar, ArrowUpDown } from "lucide-react";
import { formatCurrency, formatCurrencyPrecise, type SupportedCurrency } from "@/app/utils/currencyFormat";
import { type Payment, type OrderItem } from "@/app/types";
import { useModalBodyScrollLock } from "@/app/hooks/useBodyScrollLock";
import PaymentDetailModal from "./PaymentDetailModal";


interface InvoiceDetailModalProps {
  invoiceId: Id<"invoices"> | null;
  isOpen: boolean;
  onClose: () => void;
  onRecordPayment?: (invoiceId: Id<"invoices">, clientId: Id<"clients">) => void;
}

export default function InvoiceDetailModal({ invoiceId, isOpen, onClose, onRecordPayment }: InvoiceDetailModalProps) {
  const invoice = useQuery(api.invoices.get, invoiceId ? { id: invoiceId } : "skip");
  const transfers = useQuery(api.interBankTransfers.getByInvoice, invoiceId ? { invoiceId } : "skip");
  const transferStatus = useQuery(api.interBankTransfers.checkInvoicePakistanTransferStatus, invoiceId ? { invoiceId } : "skip");
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"payments"> | null>(null);
  
  // Lock body scroll when modal is open
  useModalBodyScrollLock(isOpen);

  if (!isOpen || !invoiceId) return null;

  // Note: formatCurrency is now imported from utils/currencyFormat

  const formatDate = (ts?: number) => (ts ? new Date(ts).toLocaleDateString() : "-");

  const payments = invoice?.payments || [];
  // Use the calculated values from the query if available, otherwise calculate locally
  const advanceTotal = invoice?.advancePaid ?? payments.filter((p: any) => p.type === "advance").reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const invoicePaymentTotal = invoice?.invoicePaid ?? payments.filter((p: any) => p.type !== "advance").reduce((s: number, p: any) => s + (p.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl sm:rounded-l-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between sticky top-0 bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="h-5 w-5 mr-2" /> Invoice Details
              </h2>
              {invoice && (
                <p className="text-sm text-gray-600 mt-1">Invoice #{invoice.invoiceNumber || invoice._id}</p>
              )}
            </div>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100 active:bg-gray-200">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
            {!invoice ? (
              <div className="h-full flex items-center justify-center text-gray-500">Loading…</div>
            ) : (
              <>
                {/* Top Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(invoice.amount, invoice.currency as SupportedCurrency)}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Receivables</p>
                    <p className="text-xl font-bold text-orange-600">
                      {(() => {
                        // Only show outstanding for shipped/delivered orders
                        const shouldShowOutstanding = invoice.order?.status === "shipped" || invoice.order?.status === "delivered";
                        const outstandingAmount = shouldShowOutstanding ? invoice.outstandingBalance : 0;
                        return formatCurrency(outstandingAmount, invoice.currency as SupportedCurrency);
                      })()}
                    </p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Advance Paid</p>
                    <p className="text-xl font-bold text-blue-600">{formatCurrency(advanceTotal, invoice.currency as SupportedCurrency)}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Invoice Payments</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(invoicePaymentTotal, invoice.currency as SupportedCurrency)}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-2 flex items-center"><User className="h-4 w-4 mr-2"/>Customer</h3>
                    <p
                      className="text-sm font-medium text-gray-900 truncate"
                      title={(invoice as any).client?.name || ""}
                    >
                      {(invoice as any).client?.name}
                    </p>
                    <p
                      className="text-xs text-gray-600 truncate"
                      title={(invoice as any).client?.email || ""}
                    >
                      {(invoice as any).client?.email || ""}
                    </p>
                  </div>
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-2 flex items-center"><Package className="h-4 w-4 mr-2"/>Invoice</h3>
                    <p className="text-sm font-medium text-gray-900 truncate" title={invoice.invoiceNumber || ""}>
                      {invoice.invoiceNumber || "N/A"}
                    </p>
                    <p className="text-xs text-gray-600">Invoice #{(invoice as any).invoiceNumber || "N/A"}</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center"><Calendar className="h-4 w-4 mr-2"/>Issue Date</h3>
                  <p className="text-sm font-medium text-gray-900">{formatDate(invoice.issueDate)}</p>
                </div>

                {/* Order Items */}
                {(invoice as any).orderItems?.length > 0 && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Order Items</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Product</th>
                            <th className="px-3 py-2 text-right">Qty (kg)</th>
                            <th className="px-3 py-2 text-right">Rate</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(invoice as any).orderItems.map((it: OrderItem, idx: number) => (
                            <tr key={idx}>
                              <td className="px-3 py-2">{(it as any).product}</td>
                              <td className="px-3 py-2 text-right">{(it as any).quantityKg || it.quantity}</td>
                              <td className="px-3 py-2 text-right">{formatCurrencyPrecise(it.unitPrice, invoice.currency as SupportedCurrency)}/kg</td>
                              <td className="px-3 py-2 text-right">{formatCurrency((it as any).inclusiveTotal || it.totalPrice, invoice.currency as SupportedCurrency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Payments log */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center"><DollarSign className="h-4 w-4 mr-2"/>Payments</h3>
                  {payments.length === 0 ? (
                    <p className="text-sm text-gray-500">No payments recorded.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2 text-left">Reference</th>
                            <th className="px-3 py-2 text-left">Bank Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {payments.map((p: any) => (
                            <tr 
                              key={p._id}
                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedPaymentId(p._id);
                                setShowPaymentDetail(true);
                              }}
                            >
                              <td className="px-3 py-2">{formatDate(p.paymentDate)}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.type === "advance" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>
                                  {p.type === "advance" ? "Advance" : "Invoice"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-green-700 font-medium">
                                {formatCurrency(p.amount, invoice.currency as SupportedCurrency)}
                                {(() => {
                                  // Only show conversion if there's an actual currency mismatch
                                  const bankAccount = p.bankAccount;
                                  const hasConversionFields = p.conversionRateToUSD && p.convertedAmountUSD;
                                  const currencyMismatch = bankAccount && bankAccount.currency !== p.currency;
                                  
                                  if (hasConversionFields && currencyMismatch) {
                                    return (
                                      <div className="text-xs text-blue-600 mt-1">
                                        = {formatCurrency(p.convertedAmountUSD, bankAccount.currency as SupportedCurrency)}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </td>
                              <td className="px-3 py-2">{p.reference}</td>
                              <td className="px-3 py-2">
                                {p.bankAccountId ? (
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{p.bankAccount?.bankName || "-"}</div>
                                    <div className="text-xs text-gray-500">{p.bankAccount?.accountName || "-"}</div>
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Conversion Details for International Payments */}
                {(() => {
                  // Only show conversion details if there's an actual currency mismatch between payment and bank account
                  const internationalPayments = payments.filter((p: any) => {
                    const hasConversionFields = p.conversionRateToUSD && p.convertedAmountUSD;
                    const bankAccount = p.bankAccount;
                    const currencyMismatch = bankAccount && bankAccount.currency !== p.currency;
                    return hasConversionFields && currencyMismatch;
                  });
                  
                  if (internationalPayments.length === 0) return null;
                  
                  return (
                    <div className="card p-4">
                      <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                        <DollarSign className="h-4 w-4 mr-2"/> Currency Conversion Details
                      </h3>
                      <div className="space-y-3">
                        {internationalPayments.map((payment: any, index: number) => (
                          <div key={index} className="bg-blue-50 rounded-md p-3">
                            <div className="grid grid-cols-1 gap-2 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">Original Payment:</span>
                                <span className="font-medium">{formatCurrency(payment.amount, payment.currency as SupportedCurrency)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">Conversion Rate:</span>
                                <span className="font-medium">1 {payment.currency} = {payment.conversionRateToUSD} {payment.bankAccount.currency}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">Converted to {payment.bankAccount.currency}:</span>
                                <span className="font-medium text-blue-800">{formatCurrency(payment.convertedAmountUSD, payment.bankAccount.currency as SupportedCurrency)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Transfer History - Simple List Below Payments */}
                {transfers && transfers.length > 0 && (
                  <>
                    {/* Transfer Status Summary */}
                    {transferStatus && (
                      <div className={`mt-4 p-3 rounded-md border ${
                        transferStatus.hasMetThreshold 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-yellow-50 border-yellow-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-sm font-medium ${
                              transferStatus.hasMetThreshold ? 'text-green-800' : 'text-yellow-800'
                            }`}>
                              Pakistan Transfer Status
                            </p>
                            <p className={`text-xs ${
                              transferStatus.hasMetThreshold ? 'text-green-600' : 'text-yellow-600'
                            }`}>
                              {transferStatus.totalTransferredToPakistan.toLocaleString()} / {transferStatus.invoiceAmount.toLocaleString()} 
                              ({transferStatus.percentageTransferred.toFixed(1)}% transferred to Pakistan)
                            </p>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            transferStatus.hasMetThreshold 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {transferStatus.hasMetThreshold ? '✓ Compliant' : '⚠ Pending'}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Transfer List */}
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Inter-Bank Transfers</h4>
                      {transfers.map((transfer: any) => (
                        <div key={transfer._id} className="bg-gray-50 rounded-md p-3">
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Transfer Amount:</span>
                              <span className="font-medium">
                                {transfer.originalAmount && transfer.originalCurrency && transfer.originalCurrency !== transfer.currency ? (
                                  <>
                                    {formatCurrency(transfer.originalAmount, transfer.originalCurrency as SupportedCurrency)} → {formatCurrency(transfer.amount, transfer.currency as SupportedCurrency)}
                                    {transfer.exchangeRate && (
                                      <span className="text-xs text-gray-500 ml-1">(Rate: {transfer.exchangeRate})</span>
                                    )}
                                  </>
                                ) : (
                                  formatCurrency(transfer.amount, transfer.currency as SupportedCurrency)
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">From:</span>
                              <span className="font-medium">{transfer.fromBank?.bankName} ({transfer.fromBank?.country || 'Unknown'})</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">To:</span>
                              <span className="font-medium">{transfer.toBank?.bankName} ({transfer.toBank?.country || 'Unknown'})</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Status:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                transfer.status === 'completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : transfer.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : transfer.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                              </span>
                            </div>
                            {transfer.reference && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">Reference:</span>
                                <span className="font-medium">{transfer.reference}</span>
                              </div>
                            )}
                            {transfer.transferDate && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">Transfer Date:</span>
                                <span className="font-medium">{formatDate(transfer.transferDate)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

              </>
            )}
          </div>

          {/* Footer */}
          {invoice && (
            <div className="border-t px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between sticky bottom-0 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div className="text-sm text-gray-600">
                Receivables: <span className="font-semibold text-orange-600">
                  {(() => {
                    // Only show outstanding for shipped/delivered orders
                    const shouldShowOutstanding = invoice.order?.status === "shipped" || invoice.order?.status === "delivered";
                    const outstandingAmount = shouldShowOutstanding ? invoice.outstandingBalance : 0;
                    return formatCurrency(outstandingAmount, invoice.currency as SupportedCurrency);
                  })()}
                </span>
              </div>
              <button
                className="btn-primary px-4 py-2"
                onClick={() => onRecordPayment?.(invoice._id as Id<"invoices">, invoice.clientId as Id<"clients">)}
              >
                Record Payment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Detail Modal */}
      <PaymentDetailModal
        isOpen={showPaymentDetail}
        onClose={() => {
          setShowPaymentDetail(false);
          setSelectedPaymentId(null);
        }}
        paymentId={selectedPaymentId}
      />
    </div>
  );
}


