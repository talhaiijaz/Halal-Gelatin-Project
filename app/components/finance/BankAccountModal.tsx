"use client";

import { useState, useEffect } from "react";
import { Info, AlertTriangle } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import { formatCurrencyAmount } from "@/app/utils/currencyConversion";
import Modal from "@/app/components/ui/Modal";

interface BankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  bankAccount?: {
    _id: Id<"bankAccounts">;
    accountName: string;
    bankName: string;
    accountNumber: string;
    currency: string;
    openingBalance?: number;
    status: "active" | "inactive";
  } | null;
}

export default function BankAccountModal({
  isOpen,
  onClose,
  onSuccess,
  bankAccount,
}: BankAccountModalProps) {
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [openingBalance, setOpeningBalance] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [originalOpeningBalance, setOriginalOpeningBalance] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const createBankAccount = useMutation(api.banks.create);
  const updateBankAccount = useMutation(api.banks.update);

  // Reset form when modal opens/closes or bank account changes
  useEffect(() => {
    if (isOpen) {
      if (bankAccount) {
        // Edit mode
        setAccountName(bankAccount.accountName);
        setBankName(bankAccount.bankName);
        setAccountNumber(bankAccount.accountNumber);
        setCurrency(bankAccount.currency);
        setOpeningBalance(bankAccount.openingBalance?.toString() || "");
        setStatus(bankAccount.status);
        setOriginalOpeningBalance(bankAccount.openingBalance || 0);

      } else {
        // Add mode
        setAccountName("");
        setBankName("");
        setAccountNumber("");
        setCurrency("PKR");
        setOpeningBalance("");
        setStatus("active");
        setOriginalOpeningBalance(null);

      }
    }
  }, [isOpen, bankAccount]);

  // Calculate opening balance change impact
  const currentOpeningBalance = parseFloat(openingBalance) || 0;
  const openingBalanceChange = originalOpeningBalance !== null ? currentOpeningBalance - originalOpeningBalance : 0;
  const hasOpeningBalanceChange = openingBalanceChange !== 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountName.trim() || !bankName.trim() || !accountNumber.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      if (bankAccount) {
        // Update existing bank account
        await updateBankAccount({
          id: bankAccount._id,
          accountName: accountName.trim(),
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          currency: currency,
          openingBalance: openingBalance ? parseFloat(openingBalance) : undefined,
          status: status,
        });
        const message = hasOpeningBalanceChange 
          ? `Bank account updated successfully. Opening balance adjusted by ${formatCurrencyAmount(openingBalanceChange, currency)}`
          : "Bank account updated successfully";
        toast.success(message);
      } else {
        // Create new bank account
        await createBankAccount({
          accountName: accountName.trim(),
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          currency: currency,
          openingBalance: openingBalance ? parseFloat(openingBalance) : undefined,
        });
        const message = openingBalance && parseFloat(openingBalance) !== 0
          ? `Bank account created successfully with opening balance of ${formatCurrencyAmount(parseFloat(openingBalance), currency)}`
          : "Bank account created successfully";
        toast.success(message);
      }
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Failed to save bank account:", error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to save bank account. Please try again.";
      
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        
        if (errorStr.includes("validation") || errorStr.includes("invalid")) {
          errorMessage = "Invalid bank account data. Please check all required fields and try again.";
        } else if (errorStr.includes("duplicate") || errorStr.includes("already exists")) {
          errorMessage = "A bank account with this name or account number already exists. Please use a different name or account number.";
        } else if (errorStr.includes("name") || errorStr.includes("account")) {
          errorMessage = "Account name is invalid or missing. Please provide a valid account name.";
        } else if (errorStr.includes("bank") || errorStr.includes("institution")) {
          errorMessage = "Bank name is invalid or missing. Please provide a valid bank name.";
        } else if (errorStr.includes("number") || errorStr.includes("account number")) {
          errorMessage = "Account number is invalid. Please check the account number format.";
        } else if (errorStr.includes("network") || errorStr.includes("connection")) {
          errorMessage = "Network connection error. Please check your internet connection and try again.";
        } else if (errorStr.includes("permission") || errorStr.includes("unauthorized")) {
          errorMessage = "You don't have permission to save bank accounts. Please contact your administrator.";
        } else {
          // For other errors, show the actual error message if it's not too technical
          const cleanMessage = error.message.replace(/^Error: /, '').replace(/^ConvexError: /, '');
          if (cleanMessage.length < 100 && !cleanMessage.includes('internal') && !cleanMessage.includes('server')) {
            errorMessage = `Error: ${cleanMessage}`;
          }
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={bankAccount ? "Edit Bank Account" : "Add Bank Account"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Name *
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="e.g., Main Business Account"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Name *
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="e.g., Chase Bank"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Number *
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="e.g., 1234567890"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            >
              <option value="PKR">PKR - Pakistani Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="AED">AED - UAE Dirham</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opening Balance
            </label>
            
            {/* Show current opening balance for editing */}
            {bankAccount && (
              <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <div className="text-sm text-gray-700">
                  <div className="font-medium mb-1">Current Opening Balance:</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatCurrencyAmount(originalOpeningBalance || 0, currency)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    This is the original opening balance set when the account was created
                  </div>
                </div>
              </div>
            )}
            
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500 mt-1">
              {bankAccount 
                ? "Enter the new opening balance. This will create an adjustment transaction."
                : "Optional: Enter the initial balance when creating this bank account"
              }
            </p>
            
            {/* Show opening balance change impact for editing */}
            {bankAccount && hasOpeningBalanceChange && (
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start text-sm">
                  <Info className="h-4 w-4 mr-2 mt-0.5 text-blue-600 flex-shrink-0" />
                  <div className="text-blue-800">
                    <p className="font-medium mb-2">Opening Balance Adjustment Summary</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Original Opening Balance:</span>
                        <span className="font-medium">{formatCurrencyAmount(originalOpeningBalance || 0, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>New Opening Balance:</span>
                        <span className="font-medium">{formatCurrencyAmount(currentOpeningBalance, currency)}</span>
                      </div>
                      <div className="border-t border-blue-200 pt-1 mt-2">
                        <div className="flex justify-between">
                          <span className="font-medium">Adjustment Amount:</span>
                          <span className={`font-bold ${openingBalanceChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {openingBalanceChange > 0 ? '+' : ''}{formatCurrencyAmount(openingBalanceChange, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-blue-600 bg-blue-100 p-2 rounded">
                      <strong>Note:</strong> This adjustment will be recorded as a transaction in the account history, 
                      {openingBalanceChange > 0 ? ' increasing' : ' decreasing'} the account balance accordingly.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show warning for significant changes */}
            {bankAccount && hasOpeningBalanceChange && Math.abs(openingBalanceChange) > 10000 && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start text-sm">
                  <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 text-yellow-600 flex-shrink-0" />
                  <div className="text-yellow-800">
                    <p className="font-medium">Large Balance Adjustment</p>
                    <p className="text-xs mt-1">
                      This is a significant change to the opening balance ({formatCurrencyAmount(Math.abs(openingBalanceChange), currency)}). 
                      Please verify this adjustment is correct before saving.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {bankAccount && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}



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
              {isSubmitting ? "Saving..." : (bankAccount ? "Update" : "Create")}
            </button>
          </div>
        </form>
    </Modal>
  );
}
