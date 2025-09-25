"use client";

import { useState, useId } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, AlertTriangle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useModalManager } from "@/app/hooks/useModalManager";

interface Client {
  _id: Id<"clients">;
  name: string;
  type: "local" | "international";
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSuccess: () => void;
}

export default function DeleteConfirmModal({ isOpen, onClose, client, onSuccess }: DeleteConfirmModalProps) {
  const deleteClient = useMutation(api.clients.remove);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate unique modal ID and manage modal state
  const modalId = useId();
  useModalManager(modalId, isOpen);

  const handleDelete = async () => {
    if (!client) return;

    console.log("Attempting to delete client:", client._id, client.name);
    setIsDeleting(true);
    setError(null);
    try {
      const result = await deleteClient({ id: client._id });
      console.log("Delete result:", result);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to delete client:", error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to delete client. Please try again.";
      
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        
        if (errorStr.includes("validation") || errorStr.includes("invalid")) {
          errorMessage = "Invalid client data. Please check the client information and try again.";
        } else if (errorStr.includes("permission") || errorStr.includes("unauthorized")) {
          errorMessage = "You don't have permission to delete clients. Please contact your administrator.";
        } else if (errorStr.includes("not found") || errorStr.includes("doesn't exist")) {
          errorMessage = "Client not found. The client may have already been deleted.";
        } else if (errorStr.includes("constraint") || errorStr.includes("foreign key") || errorStr.includes("reference")) {
          errorMessage = "Cannot delete this client because they have associated orders, invoices, or payments. Please remove these records first.";
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
      
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen || !client) return null;

  const modalContent = (
    <div 
      className="fixed z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50"
      style={{ 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh'
      }}
      onClick={handleClose}
    >
      <div 
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Delete Customer
            </h2>
            <button
              onClick={handleClose}
              className="rounded-lg p-1 hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Are you sure?
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                This action cannot be undone. This will permanently delete the customer &quot;{client.name}&quot; and all associated data.
              </p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-700">
              <strong>Warning:</strong> Deleting this customer will also affect any orders, invoices, and payments associated with them.
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-300 rounded-md p-3 mb-4">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="btn-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? "Deleting..." : "Delete Customer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal directly to document.body
  return createPortal(modalContent, document.body);
}
