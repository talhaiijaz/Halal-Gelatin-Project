import { Id } from "./_generated/dataModel";

// Centralized bank account balance calculation utility
export async function updateBankAccountBalance(ctx: any, bankAccountId: Id<"bankAccounts">) {
  const bankAccount = await ctx.db.get(bankAccountId);
  if (!bankAccount) return;

  // Get all transactions for this bank account
  const transactions = await ctx.db
    .query("bankTransactions")
    .filter((q: any) => q.eq(q.field("bankAccountId"), bankAccountId))
    .collect();

  // Calculate current balance: opening balance + sum of active transactions only
  // Exclude cancelled and reversed transactions from balance calculation
  const openingBalance = bankAccount.openingBalance || 0;
  const totalTransactions = transactions
    .filter((t: any) => t.status !== "cancelled" && !t.isReversed)
    .reduce((sum: number, transaction: any) => sum + transaction.amount, 0);
  const currentBalance = openingBalance + totalTransactions;

  // Update the bank account
  await ctx.db.patch(bankAccountId, {
    currentBalance: currentBalance,
  });

  return currentBalance;
}

// Calculate balance without updating the database (for queries)
export function calculateBankAccountBalance(
  openingBalance: number,
  transactions: Array<{
    amount: number;
    status: string;
    isReversed?: boolean;
  }>
): number {
  const totalTransactions = transactions
    .filter((t: any) => t.status !== "cancelled" && !t.isReversed)
    .reduce((sum: number, transaction: any) => sum + transaction.amount, 0);
  
  return openingBalance + totalTransactions;
}
