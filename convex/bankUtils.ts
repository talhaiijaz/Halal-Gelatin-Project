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
  
  // For balance calculation, we need to convert all transactions to the bank account's currency
  const totalTransactions = transactions
    .filter((t: any) => t.status !== "cancelled" && !t.isReversed)
    .reduce((sum: number, transaction: any) => {
      // If transaction currency matches bank account currency, use amount directly
      if (transaction.currency === bankAccount.currency) {
        return sum + transaction.amount;
      }
      
      // If transaction has conversion data, use the converted amount
      if (transaction.exchangeRate && transaction.originalAmount && transaction.originalCurrency) {
        // For cross-currency transactions, we need to determine the correct amount
        // If the transaction was originally in the bank account's currency, use originalAmount
        if (transaction.originalCurrency === bankAccount.currency) {
          return sum + transaction.originalAmount;
        }
        // If the transaction was converted to the bank account's currency, use amount
        if (transaction.currency === bankAccount.currency) {
          return sum + transaction.amount;
        }
      }
      
      // Fallback: use the transaction amount (this might be incorrect for cross-currency)
      // This should be logged as a warning
      console.warn(`Transaction ${transaction._id} currency mismatch: transaction=${transaction.currency}, bank=${bankAccount.currency}`);
      return sum + transaction.amount;
    }, 0);
    
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
    currency: string;
    status: string;
    isReversed?: boolean;
    exchangeRate?: number;
    originalAmount?: number;
    originalCurrency?: string;
  }>,
  bankAccountCurrency: string
): number {
  const totalTransactions = transactions
    .filter((t: any) => t.status !== "cancelled" && !t.isReversed)
    .reduce((sum: number, transaction: any) => {
      // If transaction currency matches bank account currency, use amount directly
      if (transaction.currency === bankAccountCurrency) {
        return sum + transaction.amount;
      }
      
      // If transaction has conversion data, use the converted amount
      if (transaction.exchangeRate && transaction.originalAmount && transaction.originalCurrency) {
        // For cross-currency transactions, we need to determine the correct amount
        // If the transaction was originally in the bank account's currency, use originalAmount
        if (transaction.originalCurrency === bankAccountCurrency) {
          return sum + transaction.originalAmount;
        }
        // If the transaction was converted to the bank account's currency, use amount
        if (transaction.currency === bankAccountCurrency) {
          return sum + transaction.amount;
        }
      }
      
      // Fallback: use the transaction amount (this might be incorrect for cross-currency)
      return sum + transaction.amount;
    }, 0);
  
  return openingBalance + totalTransactions;
}
