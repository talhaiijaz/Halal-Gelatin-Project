"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, FileText, User, Package, DollarSign, Calendar } from "lucide-react";


interface InvoiceDetailModalProps {
  invoiceId: Id<"invoices"> | null;
  isOpen: boolean;
  onClose: () => void;
  onRecordPayment?: (invoiceId: Id<"invoices">, clientId: Id<"clients">) => void;
}

export default function InvoiceDetailModal({ invoiceId, isOpen, onClose, onRecordPayment }: InvoiceDetailModalProps) {
  const invoice = useQuery(api.invoices.get, invoiceId ? { id: invoiceId } : "skip");
  const [bodyOverflow, setBodyOverflow] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBodyOverflow(document.body.style.overflow);
      document.body.style.overflow = "hidden";
    } else if (bodyOverflow !== null) {
      document.body.style.overflow = bodyOverflow;
      setBodyOverflow(null);
    }
  }, [isOpen]);

  if (!isOpen || !invoiceId) return null;

  const formatCurrency = (amount: number, currency?: string) =>
    new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-PK', { 
      style: "currency", 
      currency: currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const formatDate = (ts?: number) => (ts ? new Date(ts).toLocaleDateString() : "-");

  const payments = invoice?.payments || [];
  const advanceTotal = payments.filter((p: any) => p.type === "advance").reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const invoicePaymentTotal = payments.filter((p: any) => p.type !== "advance").reduce((s: number, p: any) => s + (p.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="h-5 w-5 mr-2" /> Invoice Details
              </h2>
              {invoice && (
                <p className="text-sm text-gray-600 mt-1">Invoice #{invoice.invoiceNumber || invoice._id}</p>
              )}
            </div>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!invoice ? (
              <div className="h-full flex items-center justify-center text-gray-500">Loading…</div>
            ) : (
              <>
                {/* Top Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(invoice.amount, invoice.currency)}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Outstanding</p>
                    <p className="text-xl font-bold text-orange-600">{formatCurrency(invoice.outstandingBalance, invoice.currency)}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Advance Paid</p>
                    <p className="text-xl font-bold text-blue-600">{formatCurrency(advanceTotal, invoice.currency)}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Invoice Payments</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(invoicePaymentTotal, invoice.currency)}</p>
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
                    <h3 className="font-medium text-gray-900 mb-2 flex items-center"><Package className="h-4 w-4 mr-2"/>Order</h3>
                    <p className="text-sm font-medium text-gray-900 truncate" title={(invoice as any).order?.orderNumber || ""}>
                      {(invoice as any).order?.orderNumber}
                    </p>
                    <p className="text-xs text-gray-600">Invoice #{invoice.invoiceNumber || "N/A"}</p>
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
                          {(invoice as any).orderItems.map((it: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-3 py-2">{it.product}</td>
                              <td className="px-3 py-2 text-right">{it.quantityKg}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(it.unitPrice, invoice.currency)}/kg</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(it.inclusiveTotal || it.totalPrice, invoice.currency)}</td>
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
                            <th className="px-3 py-2 text-left">Bank</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {payments.map((p: any) => (
                            <tr key={p._id}>
                              <td className="px-3 py-2">{formatDate(p.paymentDate)}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.type === "advance" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>
                                  {p.type === "advance" ? "Advance" : "Invoice"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-green-700 font-medium">{formatCurrency(p.amount, invoice.currency)}</td>
                              <td className="px-3 py-2">{p.reference}</td>
                              <td className="px-3 py-2">{p.bankAccountId ? (p.bankAccount?.accountName || p.bankAccount?.bankName || "Bank Transfer") : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>


              </>
            )}
          </div>

          {/* Footer */}
          {invoice && (
            <div className="border-t px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Outstanding: <span className="font-semibold text-orange-600">{formatCurrency(invoice.outstandingBalance, invoice.currency)}</span>
              </div>
              <button
                className="btn-primary"
                onClick={() => onRecordPayment?.(invoice._id as Id<"invoices">, invoice.clientId as Id<"clients">)}
              >
                Record Payment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


