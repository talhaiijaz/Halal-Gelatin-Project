import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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
  },
  handler: async (ctx, args) => {
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
      status: "active",
      createdAt: Date.now(),
    });

    await logBankEvent(ctx, { entityId: String(bankAccountId), action: "create", message: `Bank account created: ${args.accountName} (${args.bankName})` });
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
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
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

    await ctx.db.patch(args.id, {
      accountName: args.accountName,
      bankName: args.bankName,
      accountNumber: args.accountNumber,
      currency: args.currency,
      status: args.status,
    });

    await logBankEvent(ctx, { entityId: String(args.id), action: "update", message: `Bank account updated: ${args.accountName} (${args.bankName})` });
    return { success: true };
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
