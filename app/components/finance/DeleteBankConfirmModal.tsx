"use client";

import { X, AlertTriangle } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import { useState } from "react";

interface DeleteBankConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  bankAccount?: {
    _id: Id<"bankAccounts">;
    accountName: string;
    bankName: string;
    accountNumber: string;
  } | null;
}

export default function DeleteBankConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  bankAccount,
}: DeleteBankConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteBankAccount = useMutation(api.banks.remove);

  const handleDelete = async () => {
    if (!bankAccount) return;

    setIsDeleting(true);
    try {
      await deleteBankAccount({ id: bankAccount._id });
      toast.success("Bank account deleted successfully");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Failed to delete bank account:", error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to delete bank account. Please try again.";
      
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        
        if (errorStr.includes("validation") || errorStr.includes("invalid")) {
          errorMessage = "Invalid bank account data. Please check the account information and try again.";
        } else if (errorStr.includes("permission") || errorStr.includes("unauthorized")) {
          errorMessage = "You don't have permission to delete bank accounts. Please contact your administrator.";
        } else if (errorStr.includes("not found") || errorStr.includes("doesn't exist")) {
          errorMessage = "Bank account not found. The account may have already been deleted.";
        } else if (errorStr.includes("constraint") || errorStr.includes("foreign key") || errorStr.includes("reference")) {
          errorMessage = "Cannot delete this bank account because it has associated payments or transactions. Please remove these records first.";
        } else if (errorStr.includes("network") || errorStr.includes("connection")) {
          errorMessage = "Network connection error. Please check your internet connection and try again.";
        } else {
          // For other errors, show the actual error message if it's not too technical
          const cleanMessage = error.message.replace(/^Error: /, '').replace(/^ConvexError: /, '');
          if (cleanMessage.length < 100 && !cleanMessage.includes('internal') && !cleanMessage.includes('server')) {
            errorMessage = cleanMessage;
          }
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !bankAccount) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Delete Bank Account
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex items-start space-x-3 mb-6">
          <AlertTriangle className="h-6 w-6 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-700 mb-2">
              Are you sure you want to delete this bank account? This action cannot be undone.
            </p>
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm font-medium text-gray-900">
                {bankAccount.accountName}
              </p>
              <p className="text-sm text-gray-600">
                {bankAccount.bankName} • {bankAccount.accountNumber}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
