"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, RotateCcw, Link2, AlertTriangle, Calendar, DollarSign, FileText, ArrowUpDown, ArrowUp, ArrowDown, CreditCard } from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import toast from "react-hot-toast";
import { formatCurrency } from "@/app/utils/currencyFormat";

interface Props {
  transactionId: Id<"bankTransactions"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BankTransactionDetailModal({ transactionId, isOpen, onClose }: Props) {
  const transaction = useQuery(api.bankTransactions.getTransaction, transactionId ? { id: transactionId } : "skip");
  const reverseTx = useMutation(api.bankTransactions.reverseTransaction);

  const [reversalReason, setReversalReason] = useState("");
  const [showReversalInput, setShowReversalInput] = useState(false);

  if (!isOpen || !transactionId) return null;

  const formatDate = (ts?: number) => (ts ? new Date(ts).toLocaleString() : "-");

  const isPaymentLinked = !!transaction?.paymentId;
  const isFinancialTransaction = transaction?.transactionType && 
    ['deposit', 'withdrawal', 'transfer_in', 'transfer_out'].includes(transaction.transactionType);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDown className="h-5 w-5 text-green-600" />;
      case "withdrawal":
        return <ArrowUp className="h-5 w-5 text-red-600" />;
      case "transfer_in":
      case "transfer_out":
        return <ArrowUpDown className="h-5 w-5 text-blue-600" />;
      case "payment_received":
        return <DollarSign className="h-5 w-5 text-green-600" />;
      case "fee":
        return <CreditCard className="h-5 w-5 text-red-600" />;
      case "interest":
        return <DollarSign className="h-5 w-5 text-green-600" />;
      case "adjustment":
        return <FileText className="h-5 w-5 text-gray-600" />;
      default:
        return <CreditCard className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "deposit": return "Deposit";
      case "withdrawal": return "Withdrawal";
      case "transfer_in": return "Transfer In";
      case "transfer_out": return "Transfer Out";
      case "payment_received": return "Payment Received";
      case "fee": return "Bank Fee";
      case "interest": return "Interest Earned";
      case "adjustment": return "Adjustment";
      default: return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const onReverse = async () => {
    if (!transaction || transaction.isReversed || isPaymentLinked) return;
    try {
      await reverseTx({ id: transaction._id as any, reason: reversalReason || undefined });
      setShowReversalInput(false);
      setReversalReason("");
      toast.success("Transaction reversed successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to reverse transaction");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Details" maxWidth="lg">
      {!transaction ? (
        <div className="py-10 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-6">
          {/* Payment-linked warning */}
          {isPaymentLinked && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <div className="font-medium text-yellow-800">Payment-Linked Transaction</div>
                  <div className="text-sm text-yellow-700 mt-1">
                    This transaction is linked to a customer payment. Changes can only be made from the Payments tab.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Header */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  {getTransactionIcon(transaction.transactionType)}
                </div>
                <div>
                  <div className="text-sm text-gray-500">Transaction Type</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {getTransactionTypeLabel(transaction.transactionType)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Amount</div>
                <div className={`text-2xl font-bold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'} ${transaction.status === 'cancelled' || transaction.isReversed ? 'line-through opacity-60' : ''}`}>
                  {transaction.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount), transaction.currency as any)}
                </div>
                {transaction.status === 'cancelled' && (
                  <div className="text-xs text-red-600 font-medium">Cancelled</div>
                )}
                {transaction.isReversed && (
                  <div className="text-xs text-yellow-600 font-medium">Reversed</div>
                )}
              </div>
            </div>
          </div>

          {/* Transaction Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Transaction Date</span>
                </div>
                <div className="text-lg text-gray-900">{formatDate(transaction.transactionDate)}</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Reference</span>
                </div>
                <div className="text-lg text-gray-900">{transaction.reference || 'No reference'}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Currency</span>
                </div>
                <div className="text-lg text-gray-900">{transaction.currency}</div>
              </div>

              {transaction.linkedTransactionId && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">Transfer Link</span>
                  </div>
                  <div className="text-sm text-blue-600 font-medium">Linked Transfer Transaction</div>
                </div>
              )}
            </div>
          </div>

          {/* Description and Notes */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 mb-3">Description</div>
              <div className="text-gray-900">{transaction.description}</div>
            </div>

            {transaction.notes && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-700 mb-3">Notes</div>
                <div className="text-gray-900 whitespace-pre-wrap">{transaction.notes}</div>
              </div>
            )}
          </div>

          {/* Reversal Information */}
          {transaction.isReversed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Reversal Information</span>
              </div>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium text-yellow-800">Reversed:</span> <span className="text-yellow-700">{formatDate(transaction.reversedAt)}</span></div>
                <div><span className="font-medium text-yellow-800">Reason:</span> <span className="text-yellow-700">{transaction.reversalReason || 'No reason provided'}</span></div>
              </div>
            </div>
          )}

          {/* Currency Conversion Info */}
          {transaction.originalAmount && transaction.originalCurrency && transaction.exchangeRate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowUpDown className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Currency Conversion</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="text-blue-800">
                  <span className="font-medium">{formatCurrency(transaction.originalAmount, transaction.originalCurrency as any)}</span>
                  <span className="mx-2">→</span>
                  <span className="font-medium">{formatCurrency(Math.abs(transaction.amount), transaction.currency as any)}</span>
                </div>
                <div className="text-blue-600">Exchange Rate: {transaction.exchangeRate.toFixed(4)}</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t pt-6">
            {isPaymentLinked ? (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">
                  This transaction is linked to a payment and cannot be modified from here.
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                {!transaction.isReversed && transaction.status !== 'cancelled' && (
                  <>
                    {!showReversalInput ? (
                      <button
                        onClick={() => setShowReversalInput(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 border border-yellow-300 rounded-lg hover:bg-yellow-200 transition-colors"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reverse Transaction
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <textarea
                          value={reversalReason}
                          onChange={(e) => setReversalReason(e.target.value)}
                          rows={2}
                          placeholder="Enter reason for reversal..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={() => setShowReversalInput(false)}
                          className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={onReverse}
                          className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors"
                        >
                          Confirm Reversal
                        </button>
                      </div>
                    )}
                  </>
                )}
                
                {transaction.isReversed && (
                  <div className="text-center py-2">
                    <div className="text-sm text-gray-500">This transaction has been reversed.</div>
                  </div>
                )}
                
                {transaction.status === 'cancelled' && (
                  <div className="text-center py-2">
                    <div className="text-sm text-gray-500">This transaction has been cancelled.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}


