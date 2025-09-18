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
  const updateTx = useMutation(api.bankTransactions.updateTransaction);
  const deleteTx = useMutation(api.bankTransactions.deleteTransaction);
  const reverseTx = useMutation(api.bankTransactions.reverseTransaction);

  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [reversalReason, setReversalReason] = useState("");
  const [showReversalInput, setShowReversalInput] = useState(false);

  if (!isOpen || !transactionId) return null;

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  const formatDate = (ts?: number) => (ts ? new Date(ts).toLocaleString() : "-");

  const isPaymentLinked = !!transaction?.paymentId;

  const onStartEdit = () => {
    if (!transaction || isPaymentLinked) return;
    setDescription(transaction.description || "");
    setNotes(transaction.notes || "");
    setIsEditing(true);
  };

  const onSave = async () => {
    if (!transaction) return;
    try {
      await updateTx({ id: transaction._id as any, description, notes });
      setIsEditing(false);
      toast.success("Transaction updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update transaction");
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

  const onDelete = async () => {
    if (!transaction || isPaymentLinked) return;
    try {
      await deleteTx({ id: transaction._id as any });
      onClose();
      toast.success("Transaction deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete transaction");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Details" maxWidth="md">
      {!transaction ? (
        <div className="py-10 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-5">
          {/* Payment-linked warning */}
          {isPaymentLinked && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Payment-Linked Transaction</span>
              </div>
              <div className="mt-1 text-xs text-yellow-700">
                This transaction is linked to a payment. Changes can only be made from the Payments tab.
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Type</div>
              <div className="text-base font-semibold text-gray-900 capitalize">{transaction.transactionType.replace('_', ' ')}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Amount</div>
              <div className={`text-lg font-bold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'} ${transaction.status === 'cancelled' || transaction.isReversed ? 'line-through opacity-60' : ''}`}>
                {transaction.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount), transaction.currency)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Date</div>
              <div className="text-sm text-gray-900">{formatDate(transaction.transactionDate)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Reference</div>
              <div className="text-sm text-gray-900">{transaction.reference || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Status</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900 capitalize">{transaction.status}</span>
                {transaction.isReversed && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700">Reversed</span>
                )}
              </div>
            </div>
            {transaction.linkedTransactionId && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Transfer Link</div>
                <div className="flex items-center gap-1 text-sm text-blue-700">
                  <Link2 className="h-3 w-3" /> Linked Transfer
                </div>
              </div>
            )}
          </div>

          {/* Reversal info */}
          {transaction.isReversed && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Reversal Information</div>
              <div className="text-sm text-gray-900">
                <div><strong>Reversed:</strong> {formatDate(transaction.reversedAt)}</div>
                <div><strong>Reason:</strong> {transaction.reversalReason || 'No reason provided'}</div>
              </div>
            </div>
          )}

          {/* Conversion info */}
          {transaction.originalAmount && transaction.originalCurrency && transaction.exchangeRate && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Currency Conversion</div>
              <div className="text-sm text-blue-800">
                {formatCurrency(transaction.originalAmount, transaction.originalCurrency)} → {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                <div className="text-xs text-blue-600 mt-1">Exchange Rate: {transaction.exchangeRate.toFixed(4)}</div>
              </div>
            </div>
          )}

          {/* Editable fields */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</div>
            {isEditing ? (
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary" />
            ) : (
              <div className="text-sm text-gray-900">{transaction.description}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</div>
            {isEditing ? (
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary" />
            ) : (
              <div className="text-sm text-gray-900 whitespace-pre-wrap">{transaction.notes || '-'}</div>
            )}
          </div>

          {/* Reversal input */}
          {showReversalInput && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Reversal Reason</div>
              <textarea 
                value={reversalReason} 
                onChange={(e) => setReversalReason(e.target.value)} 
                rows={2} 
                placeholder="Enter reason for reversal..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary" 
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              {!isPaymentLinked && (
                <>
                  <button 
                    onClick={onStartEdit} 
                    disabled={isEditing}
                    className="btn-secondary flex items-center disabled:opacity-50"
                  >
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </button>
                  {!transaction.isReversed && transaction.status !== 'cancelled' && (
                    <button 
                      onClick={() => setShowReversalInput(!showReversalInput)} 
                      className="btn-outline flex items-center"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Reverse
                    </button>
                  )}
                </>
              )}
            </div>
            {!isPaymentLinked && (
              <button onClick={onDelete} className="btn-danger flex items-center"><Trash2 className="h-4 w-4 mr-1" /> Delete</button>
            )}
          </div>

          {isEditing && (
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsEditing(false)} className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">Cancel</button>
              <button onClick={onSave} className="px-3 py-2 text-sm text-white bg-primary rounded hover:bg-primary-dark">Save Changes</button>
            </div>
          )}

          {showReversalInput && (
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReversalInput(false)} className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">Cancel</button>
              <button onClick={onReverse} className="px-3 py-2 text-sm text-white bg-yellow-600 rounded hover:bg-yellow-700">Confirm Reversal</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}


