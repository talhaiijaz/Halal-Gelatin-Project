"use client";

import { useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, Building2, Edit, Trash2, Calendar, CreditCard, DollarSign } from "lucide-react";
import ActivityLog from "@/app/components/ActivityLog";
import BankAccountModal from "./BankAccountModal";
import DeleteBankConfirmModal from "./DeleteBankConfirmModal";
import { useModalManager } from "@/app/hooks/useModalManager";
import { formatCurrency } from "@/app/utils/currencyFormat";

interface BankAccountDetailModalProps {
  bankAccountId: Id<"bankAccounts"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BankAccountDetailModal({ bankAccountId, isOpen, onClose }: BankAccountDetailModalProps) {
  const bankAccount = useQuery(api.banks.getWithBalance, bankAccountId ? { id: bankAccountId } : "skip");
  const payments = useQuery(api.banks.getPayments, bankAccountId ? { bankAccountId } : "skip");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Generate unique modal ID and manage modal state
  const modalId = useId();
  useModalManager(modalId, isOpen);

  if (!isOpen || !bankAccountId) return null;

  const formatDate = (ts?: number) => (ts ? new Date(ts).toLocaleDateString() : "-");

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
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
                    {bankAccount.openingBalance !== undefined && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Opening Balance</label>
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(bankAccount.openingBalance, bankAccount.currency as any)}
                        </p>
                      </div>
                    )}
                    {bankAccount.currentBalance !== undefined && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Current Balance</label>
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(bankAccount.currentBalance, bankAccount.currency as any)}
                        </p>
                      </div>
                    )}
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
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                      <DollarSign className="h-4 w-4 mr-2" /> Balance Summary
                    </h3>
                    <div className="space-y-1">
                      <div className="text-sm text-gray-600">
                        Opening: {formatCurrency(bankAccount.openingBalance || 0, bankAccount.currency as any)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Payments: {formatCurrency((bankAccount.currentBalance || 0) - (bankAccount.openingBalance || 0), bankAccount.currency as any)}
                      </div>
                      <div className="text-sm font-medium text-gray-900 border-t pt-1">
                        Total: {formatCurrency(bankAccount.currentBalance || 0, bankAccount.currency as any)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payments Received */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                    <CreditCard className="h-4 w-4 mr-2" /> Payments Received
                  </h3>
                  {payments === undefined ? (
                    <div className="text-center py-4 text-gray-500">Loading payments...</div>
                  ) : (Array.isArray(payments) ? payments : payments?.page || []).length === 0 ? (
                    <div className="text-center py-4 text-gray-500">No payments received yet</div>
                  ) : (
                    <div className="space-y-3">
                      {(Array.isArray(payments) ? payments : payments?.page || []).map((payment: any) => (
                        <div key={payment._id} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  payment.type === "advance" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                                }`}>
                                  {payment.type === "advance" ? "Advance" : "Invoice"}
                                </span>
                                <span className="text-sm text-gray-600">{formatDate(payment.paymentDate)}</span>
                              </div>
                              <div className="text-sm text-gray-900 font-medium">
                                {formatCurrency(payment.amount, payment.currency as any)}
                              </div>
                              <div className="text-xs text-gray-500">
                                Reference: {payment.reference}
                              </div>
                              {payment.method && (
                                <div className="text-xs text-gray-500">
                                  Method: {payment.method.replace('_', ' ').toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-green-600">
                                {formatCurrency(payment.amount, payment.currency as any)}
                              </div>
                              {payment.convertedAmountUSD && payment.convertedAmountUSD !== payment.amount && (
                                <div className="text-xs text-blue-600">
                                  ≈ {formatCurrency(payment.convertedAmountUSD, payment.bankAccount?.currency as any)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity Log */}
                <ActivityLog 
                  entityId={String(bankAccountId)} 
                  entityTable="banks"
                  title="Bank Account Activity"
                  collapsible={true}
                  defaultExpanded={false}
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

  // Use portal to render modal directly to document.body
  return createPortal(modalContent, document.body);
}
