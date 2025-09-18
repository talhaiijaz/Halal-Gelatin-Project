"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { 
  Building2, 
  ArrowDown, 
  ArrowUp, 
  ArrowUpDown, 
  CreditCard, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Filter,
  Search,
  Plus,
  Info
} from "lucide-react";
import BankTransactionModal from "./BankTransactionModal";
import BankTransactionDetailModal from "@/app/components/finance/BankTransactionDetailModal";
import { formatCurrencyAmount } from "@/app/utils/currencyConversion";
import { formatCurrency } from "@/app/utils/currencyFormat";

interface BankingDashboardProps {
  bankAccountId: Id<"bankAccounts"> | null;
}

export default function BankingDashboard({ bankAccountId }: BankingDashboardProps) {
  const [selectedTransactionType, setSelectedTransactionType] = useState<"deposit" | "withdrawal" | "transfer">("deposit");
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [isTxDetailOpen, setIsTxDetailOpen] = useState(false);

  const bankAccount = useQuery(api.bankTransactions.getAccountWithTransactions, 
    bankAccountId ? { bankAccountId, transactionLimit: 50 } : "skip"
  );
  const transactionStats = useQuery(api.bankTransactions.getTransactionStats,
    bankAccountId ? { bankAccountId } : "skip"
  );

  if (!bankAccountId) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Bank Account Selected</h3>
        <p className="mt-1 text-sm text-gray-500">Select a bank account to view transactions</p>
      </div>
    );
  }

  if (!bankAccount) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">Loading bank account...</p>
      </div>
    );
  }


  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
      case "transfer_in":
      case "payment_received":
      case "interest":
        return <ArrowDown className="h-4 w-4 text-green-600" />;
      case "withdrawal":
      case "transfer_out":
      case "fee":
        return <ArrowUp className="h-4 w-4 text-red-600" />;
      case "adjustment":
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      default:
        return <CreditCard className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "deposit": return "Deposit";
      case "withdrawal": return "Withdrawal";
      case "transfer_in": return "Transfer In";
      case "transfer_out": return "Transfer Out";
      case "payment_received": return "Payment Received";
      case "fee": return "Fee";
      case "interest": return "Interest";
      case "adjustment": return "Balance Adjustment";
      default: return type;
    }
  };

  const filteredTransactions = bankAccount.recentTransactions
    .filter(transaction => {
      // Search filter
      if (searchQuery && !transaction.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Date filter
      if (dateFilter !== "all") {
        const now = Date.now();
        const transactionDate = transaction.transactionDate;
        
        switch (dateFilter) {
          case "today":
            const todayStart = new Date().setHours(0, 0, 0, 0);
            const todayEnd = new Date().setHours(23, 59, 59, 999);
            if (transactionDate < todayStart || transactionDate > todayEnd) return false;
            break;
          case "week":
            const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
            if (transactionDate < weekAgo) return false;
            break;
          case "month":
            const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
            if (transactionDate < monthAgo) return false;
            break;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by transaction date (most recent first)
      const dateDiff = b.transactionDate - a.transactionDate;
      if (dateDiff !== 0) return dateDiff;
      
      // If transaction dates are the same, sort by creation time (most recent first)
      // This ensures the most recently created transaction appears at the top
      return b.createdAt - a.createdAt;
    });

  return (
    <div className="space-y-6">
      {/* Account Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Current Balance</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(bankAccount.currentBalance || 0, bankAccount.currency as any)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Deposits</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(transactionStats?.totalDeposits || 0, bankAccount.currency as any)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Withdrawals</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(transactionStats?.totalWithdrawals || 0, bankAccount.currency as any)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Transactions</p>
              <p className="text-lg font-semibold text-gray-900">
                {transactionStats?.totalTransactions || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setSelectedTransactionType("deposit");
              setIsTransactionModalOpen(true);
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <ArrowDown className="h-4 w-4" />
            <span>Record Deposit</span>
          </button>
          <button
            onClick={() => {
              setSelectedTransactionType("withdrawal");
              setIsTransactionModalOpen(true);
            }}
            className="btn-secondary flex items-center space-x-2"
          >
            <ArrowUp className="h-4 w-4" />
            <span>Record Withdrawal</span>
          </button>
          <button
            onClick={() => {
              setSelectedTransactionType("transfer");
              setIsTransactionModalOpen(true);
            }}
            className="btn-outline flex items-center space-x-2"
          >
            <ArrowUpDown className="h-4 w-4" />
            <span>Transfer Money</span>
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions</h3>
                    <p className="mt-1 text-sm text-gray-500">Start by recording your first transaction</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr 
                    key={transaction._id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedTxId(transaction._id as unknown as string);
                      setIsTxDetailOpen(true);
                    }}
                    title="Click to view details"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getTransactionIcon(transaction.transactionType)}
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {getTransactionTypeLabel(transaction.transactionType)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 flex items-center gap-2">
                        <span>{transaction.description}</span>
                        {transaction.status === "cancelled" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Cancelled</span>
                        )}
                        {transaction.isReversed && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700">Reversed</span>
                        )}
                      </div>
                      {transaction.notes && (
                        <div className="text-xs text-gray-500 mt-1">{transaction.notes}</div>
                      )}
                      {/* Show currency conversion info for transfers */}
                      {transaction.originalAmount && transaction.originalCurrency && transaction.exchangeRate && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                          <div className="flex items-center text-blue-700">
                            <Info className="h-3 w-3 mr-1" />
                            <span className="font-medium">Currency Conversion:</span>
                          </div>
                          <div className="mt-1 text-blue-600">
                            {formatCurrencyAmount(transaction.originalAmount, transaction.originalCurrency)} 
                            → {formatCurrencyAmount(Math.abs(transaction.amount), transaction.currency)}
                            <span className="ml-2 text-blue-500">
                              (Rate: {transaction.exchangeRate.toFixed(4)})
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transactionDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.reference || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <span className={`${transaction.amount >= 0 ? "text-green-600" : "text-red-600"} ${transaction.status === "cancelled" || transaction.isReversed ? "line-through opacity-60" : ""}`}>
                        {transaction.amount >= 0 ? "+" : ""}{formatCurrencyAmount(Math.abs(transaction.amount), transaction.currency)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal */}
      <BankTransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSuccess={() => {
          setIsTransactionModalOpen(false);
          // Data will refresh automatically due to Convex reactivity
        }}
        bankAccountId={bankAccountId}
        transactionType={selectedTransactionType}
      />

      {/* Transaction Detail Modal */}
      <BankTransactionDetailModal
        isOpen={isTxDetailOpen}
        onClose={() => setIsTxDetailOpen(false)}
        transactionId={selectedTxId as any}
      />

    </div>
  );
}
