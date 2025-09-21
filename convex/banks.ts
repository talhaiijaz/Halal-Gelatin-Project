import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { updateBankAccountBalance, calculateBankAccountBalance } from "./bankUtils";
import { paginationOptsValidator } from "convex/server";


async function logBankEvent(ctx: any, params: { entityId: string; action: "create" | "update" | "delete"; message: string; metadata?: any; userId?: Id<"users"> | undefined; }) {
  try {
    await ctx.db.insert("logs", {
      entityTable: "banks",
      entityId: params.entityId,
      action: params.action,
      message: params.message,
      metadata: params.metadata,
      userId: params.userId as any,
      createdAt: Date.now(),
    });
  } catch {}
}

// Get all bank accounts
export const list = query({
  args: {},
  handler: async (ctx) => {
    const bankAccounts = await ctx.db.query("bankAccounts").collect();
    return bankAccounts.sort((a, b) => b.createdAt - a.createdAt);
  },
});


// Get bank account by ID
export const get = query({
  args: { id: v.id("bankAccounts") },
  handler: async (ctx, args) => {
    const bankAccount = await ctx.db.get(args.id);
    if (!bankAccount) {
      throw new Error("Bank account not found");
    }
    return bankAccount;
  },
});

// Create new bank account
export const create = mutation({
  args: {
    accountName: v.string(),
    bankName: v.string(),
    accountNumber: v.string(),
    currency: v.string(),
    country: v.string(), // Required for new banks
    openingBalance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if all existing banks have countries
    const validationResult: { allHaveCountries: boolean; banksWithoutCountries: any[] } = await ctx.runQuery(api.banks.checkAllBanksHaveCountries, {});
    if (!validationResult.allHaveCountries) {
      throw new Error("Cannot create new banks until all existing banks have countries assigned. Please update existing banks first.");
    }

    // Check if account number already exists
    const existingAccount = await ctx.db
      .query("bankAccounts")
      .filter(q => q.eq(q.field("accountNumber"), args.accountNumber))
      .first();
    
    if (existingAccount) {
      throw new Error("Account number already exists");
    }

    const bankAccountId = await ctx.db.insert("bankAccounts", {
      accountName: args.accountName,
      bankName: args.bankName,
      accountNumber: args.accountNumber,
      currency: args.currency,
      country: args.country,
      openingBalance: args.openingBalance,
      status: "active",
      createdAt: Date.now(),
    });

    // If opening balance is provided, create an initial opening balance transaction
    if (args.openingBalance && args.openingBalance !== 0) {
      const now = Date.now();
      
      // Create opening balance transaction
      await ctx.db.insert("bankTransactions", {
        bankAccountId: bankAccountId,
        transactionType: "adjustment",
        amount: args.openingBalance, // Positive for opening balance
        currency: args.currency,
        description: `Initial opening balance: ${args.openingBalance}`,
        reference: `OB-INIT-${now}`,
        transactionDate: now,
        status: "completed",
        notes: `Initial opening balance set when account was created: ${args.openingBalance}`,
        recordedBy: undefined as any, // TODO: Get from auth context
        createdAt: now,
      });
    }

    // Set current balance to opening balance initially
    await ctx.db.patch(bankAccountId, {
      currentBalance: args.openingBalance || 0,
    });

    await logBankEvent(ctx, { 
      entityId: String(bankAccountId), 
      action: "create", 
      message: `Bank account created: ${args.accountName} (${args.bankName}) in ${args.country}${args.openingBalance ? ` with opening balance of ${args.openingBalance} ${args.currency}` : ''}` 
    });
    return bankAccountId;
  },
});

