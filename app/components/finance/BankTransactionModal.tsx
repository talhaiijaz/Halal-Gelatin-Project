"use client";

import { useState, useEffect } from "react";
import { ArrowUpDown, ArrowDown, ArrowUp, CreditCard, Building2, Info } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import Modal from "@/app/components/ui/Modal";
import { 
  convertCurrency, 
  formatCurrencyAmount, 
  validateExchangeRate, 
  getSuggestedExchangeRate,
  getExchangeRateDescription 
} from "@/app/utils/currencyConversion";
import { dateStringToTimestamp } from "@/app/utils/dateUtils";

interface BankTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  bankAccountId: Id<"bankAccounts"> | null;
  transactionType?: "deposit" | "withdrawal" | "transfer";
}

export default function BankTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  bankAccountId,
  transactionType = "deposit",
}: BankTransactionModalProps) {
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    reference: "",
    notes: "",
    toBankAccountId: "",
    transactionDate: new Date().toISOString().split('T')[0],
    // Currency conversion fields
    exchangeRate: "",
    originalAmount: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bankAccounts = useQuery(api.banks.list);
  const recordTransaction = useMutation(api.bankTransactions.recordTransaction);
  const transferBetweenAccounts = useMutation(api.bankTransactions.transferBetweenAccounts);
  
  // Get source bank account details
  const sourceAccount = bankAccounts?.find(acc => acc._id === bankAccountId);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        amount: "",
        description: "",
        reference: "",
        notes: "",
        toBankAccountId: "",
        transactionDate: new Date().toISOString().split('T')[0],
        exchangeRate: "",
        originalAmount: "",
      });
    }
  }, [isOpen]);

  // Get destination account for transfers
  const destinationAccount = bankAccounts?.find(acc => acc._id === formData.toBankAccountId);
  
  // Check if currency conversion is needed
  const needsConversion = transactionType === "transfer" && 
    sourceAccount && 
    destinationAccount && 
    sourceAccount.currency !== destinationAccount.currency;

  // Calculate converted amount for display
  const convertedAmount = needsConversion && formData.exchangeRate && formData.originalAmount
    ? convertCurrency(
        parseFloat(formData.originalAmount),
        sourceAccount.currency,
        destinationAccount.currency,
        parseFloat(formData.exchangeRate)
      )
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bankAccountId || !sourceAccount) {
      toast.error("No bank account selected");
      return;
    }

    if (!formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      if (transactionType === "transfer") {
        if (!formData.toBankAccountId || !destinationAccount) {
          toast.error("Please select destination account");
          return;
        }

        // Validate currency conversion requirements
        if (needsConversion) {
          if (!formData.originalAmount || !formData.exchangeRate) {
            toast.error("Original amount and exchange rate are required for cross-currency transfers");
            return;
          }

          const originalAmount = parseFloat(formData.originalAmount);
          const exchangeRate = parseFloat(formData.exchangeRate);
          
          if (originalAmount <= 0) {
            toast.error("Original amount must be greater than 0");
            return;
          }

          const validation = validateExchangeRate(exchangeRate, sourceAccount.currency, destinationAccount.currency);
          if (!validation.isValid) {
            toast.error(validation.error || "Invalid exchange rate");
            return;
          }

          // Use converted amount for the transfer
          const convertedAmount = originalAmount * exchangeRate;
          
          await transferBetweenAccounts({
            fromBankAccountId: bankAccountId,
            toBankAccountId: formData.toBankAccountId as Id<"bankAccounts">,
            amount: convertedAmount,
            currency: destinationAccount.currency,
            description: formData.description,
            reference: formData.reference || undefined,
            notes: formData.notes || undefined,
            transactionDate: dateStringToTimestamp(formData.transactionDate),
            exchangeRate: exchangeRate,
            originalAmount: originalAmount,
            originalCurrency: sourceAccount.currency,
          });
          
          toast.success(`Transfer completed: ${formatCurrencyAmount(originalAmount, sourceAccount.currency)} → ${formatCurrencyAmount(convertedAmount, destinationAccount.currency)}`);
        } else {
          // Same currency transfer
          if (!formData.amount) {
            toast.error("Please enter transfer amount");
            return;
          }

          const amount = parseFloat(formData.amount);
          if (amount <= 0) {
            toast.error("Amount must be greater than 0");
            return;
          }

          await transferBetweenAccounts({
            fromBankAccountId: bankAccountId,
            toBankAccountId: formData.toBankAccountId as Id<"bankAccounts">,
            amount: amount,
            currency: sourceAccount.currency,
            description: formData.description,
            reference: formData.reference || undefined,
            notes: formData.notes || undefined,
            transactionDate: dateStringToTimestamp(formData.transactionDate),
          });
          
          toast.success(`Transfer completed: ${formatCurrencyAmount(amount, sourceAccount.currency)}`);
        }
      } else {
        // Deposit or withdrawal
        if (!formData.amount) {
          toast.error("Please enter amount");
          return;
        }

        const amount = parseFloat(formData.amount);
        if (amount <= 0) {
          toast.error("Amount must be greater than 0");
          return;
        }

        const isDeposit = transactionType === "deposit";
        await recordTransaction({
          bankAccountId: bankAccountId,
          transactionType: isDeposit ? "deposit" : "withdrawal",
          amount: isDeposit ? amount : -amount,
          currency: sourceAccount.currency,
          description: formData.description,
          reference: formData.reference || undefined,
          transactionDate: dateStringToTimestamp(formData.transactionDate),
          notes: formData.notes || undefined,
        });
        
        toast.success(`${isDeposit ? "Deposit" : "Withdrawal"} recorded: ${formatCurrencyAmount(amount, sourceAccount.currency)}`);
      }
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Failed to record transaction:", error);
      toast.error(error.message || "Failed to record transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !bankAccountId) return null;

  const getTransactionIcon = () => {
    switch (transactionType) {
      case "deposit":
        return <ArrowDown className="h-5 w-5 text-green-600" />;
      case "withdrawal":
        return <ArrowUp className="h-5 w-5 text-red-600" />;
      case "transfer":
        return <ArrowUpDown className="h-5 w-5 text-blue-600" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const getTransactionTitle = () => {
    switch (transactionType) {
      case "deposit":
        return "Record Deposit";
      case "withdrawal":
        return "Record Withdrawal";
      case "transfer":
        return "Transfer Money";
      default:
        return "Bank Transaction";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTransactionTitle()}
      maxWidth="md"
      showCloseButton={false}
    >
      <div className="flex items-center mb-4">
        {getTransactionIcon()}
        <span className="ml-2 text-lg font-semibold text-gray-900">{getTransactionTitle()}</span>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-4">
          {/* Source Account Information */}
          {sourceAccount && (
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="flex items-center text-sm text-gray-800">
                <Building2 className="h-4 w-4 mr-2" />
                <span className="font-medium">{sourceAccount.accountName}</span>
                <span className="mx-2">•</span>
                <span>{sourceAccount.currency}</span>
                {sourceAccount.currentBalance !== undefined && (
                  <>
                    <span className="mx-2">•</span>
                    <span>Balance: {formatCurrencyAmount(sourceAccount.currentBalance, sourceAccount.currency)}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Transfer To field - First for transfers */}
          {transactionType === "transfer" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transfer To *
              </label>
              <select
                value={formData.toBankAccountId}
                onChange={(e) => setFormData({ ...formData, toBankAccountId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                required
              >
                <option value="">Select destination account</option>
                {bankAccounts?.filter(acc => acc._id !== bankAccountId).map((account) => (
                  <option key={account._id} value={account._id}>
                    {account.accountName} - {account.bankName} ({account.currency})
                    {account.currentBalance !== undefined && ` - Balance: ${formatCurrencyAmount(account.currentBalance, account.currency)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Currency conversion info */}
          {needsConversion && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start text-sm text-yellow-800">
                <Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Cross-Currency Transfer</p>
                  <p className="text-xs mt-1">
                    You're transferring from {sourceAccount?.currency} to {destinationAccount?.currency}. 
                    Please enter the amount in {sourceAccount?.currency} and provide the exchange rate.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Amount Field - Different behavior for transfers vs deposits/withdrawals */}
          {transactionType === "transfer" && needsConversion ? (
            // Cross-currency transfer - show original amount and conversion
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount in {sourceAccount?.currency} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.originalAmount}
                  onChange={(e) => setFormData({ ...formData, originalAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exchange Rate *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.exchangeRate}
                    onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder={getSuggestedExchangeRate(sourceAccount?.currency || '', destinationAccount?.currency || '')?.toString() || "0.0000"}
                    required
                  />
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    1 {sourceAccount?.currency} = ? {destinationAccount?.currency}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.exchangeRate && formData.originalAmount && convertedAmount && (
                    <>
                      {getExchangeRateDescription(sourceAccount?.currency || '', destinationAccount?.currency || '', parseFloat(formData.exchangeRate))}
                      <br />
                      <span className="font-medium text-green-600">
                        You will receive: {formatCurrencyAmount(convertedAmount.convertedAmount, destinationAccount?.currency || '')}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </>
          ) : (
            // Same currency or deposit/withdrawal
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                placeholder="0.00"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="Transaction description"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference
            </label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="Reference number or check number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Date *
            </label>
            <input
              type="date"
              value={formData.transactionDate}
              onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              rows={3}
              placeholder="Additional notes"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : "Record Transaction"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
