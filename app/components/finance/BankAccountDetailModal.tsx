"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, Building2, Edit, Trash2, Calendar, CreditCard, DollarSign } from "lucide-react";
import ActivityLog from "@/app/components/ActivityLog";
import BankAccountModal from "./BankAccountModal";
import DeleteBankConfirmModal from "./DeleteBankConfirmModal";

interface BankAccountDetailModalProps {
  bankAccountId: Id<"bankAccounts"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BankAccountDetailModal({ bankAccountId, isOpen, onClose }: BankAccountDetailModalProps) {
  const bankAccount = useQuery(api.banks.get, bankAccountId ? { id: bankAccountId } : "skip");
  const [bodyOverflow, setBodyOverflow] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBodyOverflow(document.body.style.overflow);
      document.body.style.overflow = "hidden";
    } else if (bodyOverflow !== null) {
      document.body.style.overflow = bodyOverflow;
      setBodyOverflow(null);
    }
  }, [isOpen]);

  if (!isOpen || !bankAccountId) return null;

  const formatDate = (ts?: number) => (ts ? new Date(ts).toLocaleDateString() : "-");

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Building2 className="h-5 w-5 mr-2" /> Bank Account Details
              </h2>
              {bankAccount && (
                <p className="text-sm text-gray-600 mt-1">{bankAccount.accountName}</p>
              )}
            </div>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!bankAccount ? (
              <div className="h-full flex items-center justify-center text-gray-500">Loading…</div>
            ) : (
              <>
                {/* Top Summary */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Status</p>
                    <p className={`text-xl font-bold ${
                      bankAccount.status === "active" ? "text-green-600" : "text-gray-600"
                    }`}>
                      {bankAccount.status}
                    </p>
                  </div>
                </div>

                {/* Account Information */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                    <Building2 className="h-4 w-4 mr-2" /> Account Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Account Name</label>
                      <p className="text-sm font-medium text-gray-900 truncate" title={bankAccount.accountName}>
                        {bankAccount.accountName}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Bank Name</label>
                      <p className="text-sm font-medium text-gray-900 truncate" title={bankAccount.bankName}>
                        {bankAccount.bankName}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Account Number</label>
                      <p className="text-sm font-medium text-gray-900 truncate" title={bankAccount.accountNumber}>
                        {bankAccount.accountNumber}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Currency</label>
                      <p className="text-sm font-medium text-gray-900">{bankAccount.currency}</p>
                    </div>
                  </div>
                </div>

                {/* Account Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                      <Calendar className="h-4 w-4 mr-2" /> Created Date
                    </h3>
                    <p className="text-sm font-medium text-gray-900">{formatDate(bankAccount.createdAt)}</p>
                  </div>
                </div>

                {/* Activity Log */}
                <ActivityLog 
                  entityId={String(bankAccountId)} 
                  entityTable="banks"
                  title="Bank Account Activity"
                />
              </>
            )}
          </div>

          {/* Footer */}
          {bankAccount && (
            <div className="border-t px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Account: <span className="font-semibold text-gray-900">{bankAccount.accountName}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  className="btn-secondary"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
                <button
                  className="btn-danger"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Bank Account Modal */}
      <BankAccountModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        bankAccount={bankAccount}
        onSuccess={() => {
          setIsEditModalOpen(false);
          // Data will refresh automatically due to Convex reactivity
        }}
      />

      {/* Delete Bank Confirmation Modal */}
      <DeleteBankConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        bankAccount={bankAccount}
        onSuccess={() => {
          setIsDeleteModalOpen(false);
          onClose(); // Close the detail modal after deletion
        }}
      />
    </div>
  );
}