// Update bank account
export const update = mutation({
  args: {
    id: v.id("bankAccounts"),
    accountName: v.string(),
    bankName: v.string(),
    accountNumber: v.string(),
    currency: v.string(),
    country: v.string(), // Required for updates
    openingBalance: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    // Get the current bank account
    const currentAccount = await ctx.db.get(args.id);
    if (!currentAccount) {
      throw new Error("Bank account not found");
    }

    // Check if account number already exists (excluding current account)
    const existingAccount = await ctx.db
      .query("bankAccounts")
      .filter(q => 
        q.and(
          q.eq(q.field("accountNumber"), args.accountNumber),
          q.neq(q.field("_id"), args.id)
        )
      )
      .first();
    
    if (existingAccount) {
      throw new Error("Account number already exists");
    }

    // Check if opening balance has changed
    const oldOpeningBalance = currentAccount.openingBalance || 0;
    const newOpeningBalance = args.openingBalance || 0;
    const openingBalanceChanged = oldOpeningBalance !== newOpeningBalance;
    const openingBalanceDifference = newOpeningBalance - oldOpeningBalance;

    // Update the bank account
    await ctx.db.patch(args.id, {
      accountName: args.accountName,
      bankName: args.bankName,
      accountNumber: args.accountNumber,
      currency: args.currency,
      country: args.country,
      openingBalance: args.openingBalance,
      status: args.status,
    });

    // If opening balance changed, create an adjustment transaction
    if (openingBalanceChanged) {
      const now = Date.now();
      
      // Create adjustment transaction
      await ctx.db.insert("bankTransactions", {
        bankAccountId: args.id,
        transactionType: "adjustment",
        amount: openingBalanceDifference, // Positive for increase, negative for decrease
        currency: args.currency,
        description: `Opening balance adjustment: ${oldOpeningBalance} → ${newOpeningBalance}`,
        reference: `OB-ADJ-${now}`,
        transactionDate: now,
        status: "completed",
        notes: `Opening balance adjusted from ${oldOpeningBalance} to ${newOpeningBalance}. Difference: ${openingBalanceDifference > 0 ? '+' : ''}${openingBalanceDifference}`,
        recordedBy: undefined as any, // TODO: Get from auth context
        createdAt: now,
      });

      // Recalculate current balance
      await updateBankAccountBalance(ctx, args.id);
    }

    await logBankEvent(ctx, { 
      entityId: String(args.id), 
      action: "update", 
      message: `Bank account updated: ${args.accountName} (${args.bankName}) in ${args.country}${openingBalanceChanged ? ` - Opening balance adjusted from ${oldOpeningBalance} to ${newOpeningBalance}` : ''}` 
    });
    
    return { success: true };
  },
});

// Get all payments for a specific bank account with pagination
export const getPayments = query({
  args: {
    bankAccountId: v.id("bankAccounts"),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .filter(q => q.eq(q.field("bankAccountId"), args.bankAccountId))
      .collect();

    // Sort by payment date (most recent first), then by creation time (most recent first)
    payments.sort((a, b) => {
      const dateDiff = b.paymentDate - a.paymentDate;
      if (dateDiff !== 0) return dateDiff;
      // Same date: most recent creation time first
      return b.createdAt - a.createdAt;
    });

    // Apply pagination (if paginationOpts provided) or return all payments
    if (args.paginationOpts) {
      const startIndex = args.paginationOpts.cursor ? parseInt(args.paginationOpts.cursor) : 0;
      const endIndex = startIndex + args.paginationOpts.numItems;
      const paginatedPayments = payments.slice(startIndex, endIndex);

      return {
        page: paginatedPayments,
        isDone: endIndex >= payments.length,
        continueCursor: endIndex < payments.length ? endIndex.toString() : null,
      };
    } else {
      return payments;
    }
  },
});

// Calculate and update current balance for a bank account
export const updateCurrentBalance = mutation({
  args: {
    bankAccountId: v.id("bankAccounts"),
  },
  handler: async (ctx, args) => {
    const currentBalance = await updateBankAccountBalance(ctx, args.bankAccountId);
    return currentBalance;
  },
});

