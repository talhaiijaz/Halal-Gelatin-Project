"use client";

import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  orderId: Id<"orders"> | null;
  orderNumber?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  orderId,
  orderNumber,
}: DeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteOrder = useMutation(api.orders.deleteOrder);

  const handleDelete = async () => {
    if (!orderId || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteOrder({ orderId });
      console.log('Order deleted successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to delete order:", error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to delete order. Please try again.";
      
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        
        if (errorStr.includes("validation") || errorStr.includes("invalid")) {
          errorMessage = "Invalid order data. Please check the order information and try again.";
        } else if (errorStr.includes("permission") || errorStr.includes("unauthorized")) {
          errorMessage = "You don't have permission to delete orders. Please contact your administrator.";
        } else if (errorStr.includes("not found") || errorStr.includes("doesn't exist")) {
          errorMessage = "Order not found. The order may have already been deleted.";
        } else if (errorStr.includes("constraint") || errorStr.includes("foreign key") || errorStr.includes("reference")) {
          errorMessage = "Cannot delete this order because it has associated invoices, payments, or other records. Please remove these records first.";
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
      
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !orderId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose} />

        <div className="relative bg-white rounded-lg w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Delete Order</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Are you sure you want to delete this order?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This action cannot be undone. The order "{orderNumber}" and all associated data will be permanently deleted.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-6">
                <p className="text-sm text-red-700">
                  <strong>Warning:</strong> This will also delete:
                </p>
                <ul className="text-sm text-red-600 mt-1 list-disc list-inside">
                  <li>Order items</li>
                  <li>Associated invoice</li>
                  <li>Delivery information</li>
                  <li>All related documents</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? "Deleting..." : "Delete Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
