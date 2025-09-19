// convex/bankTransactions.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { updateBankAccountBalance, calculateBankAccountBalance } from "./bankUtils";

// Helper function to format currency with proper locale and symbol support
function formatCurrency(amount: number, currency: string) {
  // Handle EUR specially to ensure symbol appears before number
  if (currency === 'EUR') {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `€${formatted}`;
  }

  // Use appropriate locale based on currency
  const locale = currency === 'USD' ? 'en-US' : 
                 currency === 'PKR' ? 'en-PK' : 
                 currency === 'AED' ? 'en-AE' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Log bank transaction events
async function logBankTransactionEvent(ctx: any, params: { 
  entityId: string; 
  action: "create" | "update" | "delete"; 
  message: string; 
  metadata?: any; 
  userId?: Id<"users"> | undefined; 
}) {
  try {
    await ctx.db.insert("logs", {
      entityTable: "bankTransactions",
      entityId: params.entityId,
      action: params.action,
      message: params.message,
      metadata: params.metadata,
      userId: params.userId,
      createdAt: Date.now(),
    });
  } catch {}
}

// Record a bank transaction
export const recordTransaction = mutation({
  args: {
    bankAccountId: v.id("bankAccounts"),
    transactionType: v.union(
      v.literal("deposit"),
      v.literal("withdrawal"),
      v.literal("transfer_in"),
      v.literal("transfer_out"),
      v.literal("payment_received"),
      v.literal("fee"),
      v.literal("interest"),
      v.literal("adjustment")
    ),
    amount: v.number(),
    currency: v.string(),
    description: v.string(),
    reference: v.optional(v.string()),
    paymentId: v.optional(v.id("payments")),
    relatedBankAccountId: v.optional(v.id("bankAccounts")),
    transactionDate: v.optional(v.number()),
    effectiveDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const bankAccount = await ctx.db.get(args.bankAccountId);
    if (!bankAccount) {
      throw new Error("Bank account not found");
    }

    // Validate amount based on transaction type
    if (args.transactionType === "withdrawal" || args.transactionType === "transfer_out" || args.transactionType === "fee") {
      if (args.amount > 0) {
        throw new Error("Withdrawal, transfer out, and fee amounts should be negative");
      }
    } else {
      if (args.amount < 0) {
        throw new Error("Deposit, transfer in, payment received, interest, and adjustment amounts should be positive");
      }
    }

    // Create the transaction with unique timestamp
    const now = Date.now();
    const transactionId = await ctx.db.insert("bankTransactions", {
      bankAccountId: args.bankAccountId,
      transactionType: args.transactionType,
      amount: args.amount,
      currency: args.currency,
      description: args.description,
      reference: args.reference,
      paymentId: args.paymentId,
      relatedBankAccountId: args.relatedBankAccountId,
      transactionDate: args.transactionDate || now,
      effectiveDate: args.effectiveDate,
      status: "completed",
      notes: args.notes,
      tags: args.tags,
      recordedBy: undefined as any, // TODO: Get from auth context
      createdAt: now,
    });

    // Update bank account balance
    await updateBankAccountBalance(ctx, args.bankAccountId);

    // Log the transaction
    await logBankTransactionEvent(ctx, {
      entityId: String(transactionId),
      action: "create",
      message: `${args.transactionType} transaction recorded: ${formatCurrency(args.amount, args.currency)} - ${args.description}`,
      metadata: {
        transactionId,
        bankAccountId: args.bankAccountId,
        transactionType: args.transactionType,
        amount: args.amount,
        currency: args.currency,
      },
    });

    return transactionId;
  },
});


// Get all transactions for a bank account
export const getTransactions = query({
  args: {
    bankAccountId: v.id("bankAccounts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("bankTransactions")
      .filter((q: any) => q.eq(q.field("bankAccountId"), args.bankAccountId));

    const transactions = await query.collect();
    
    // Sort by transaction date (most recent first), then by creation time (most recent first)
    const sortedTransactions = transactions.sort((a: any, b: any) => {
      // Sort by transaction date (most recent first)
      const dateDiff = b.transactionDate - a.transactionDate;
      if (dateDiff !== 0) return dateDiff;
      
      // If transaction dates are the same, sort by creation time (most recent first)
      // This ensures the most recently created transaction appears at the top
      return b.createdAt - a.createdAt;
    });
    
    // Apply limit if specified
    if (args.limit) {
      return sortedTransactions.slice(0, args.limit);
    }
    
    return sortedTransactions;
  },
});

// Get transaction by ID
export const getTransaction = query({
  args: {
    id: v.id("bankTransactions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Update transaction
export const updateTransaction = mutation({
  args: {
    id: v.id("bankTransactions"),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("pending"), v.literal("completed"), v.literal("cancelled"))),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.id);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    await ctx.db.patch(args.id, {
      description: args.description,
      notes: args.notes,
      tags: args.tags,
      status: args.status,
    });

    // Recalculate bank account balance
    await updateBankAccountBalance(ctx, transaction.bankAccountId);

    await logBankTransactionEvent(ctx, {
      entityId: String(args.id),
      action: "update",
      message: `Transaction updated: ${transaction.description}`,
      metadata: { transactionId: args.id, updates: args },
    });

    return { success: true };
  },
});

// Delete transaction
export const deleteTransaction = mutation({
  args: {
    id: v.id("bankTransactions"),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.id);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Soft delete: mark as cancelled and keep for audit
    await ctx.db.patch(args.id, {
      status: "cancelled",
      notes: transaction.notes,
    });

    // Recalculate bank account balance
    await updateBankAccountBalance(ctx, transaction.bankAccountId);

    await logBankTransactionEvent(ctx, {
      entityId: String(args.id),
      action: "delete",
      message: `Transaction cancelled: ${transaction.description}`,
      metadata: { transactionId: args.id, transaction },
    });

    return { success: true };
  },
});

// Reverse a transaction (just marks as reversed, no new entry)
export const reverseTransaction = mutation({
  args: {
    id: v.id("bankTransactions"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const original = await ctx.db.get(args.id);
    if (!original) throw new Error("Transaction not found");
    if (original.isReversed) throw new Error("Transaction already reversed");
    if (original.paymentId) throw new Error("Payment-linked transactions can only be reversed from the Payments tab");

    const now = Date.now();
    
    // Reverse the original transaction
    await ctx.db.patch(args.id, {
      isReversed: true,
      reversedAt: now,
      reversalReason: args.reason || "Manual reversal",
    });

    // Check if this transaction is linked to another transaction (inter-bank transfer)
    if (original.linkedTransactionId) {
      const linkedTransaction = await ctx.db.get(original.linkedTransactionId);
      if (linkedTransaction && !linkedTransaction.isReversed) {
        // Reverse the linked transaction as well
        await ctx.db.patch(original.linkedTransactionId, {
          isReversed: true,
          reversedAt: now,
          reversalReason: `Linked reversal: ${args.reason || "Manual reversal"}`,
        });

        // Update the linked transaction's bank account balance
        await updateBankAccountBalance(ctx, linkedTransaction.bankAccountId);

        // Log the linked reversal
        await logBankTransactionEvent(ctx, {
          entityId: String(original.linkedTransactionId),
          action: "update",
          message: `Linked transaction reversed: ${linkedTransaction.description} - Linked reversal: ${args.reason || "Manual reversal"}`,
          metadata: { 
            originalId: args.id, 
            linkedId: original.linkedTransactionId,
            reason: args.reason 
          },
        });
      }
    }

    // Update bank account balance (reversed transactions don't contribute to balance)
    await updateBankAccountBalance(ctx, original.bankAccountId);

    await logBankTransactionEvent(ctx, {
      entityId: String(args.id),
      action: "update",
      message: `Transaction reversed: ${original.description}${args.reason ? ` - ${args.reason}` : ""}`,
      metadata: { 
        originalId: args.id, 
        linkedId: original.linkedTransactionId,
        reason: args.reason 
      },
    });

    return { success: true };
  },
});

// Transfer money between bank accounts with currency conversion support
export const transferBetweenAccounts = mutation({
  args: {
    fromBankAccountId: v.id("bankAccounts"),
    toBankAccountId: v.id("bankAccounts"),
    amount: v.number(),
    currency: v.string(),
    description: v.string(),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    transactionDate: v.optional(v.number()), // User-selected transaction date
    // Currency conversion fields
    exchangeRate: v.optional(v.number()), // Required when currencies differ
    originalAmount: v.optional(v.number()), // Original amount in source currency
    originalCurrency: v.optional(v.string()), // Source currency
  },
  handler: async (ctx, args) => {
    if (args.fromBankAccountId === args.toBankAccountId) {
      throw new Error("Cannot transfer to the same account");
    }

    if (args.amount <= 0) {
      throw new Error("Transfer amount must be positive");
    }

    // Get both bank accounts
    const fromAccount = await ctx.db.get(args.fromBankAccountId);
    const toAccount = await ctx.db.get(args.toBankAccountId);
    
    if (!fromAccount || !toAccount) {
      throw new Error("One or both bank accounts not found");
    }

    // Determine if currency conversion is needed
    const needsConversion = fromAccount.currency !== toAccount.currency;
    
    if (needsConversion) {
      // Validate conversion parameters
      if (!args.exchangeRate || !args.originalAmount || !args.originalCurrency) {
        throw new Error("Exchange rate, original amount, and original currency are required for cross-currency transfers");
      }
      
      if (args.exchangeRate <= 0) {
        throw new Error("Exchange rate must be greater than 0");
      }
      
      if (args.originalAmount <= 0) {
        throw new Error("Original amount must be greater than 0");
      }
      
      // Validate that original currency matches source account
      if (args.originalCurrency !== fromAccount.currency) {
        throw new Error(`Original currency (${args.originalCurrency}) must match source account currency (${fromAccount.currency})`);
      }
      
      // Validate that target currency matches destination account
      if (args.currency !== toAccount.currency) {
        throw new Error(`Target currency (${args.currency}) must match destination account currency (${toAccount.currency})`);
      }
      
      // Check if source account has sufficient balance in original currency
      if (fromAccount.currentBalance && fromAccount.currentBalance < args.originalAmount) {
        throw new Error(`Insufficient balance. Available: ${formatCurrency(fromAccount.currentBalance, fromAccount.currency)}, Required: ${formatCurrency(args.originalAmount, args.originalCurrency)}`);
      }
    } else {
      // Same currency transfer - validate balance
      if (fromAccount.currentBalance && fromAccount.currentBalance < args.amount) {
        throw new Error(`Insufficient balance. Available: ${formatCurrency(fromAccount.currentBalance, fromAccount.currency)}, Required: ${formatCurrency(args.amount, args.currency)}`);
      }
    }

    // Calculate USD conversion for reporting
    let convertedAmountUSD: number | undefined;
    if (needsConversion && args.exchangeRate && args.originalCurrency && args.originalAmount) {
      // For cross-currency transfers, convert original amount to USD
      if (args.originalCurrency === 'USD') {
        convertedAmountUSD = args.originalAmount;
      } else if (args.currency === 'USD') {
        convertedAmountUSD = args.amount;
      } else {
        // Both currencies are non-USD, need to convert original to USD
        // This would require an additional exchange rate from original currency to USD
        // For now, we'll use the amount in the target currency
        convertedAmountUSD = args.amount;
      }
    } else if (args.currency === 'USD') {
      convertedAmountUSD = args.amount;
    }

    // Create transfer out transaction
    const now = Date.now();
    const userTransactionDate = args.transactionDate || now;
    const transferOutData: any = {
      bankAccountId: args.fromBankAccountId,
      transactionType: "transfer_out",
      amount: needsConversion ? -(args.originalAmount || 0) : -args.amount,
      currency: needsConversion ? args.originalCurrency : args.currency,
      description: `Transfer to ${toAccount.accountName}: ${args.description}`,
      reference: args.reference,
      relatedBankAccountId: args.toBankAccountId,
      transactionDate: userTransactionDate - 1000, // 1 second earlier for outgoing transfer
      status: "completed",
      notes: args.notes,
      recordedBy: undefined as any,
      createdAt: now - 1000,
    };

    // Add conversion fields for outgoing transaction
    if (needsConversion) {
      transferOutData.originalAmount = args.originalAmount;
      transferOutData.originalCurrency = args.originalCurrency;
      transferOutData.exchangeRate = args.exchangeRate;
      transferOutData.convertedAmountUSD = convertedAmountUSD;
    }

    const transferOutId = await ctx.db.insert("bankTransactions", transferOutData);

    // Create transfer in transaction
    const transferInData: any = {
      bankAccountId: args.toBankAccountId,
      transactionType: "transfer_in",
      amount: args.amount, // Positive for incoming transfer
      currency: args.currency,
      description: `Transfer from ${fromAccount.accountName}: ${args.description}`,
      reference: args.reference,
      relatedBankAccountId: args.fromBankAccountId,
      transactionDate: userTransactionDate, // Use user-selected transaction date
      status: "completed",
      notes: args.notes,
      recordedBy: undefined as any,
      createdAt: now,
    };

    // Add conversion fields for incoming transaction
    if (needsConversion) {
      transferInData.originalAmount = args.originalAmount;
      transferInData.originalCurrency = args.originalCurrency;
      transferInData.exchangeRate = args.exchangeRate;
      transferInData.convertedAmountUSD = convertedAmountUSD;
    }

    const transferInId = await ctx.db.insert("bankTransactions", transferInData);

    // Link the pair
    await ctx.db.patch(transferOutId, { linkedTransactionId: transferInId as any });
    await ctx.db.patch(transferInId, { linkedTransactionId: transferOutId as any });

    // Update both account balances
    await updateBankAccountBalance(ctx, args.fromBankAccountId);
    await updateBankAccountBalance(ctx, args.toBankAccountId);

    // Log the transfer with conversion details
    const logMessage = needsConversion 
      ? `Transfer completed: ${formatCurrency(args.originalAmount || 0, args.originalCurrency || '')} → ${formatCurrency(args.amount, args.currency)} (Rate: ${args.exchangeRate || 1}) from ${fromAccount.accountName} to ${toAccount.accountName}`
      : `Transfer completed: ${formatCurrency(args.amount, args.currency)} from ${fromAccount.accountName} to ${toAccount.accountName}`;

    await logBankTransactionEvent(ctx, {
      entityId: String(transferOutId),
      action: "create",
      message: logMessage,
      metadata: {
        transferOutId,
        transferInId,
        fromBankAccountId: args.fromBankAccountId,
        toBankAccountId: args.toBankAccountId,
        amount: args.amount,
        currency: args.currency,
        originalAmount: args.originalAmount,
        originalCurrency: args.originalCurrency,
        exchangeRate: args.exchangeRate,
        convertedAmountUSD,
      },
    });

    return { transferOutId, transferInId };
  },
});

// Get bank account with current balance and recent transactions
export const getAccountWithTransactions = query({
  args: {
    bankAccountId: v.id("bankAccounts"),
    transactionLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const bankAccount = await ctx.db.get(args.bankAccountId);
    if (!bankAccount) {
      return null;
    }

    // Get recent transactions
    const transactions = await ctx.db
      .query("bankTransactions")
      .filter(q => q.eq(q.field("bankAccountId"), args.bankAccountId))
      .collect();

    const sortedTransactions = transactions
      .sort((a, b) => {
        // Sort by transaction date (most recent first)
        const dateDiff = b.transactionDate - a.transactionDate;
        if (dateDiff !== 0) return dateDiff;
        
        // If transaction dates are the same, sort by creation time (most recent first)
        // This ensures the most recently created transaction appears at the top
        return b.createdAt - a.createdAt;
      })
      .slice(0, args.transactionLimit || 50);

    // Calculate current balance using utility function
    const openingBalance = bankAccount.openingBalance || 0;
    const currentBalance = calculateBankAccountBalance(openingBalance, transactions, bankAccount.currency);

    return {
      ...bankAccount,
      currentBalance: currentBalance,
      recentTransactions: sortedTransactions,
      totalTransactions: transactions.length,
    };
  },
});

// Get transaction statistics for a bank account
export const getTransactionStats = query({
  args: {
    bankAccountId: v.id("bankAccounts"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("bankTransactions")
      .filter(q => q.eq(q.field("bankAccountId"), args.bankAccountId));

    const transactions = await query.collect();

    // Filter by date range and exclude cancelled/reversed transactions
    let filteredTransactions = transactions.filter((t: any) => t.status !== "cancelled" && !t.isReversed);
    if (args.startDate || args.endDate) {
      filteredTransactions = filteredTransactions.filter(transaction => {
        if (args.startDate && transaction.transactionDate < args.startDate) return false;
        if (args.endDate && transaction.transactionDate > args.endDate) return false;
        return true;
      });
    }

    // Calculate statistics
    const totalDeposits = filteredTransactions
      .filter((t: any) => t.amount > 0)
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const totalWithdrawals = filteredTransactions
      .filter((t: any) => t.amount < 0)
      .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);

    const transactionCounts = filteredTransactions.reduce((acc: any, transaction: any) => {
      acc[transaction.transactionType] = (acc[transaction.transactionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTransactions: filteredTransactions.length,
      totalDeposits,
      totalWithdrawals,
      netAmount: totalDeposits - totalWithdrawals,
      transactionCounts,
      period: {
        startDate: args.startDate,
        endDate: args.endDate,
      },
    };
  },
});