// Get bank account with calculated current balance
export const getWithBalance = query({
  args: {
    id: v.id("bankAccounts"),
  },
  handler: async (ctx, args) => {
    const bankAccount = await ctx.db.get(args.id);
    if (!bankAccount) {
      return null;
    }

    // Get all transactions for this bank account
    const transactions = await ctx.db
      .query("bankTransactions")
      .filter(q => q.eq(q.field("bankAccountId"), args.id))
      .collect();

    // Calculate current balance using utility function
    const openingBalance = bankAccount.openingBalance || 0;
    const currentBalance = calculateBankAccountBalance(openingBalance, transactions, bankAccount.currency);

    return {
      ...bankAccount,
      currentBalance: currentBalance,
    };
  },
});

// Delete bank account
export const remove = mutation({
  args: { id: v.id("bankAccounts") },
  handler: async (ctx, args) => {
    // Get bank account details before deletion for logging
    const bankAccount = await ctx.db.get(args.id);
    
    await ctx.db.delete(args.id);
    
    // Create detailed log message
    const accountDetails = bankAccount ? `${bankAccount.accountName} (${bankAccount.bankName})` : String(args.id);
    const logMessage = `Bank account deleted: ${accountDetails}`;
    
    await logBankEvent(ctx, { entityId: String(args.id), action: "delete", message: logMessage });
    return { success: true };
  },
});

// List all bank accounts with current balances
export const listWithBalances = query({
  args: {},
  handler: async (ctx) => {
    const bankAccounts = await ctx.db.query("bankAccounts").collect();
    
    // Calculate current balance for each account
    const accountsWithBalances = await Promise.all(
      bankAccounts.map(async (account) => {
        const transactions = await ctx.db
          .query("bankTransactions")
          .filter(q => q.eq(q.field("bankAccountId"), account._id))
          .collect();

        const openingBalance = account.openingBalance || 0;
        const currentBalance = calculateBankAccountBalance(openingBalance, transactions, account.currency);

        return {
          ...account,
          currentBalance: currentBalance,
        };
      })
    );

    return accountsWithBalances.sort((a, b) => a.accountName.localeCompare(b.accountName));
  },
});

// Get bank account statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const bankAccounts = await ctx.db.query("bankAccounts").collect();
    
    const totalAccounts = bankAccounts.length;
    const activeAccounts = bankAccounts.filter(account => account.status === "active").length;
    
    // Group by currency
    const accountsByCurrency = bankAccounts.reduce((acc, account) => {
      if (!acc[account.currency]) {
        acc[account.currency] = 0;
      }
      acc[account.currency]++;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAccounts,
      activeAccounts,
      accountsByCurrency,
    };
  },
});

// Check if all banks have countries assigned
export const checkAllBanksHaveCountries = query({
  args: {},
  returns: v.object({
    allHaveCountries: v.boolean(),
    banksWithoutCountries: v.array(v.object({
      _id: v.id("bankAccounts"),
      accountName: v.string(),
      bankName: v.string(),
      accountNumber: v.string(),
    })),
  }),
  handler: async (ctx) => {
    const bankAccounts = await ctx.db.query("bankAccounts").collect();
    
    // Filter banks without countries (this will catch existing banks that don't have the country field)
    const banksWithoutCountries = bankAccounts.filter(account => !account.country || account.country.trim() === '');
    
    return {
      allHaveCountries: banksWithoutCountries.length === 0,
      banksWithoutCountries: banksWithoutCountries.map(account => ({
        _id: account._id,
        accountName: account.accountName,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
      })),
    };
  },
});

// Validate if new bank creation is allowed
export const canCreateNewBank = query({
  args: {},
  returns: v.object({
    canCreate: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<{ canCreate: boolean; reason?: string }> => {
    const validationResult: { allHaveCountries: boolean; banksWithoutCountries: any[] } = await ctx.runQuery(api.banks.checkAllBanksHaveCountries, {});
    
    if (!validationResult.allHaveCountries) {
      return {
        canCreate: false,
        reason: `Cannot create new banks until all existing banks have countries assigned. ${validationResult.banksWithoutCountries.length} bank(s) missing countries.`,
      };
    }
    
    return {
      canCreate: true,
    };
  },
});

