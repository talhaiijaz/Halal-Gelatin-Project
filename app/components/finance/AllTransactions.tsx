import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Pagination from "@/app/components/ui/Pagination";
import { formatCurrency } from "@/app/utils/currencyFormat";
import { usePagination } from "@/app/hooks/usePagination";
import { timestampToDateString } from "@/app/utils/dateUtils";
import { Building2, Calendar, Filter } from "lucide-react";

export default function AllTransactions() {
  const [selectedDateMs, setSelectedDateMs] = useState<number | null>(Date.now());
  const [selectedBankId, setSelectedBankId] = useState<Id<"bankAccounts"> | "all" | null>("all");
  const pagination = usePagination({ pageSize: 25 });

  const banks = useQuery(api.banks.listWithBalances);

  const { startMs, endMs } = useMemo(() => {
    const base = selectedDateMs ?? Date.now();
    const d = new Date(base);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
    return { startMs: start, endMs: end };
  }, [selectedDateMs]);

  const page = useQuery(api.bankTransactions.listAllDailyTransactions,
    startMs && endMs ? {
      startMs,
      endMs,
      bankAccountId: selectedBankId && selectedBankId !== "all" ? (selectedBankId as Id<"bankAccounts">) : undefined,
      paginationOpts: pagination.paginationOpts,
    } : "skip"
  );

  const transactions = Array.isArray(page) ? page : page?.page || [];

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700 font-medium">All Transactions</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={timestampToDateString(selectedDateMs || Date.now())}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const [y, m, d] = val.split("-").map(Number);
                const ts = new Date(y, m - 1, d, 12, 0, 0).getTime();
                setSelectedDateMs(ts);
                pagination.goToPage(1);
              }}
              className="h-9 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                className="h-9 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={(selectedBankId as any) || "all"}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedBankId(v === "all" ? "all" : (v as unknown as Id<"bankAccounts">));
                  pagination.goToPage(1);
                }}
              >
                <option value="all">All Banks</option>
                {banks?.map((b: any) => (
                  <option key={b._id} value={b._id as string}>{b.accountName} - {b.bankName} ({b.currency})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[18%]">Bank</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[40%]">Description</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[14%]">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[14%]">Time</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[14%]">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!page ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 w-40 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-64 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions for this day</h3>
                    <p className="mt-1 text-sm text-gray-500">Pick another day or change the bank filter</p>
                  </td>
                </tr>
              ) : (
                transactions.map((tx: any) => {
                  const bank = banks?.find((b: any) => b._id === tx.bankAccountId);
                  return (
                    <tr key={tx._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {bank ? `${bank.accountName} - ${bank.bankName} (${bank.currency})` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 truncate" title={tx.description}>{tx.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{tx.transactionType.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(tx.transactionDate).toLocaleTimeString()}</td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${tx.amount >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(tx.amount, tx.currency)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {page && transactions.length > 0 && !Array.isArray(page) && (
            <div className="mt-3">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.currentPage + (page.isDone ? 0 : 1)}
                onPageChange={pagination.goToPage}
                isLoading={!page}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
