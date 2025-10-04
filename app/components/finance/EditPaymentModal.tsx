"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, type SupportedCurrency } from "@/app/utils/currencyFormat";
import { displayError } from "@/app/utils/errorHandling";
import { type Payment } from "@/app/types";
import Modal from "@/app/components/ui/Modal";
import { timestampToDateString, dateStringToTimestamp } from "@/app/utils/dateUtils";

export type EditablePayment = {
  _id: Id<"payments">;
  clientId: Id<"clients">;
  invoiceId?: Id<"invoices"> | null;
  type?: "invoice" | "advance";
  amount: number;
  reference: string;
  paymentDate: number;
  notes?: string | null;
  bankAccountId?: Id<"bankAccounts"> | null;
  conversionRateToUSD?: number | null;
  withheldTaxRate?: number | null;
  currency?: string;
};

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: EditablePayment | null;
}

export default function EditPaymentModal({ isOpen, onClose, payment }: EditPaymentModalProps) {
  const updatePayment = useMutation(api.payments.updatePayment);
  const bankAccounts = useQuery(api.banks.list);
  const invoice = useQuery(
    api.invoices.get,
    payment?.invoiceId ? { id: payment.invoiceId as Id<"invoices"> } : "skip"
  );
  const client = useQuery(
    api.clients.get,
    payment?.clientId ? { id: payment.clientId as Id<"clients"> } : "skip"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    reference: "",
    paymentDate: timestampToDateString(Date.now()),
    notes: "",
    bankAccountId: "",
    conversionRateToUSD: "",
    withheldTaxRate: "",
  });

  useEffect(() => {
    if (payment && isOpen) {
      setForm({
        amount: String(payment.amount),
        reference: payment.reference || "",
        paymentDate: timestampToDateString(payment.paymentDate),
        notes: payment.notes || "",
        bankAccountId: payment.bankAccountId ? (payment.bankAccountId as string) : "",
        conversionRateToUSD: payment.conversionRateToUSD ? String(payment.conversionRateToUSD) : "",
        withheldTaxRate: payment.withheldTaxRate ? String(payment.withheldTaxRate) : "",
      });
    }
  }, [payment, isOpen]);

  if (!payment) return null;

  // Note: formatCurrency is now imported from utils/currencyFormat

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Payment"
      maxWidth="md"
    >
      <div className="p-5 space-y-4">
            {/* Context summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              {payment.type === "advance" || !payment.invoiceId ? (
                <div className="space-y-1 text-sm text-gray-800">
                  <div className="font-medium">Advance Payment</div>
                  {client && (
                    <div>
                      <span className="text-gray-600">Client Receivables:</span>
                      <span className="ml-1 font-semibold">{formatCurrency((client as any).outstandingAmount, (client as any).type === 'local' ? 'PKR' : 'USD' as SupportedCurrency)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">This Payment:</span>
                    <span className="ml-1 font-semibold">{formatCurrency(Number(form.amount), (client as any)?.type === 'local' ? 'PKR' : 'USD' as SupportedCurrency)}</span>
                  </div>
                  <div className="text-xs text-gray-500">You are editing an advance payment.</div>
                </div>
              ) : invoice ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-gray-600">Invoice Total</div>
                    <div className="font-semibold">{formatCurrency((invoice as any).amount, (invoice as any).currency as SupportedCurrency)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Paid</div>
                    <div className="font-semibold">{formatCurrency((invoice as any).totalPaid, (invoice as any).currency as SupportedCurrency)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Receivables</div>
                    <div className="font-semibold text-primary">{formatCurrency((invoice as any).outstandingBalance, (invoice as any).currency as SupportedCurrency)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Advance Payments</div>
                    <div className="font-semibold">
                      {formatCurrency(((invoice as any).payments || []).filter((p: Payment) => p.type === "advance").reduce((s: number, p: Payment) => s + (p.amount || 0), 0), (invoice as any).currency as SupportedCurrency)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-600">This Payment</div>
                    <div className="font-semibold">{formatCurrency(Number(form.amount), (invoice as any).currency as SupportedCurrency)}</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
              <select
                value={form.bankAccountId}
                onChange={(e) => setForm((s) => ({ ...s, bankAccountId: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              >
                <option value="">-- None --</option>
                {bankAccounts?.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.accountName} - {a.bankName} ({a.currency})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference *</label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm((s) => ({ ...s, reference: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
              <input
                type="date"
                value={form.paymentDate}
                onChange={(e) => setForm((s) => ({ ...s, paymentDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Conversion Rate Field (for international payments) */}
            {(() => {
              const selectedBankAccount = bankAccounts?.find(bank => bank._id === form.bankAccountId);
              const isInternationalClient = client && (client as any).type === 'international';
              const needsConversion = selectedBankAccount && selectedBankAccount.currency !== payment.currency;
              
              if (isInternationalClient && needsConversion) {
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Conversion Rate ({payment.currency} to {selectedBankAccount.currency})
                    </label>
                    <input
                      type="number"
                      value={form.conversionRateToUSD}
                      onChange={(e) => setForm((s) => ({ ...s, conversionRateToUSD: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      min="0.01"
                      step="0.01"
                      placeholder={`Enter ${payment.currency} to ${selectedBankAccount.currency} rate`}
                    />
                    {form.conversionRateToUSD && form.amount && (
                      <div className="mt-2 text-sm text-gray-600">
                        {formatCurrency(parseFloat(form.amount), payment.currency as SupportedCurrency)} = {formatCurrency(parseFloat(form.amount) * parseFloat(form.conversionRateToUSD), selectedBankAccount.currency as SupportedCurrency)}
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* Debug Info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-xs">
                <div>Client Type: {client ? (client as any).type : 'Loading...'}</div>
                <div>Payment Currency: {payment.currency}</div>
                <div>Current Withholding Rate: {payment.withheldTaxRate || 'None'}</div>
                <div>Form Withholding Rate: {form.withheldTaxRate || 'None'}</div>
              </div>
            )}

            {/* Withholding Tax Field */}
            {(() => {
              const selectedBankAccount = bankAccounts?.find(bank => bank._id === form.bankAccountId);
              const isInternationalClient = client && (client as any).type === 'international';
              const isLocalClient = client && (client as any).type === 'local';
              
              // Always show withholding tax field for any client type, or if payment has withholding data
              if (client || payment.withheldTaxRate) {
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Withholding Tax Rate (%)
                      {!client && payment.withheldTaxRate && (
                        <span className="text-xs text-gray-500 ml-2">(Currently: {payment.withheldTaxRate}%)</span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={form.withheldTaxRate}
                      onChange={(e) => setForm((s) => ({ ...s, withheldTaxRate: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="Enter withholding tax rate (e.g., 5 for 5%)"
                    />
                    {form.withheldTaxRate && form.amount && (
                      <div className="mt-2 text-sm text-gray-600">
                        {(() => {
                          const rate = parseFloat(form.withheldTaxRate);
                          const selectedBankAccount = bankAccounts?.find(bank => bank._id === form.bankAccountId);
                          
                          if (isInternationalClient && selectedBankAccount && selectedBankAccount.currency === "PKR" && form.conversionRateToUSD) {
                            // For international payments to PKR banks: convert first, then withhold
                            const convertedAmount = parseFloat(form.amount) * parseFloat(form.conversionRateToUSD);
                            const pkrWithholding = Math.round((convertedAmount * rate) / 100);
                            const netAmount = Math.max(0, convertedAmount - pkrWithholding);
                            
                            return (
                              <div className="space-y-1">
                                <div>Tax Withheld: {formatCurrency(pkrWithholding, selectedBankAccount.currency as SupportedCurrency)}</div>
                                <div>Net Amount: {formatCurrency(netAmount, selectedBankAccount.currency as SupportedCurrency)}</div>
                              </div>
                            );
                          } else {
                            // For local payments or same currency: withhold on original amount
                            const withholding = Math.round((parseFloat(form.amount) * rate) / 100);
                            const netAmount = Math.max(0, parseFloat(form.amount) - withholding);
                            
                            return (
                              <div className="space-y-1">
                                <div>Tax Withheld: {formatCurrency(withholding, payment.currency as SupportedCurrency)}</div>
                                <div>Net Amount: {formatCurrency(netAmount, payment.currency as SupportedCurrency)}</div>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="px-5 py-4 border-t flex justify-end space-x-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  await updatePayment({
                    paymentId: payment._id,
                    amount: parseFloat(form.amount),
                    reference: form.reference,
                    paymentDate: dateStringToTimestamp(form.paymentDate),
                    notes: form.notes || undefined,
                    bankAccountId: form.bankAccountId ? (form.bankAccountId as unknown as Id<"bankAccounts">) : undefined,
                    conversionRateToUSD: form.conversionRateToUSD ? parseFloat(form.conversionRateToUSD) : undefined,
                    withheldTaxRate: form.withheldTaxRate ? parseFloat(form.withheldTaxRate) : undefined,
                  });
                  onClose();
                } catch (e: unknown) {
                  displayError(e, 'alert');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="btn-primary disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
    </Modal>
  );
}

