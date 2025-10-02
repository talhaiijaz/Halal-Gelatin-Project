import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { requireFinancialAccess, getCurrentUser } from "./authUtils";

/**
 * Create a new inter-bank transfer
 */
export const create = mutation({
  args: {
    fromBankAccountId: v.id("bankAccounts"),
    toBankAccountId: v.id("bankAccounts"),
    amount: v.number(),
    currency: v.string(),
    originalAmount: v.optional(v.number()),
    originalCurrency: v.optional(v.string()),
    exchangeRate: v.optional(v.number()),
    invoiceId: v.optional(v.id("invoices")),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Tax deduction fields
    hasTaxDeduction: v.optional(v.boolean()),
    taxDeductionRate: v.optional(v.number()),
    taxDeductionAmount: v.optional(v.number()),
    taxDeductionCurrency: v.optional(v.string()),
    netAmountReceived: v.optional(v.number()),
  },
  returns: v.id("interBankTransfers"),
  handler: async (ctx, args) => {
    // Require financial access
    await requireFinancialAccess(ctx);
    
    const now = Date.now();
    
    // Validate that both bank accounts exist
    const fromBank = await ctx.db.get(args.fromBankAccountId);
    const toBank = await ctx.db.get(args.toBankAccountId);
    
    if (!fromBank) {
      throw new Error("Source bank account not found");
    }
    
    if (!toBank) {
      throw new Error("Destination bank account not found");
    }
    
    // Note: Currency validation is handled in the frontend for cross-currency transfers
    // The transfer currency should match the destination bank currency
    // Cross-currency transfers are handled via exchange rates in the frontend
    
    // Create the transfer record
    const transferId = await (ctx.db as any).insert("interBankTransfers", {
      fromBankAccountId: args.fromBankAccountId,
      toBankAccountId: args.toBankAccountId,
      amount: args.amount,
      currency: args.currency,
      originalAmount: args.originalAmount,
      originalCurrency: args.originalCurrency,
      exchangeRate: args.exchangeRate,
      invoiceId: args.invoiceId,
      reference: args.reference,
      notes: args.notes,
      // Tax deduction fields
      hasTaxDeduction: args.hasTaxDeduction,
      taxDeductionRate: args.taxDeductionRate,
      taxDeductionAmount: args.taxDeductionAmount,
      taxDeductionCurrency: args.taxDeductionCurrency,
      netAmountReceived: args.netAmountReceived,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    
    return transferId as Id<"interBankTransfers">;
  },
});

/**
 * Update transfer status (complete, fail, cancel)
 */
export const updateStatus = mutation({
  args: {
    transferId: v.id("interBankTransfers"),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
    transferDate: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Require financial access
    await requireFinancialAccess(ctx);
    
    const transfer = await ctx.db.get(args.transferId);
    
    if (!transfer) {
      throw new Error("Transfer not found");
    }
    
    // Update the transfer
    await ctx.db.patch(args.transferId, {
      status: args.status,
      transferDate: args.transferDate || Date.now(),
    });
    
    // If transfer is completed, update bank balances
    if (args.status === "completed") {
      // Get current bank account details
      const fromBank = await ctx.db.get(transfer.fromBankAccountId);
      const toBank = await ctx.db.get(transfer.toBankAccountId);
      
      if (fromBank) {
        // Decrease source bank balance by the full transfer amount
        await ctx.db.patch(transfer.fromBankAccountId, {
          currentBalance: (fromBank.currentBalance || 0) - transfer.amount,
        });
      }
      
      if (toBank) {
        // Increase destination bank balance by the net amount received (after tax deduction)
        // If no tax deduction, use the full amount; otherwise use netAmountReceived
        const amountToAdd = transfer.netAmountReceived || transfer.amount;
        await ctx.db.patch(transfer.toBankAccountId, {
          currentBalance: (toBank.currentBalance || 0) + amountToAdd,
        });
      }
    }
  },
});

/**
 * Delete an inter-bank transfer
 */
export const deleteTransfer = mutation({
  args: {
    transferId: v.id("interBankTransfers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    throw new Error("Delete functionality is disabled. Please contact the administrator to delete records.");
    
    // Note: Bank balance updates are handled by the bank transaction deletion
    // since inter-bank transfers are always linked to bank transactions
  },
});

/**
 * Get transfer status for multiple invoices (batch operation)
 */
export const getBatchTransferStatus = query({
  args: {
    invoiceIds: v.array(v.id("invoices")),
  },
  returns: v.record(v.id("invoices"), v.object({
    invoiceAmount: v.number(),
    totalTransferredToPakistan: v.number(),
    percentageTransferred: v.number(),
    hasMetThreshold: v.boolean(),
    transfers: v.array(v.object({
      _id: v.id("interBankTransfers"),
      amount: v.number(),
      status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
      toBankCountry: v.optional(v.string()),
      // Tax deduction fields
      hasTaxDeduction: v.optional(v.boolean()),
      taxDeductionRate: v.optional(v.number()),
      taxDeductionAmount: v.optional(v.number()),
      taxDeductionCurrency: v.optional(v.string()),
      netAmountReceived: v.optional(v.number()),
    })),
  })),
  handler: async (ctx, args) => {
    // Require financial access
    await requireFinancialAccess(ctx);
    
    const results: Record<string, any> = {};
    
    for (const invoiceId of args.invoiceIds) {
      const transferStatus = await ctx.runQuery(api.interBankTransfers.checkInvoicePakistanTransferStatus, {
        invoiceId,
      });
      results[invoiceId] = transferStatus;
    }
    
    return results;
  },
});

/**
 * Get transfers for a specific bank account
 */
export const getByBankAccount = query({
  args: {
    bankAccountId: v.id("bankAccounts"),
    type: v.union(v.literal("from"), v.literal("to"), v.literal("all")),
  },
  returns: v.array(v.object({
    _id: v.id("interBankTransfers"),
    _creationTime: v.number(),
    fromBankAccountId: v.id("bankAccounts"),
    toBankAccountId: v.id("bankAccounts"),
    amount: v.number(),
    currency: v.string(),
    originalAmount: v.optional(v.number()),
    originalCurrency: v.optional(v.string()),
    exchangeRate: v.optional(v.number()),
    invoiceId: v.optional(v.id("invoices")),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Tax deduction fields
    hasTaxDeduction: v.optional(v.boolean()),
    taxDeductionRate: v.optional(v.number()),
    taxDeductionAmount: v.optional(v.number()),
    taxDeductionCurrency: v.optional(v.string()),
    netAmountReceived: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
    transferDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    fromBank: v.optional(v.object({
      _id: v.id("bankAccounts"),
      bankName: v.string(),
      accountName: v.string(),
      currency: v.string(),
      country: v.optional(v.string()),
    })),
    toBank: v.optional(v.object({
      _id: v.id("bankAccounts"),
      bankName: v.string(),
      accountName: v.string(),
      currency: v.string(),
      country: v.optional(v.string()),
    })),
    invoice: v.optional(v.object({
      _id: v.id("invoices"),
      invoiceNumber: v.optional(v.string()),
      amount: v.number(),
      currency: v.string(),
    })),
  })),
  handler: async (ctx, args) => {
    // Require financial access
    await requireFinancialAccess(ctx);
    
    let transfers;
    
    if (args.type === "from") {
      transfers = await ctx.db
        .query("interBankTransfers")
        .withIndex("by_from_bank", (q) => q.eq("fromBankAccountId", args.bankAccountId))
        .order("desc")
        .collect();
    } else if (args.type === "to") {
      transfers = await ctx.db
        .query("interBankTransfers")
        .withIndex("by_to_bank", (q) => q.eq("toBankAccountId", args.bankAccountId))
        .order("desc")
        .collect();
    } else {
      // Get transfers where bank is either source or destination
      const fromTransfers = await ctx.db
        .query("interBankTransfers")
        .withIndex("by_from_bank", (q) => q.eq("fromBankAccountId", args.bankAccountId))
        .collect();
      
      const toTransfers = await ctx.db
        .query("interBankTransfers")
        .withIndex("by_to_bank", (q) => q.eq("toBankAccountId", args.bankAccountId))
        .collect();
      
      transfers = [...fromTransfers, ...toTransfers];
    }
    
    // Enrich with bank and invoice details
    const enrichedTransfers = await Promise.all(
      transfers.map(async (transfer) => {
        const fromBank = await ctx.db.get(transfer.fromBankAccountId);
        const toBank = await ctx.db.get(transfer.toBankAccountId);
        const invoice = transfer.invoiceId ? await ctx.db.get(transfer.invoiceId) : null;
        
        return {
          ...transfer,
          fromBank: fromBank ? {
            _id: fromBank._id,
            bankName: fromBank.bankName,
            accountName: fromBank.accountName,
            currency: fromBank.currency,
            country: fromBank.country,
          } : undefined,
          toBank: toBank ? {
            _id: toBank._id,
            bankName: toBank.bankName,
            accountName: toBank.accountName,
            currency: toBank.currency,
            country: toBank.country,
          } : undefined,
          invoice: invoice ? {
            _id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            currency: invoice.currency,
          } : undefined,
        };
      })
    );
    
    return enrichedTransfers;
  },
});

/**
 * Get transfers for a specific invoice
 */
export const getByInvoice = query({
  args: {
    invoiceId: v.id("invoices"),
  },
  returns: v.array(v.object({
    _id: v.id("interBankTransfers"),
    _creationTime: v.number(),
    fromBankAccountId: v.id("bankAccounts"),
    toBankAccountId: v.id("bankAccounts"),
    amount: v.number(),
    currency: v.string(),
    originalAmount: v.optional(v.number()),
    originalCurrency: v.optional(v.string()),
    exchangeRate: v.optional(v.number()),
    invoiceId: v.optional(v.id("invoices")),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Tax deduction fields
    hasTaxDeduction: v.optional(v.boolean()),
    taxDeductionRate: v.optional(v.number()),
    taxDeductionAmount: v.optional(v.number()),
    taxDeductionCurrency: v.optional(v.string()),
    netAmountReceived: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
    transferDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    fromBank: v.optional(v.object({
      _id: v.id("bankAccounts"),
      bankName: v.string(),
      accountName: v.string(),
      currency: v.string(),
      country: v.optional(v.string()),
    })),
    toBank: v.optional(v.object({
      _id: v.id("bankAccounts"),
      bankName: v.string(),
      accountName: v.string(),
      currency: v.string(),
      country: v.optional(v.string()),
    })),
  })),
  handler: async (ctx, args) => {
    // Require financial access
    await requireFinancialAccess(ctx);
    
    const transfers = await ctx.db
      .query("interBankTransfers")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .order("desc")
      .collect();
    
    // Enrich with bank details
    const enrichedTransfers = await Promise.all(
      transfers.map(async (transfer) => {
        const fromBank = await ctx.db.get(transfer.fromBankAccountId);
        const toBank = await ctx.db.get(transfer.toBankAccountId);
        
        return {
          ...transfer,
          fromBank: fromBank ? {
            _id: fromBank._id,
            bankName: fromBank.bankName,
            accountName: fromBank.accountName,
            currency: fromBank.currency,
            country: fromBank.country,
          } : undefined,
          toBank: toBank ? {
            _id: toBank._id,
            bankName: toBank.bankName,
            accountName: toBank.accountName,
            currency: toBank.currency,
            country: toBank.country,
          } : undefined,
        };
      })
    );
    
    return enrichedTransfers;
  },
});

/**
 * Check if an invoice has 70% or more transferred to Pakistani banks
 */
export const checkInvoicePakistanTransferStatus = query({
  args: {
    invoiceId: v.id("invoices"),
  },
  returns: v.object({
    invoiceAmount: v.number(),
    totalTransferredToPakistan: v.number(),
    percentageTransferred: v.number(),
    hasMetThreshold: v.boolean(),
    transfers: v.array(v.object({
      _id: v.id("interBankTransfers"),
      amount: v.number(),
      status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
      toBankCountry: v.optional(v.string()),
      // Tax deduction fields
      hasTaxDeduction: v.optional(v.boolean()),
      taxDeductionRate: v.optional(v.number()),
      taxDeductionAmount: v.optional(v.number()),
      taxDeductionCurrency: v.optional(v.string()),
      netAmountReceived: v.optional(v.number()),
    })),
  }),
  handler: async (ctx, args) => {
    // Require financial access
    await requireFinancialAccess(ctx);
    
    const invoice = await ctx.db.get(args.invoiceId);
    
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    
    // Get all completed transfers for this invoice
    const transfers = await ctx.db
      .query("interBankTransfers")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();
    
    // Calculate total transferred to Pakistani banks
    // Use original amounts (before conversion) for percentage calculation to match invoice currency
    let totalTransferredToPakistan = 0;
    const transferDetails = [];
    
    for (const transfer of transfers) {
      const toBank = await ctx.db.get(transfer.toBankAccountId);
      
      if (toBank && toBank.country === "Pakistan") {
        // Use original amount if available (before conversion), otherwise use transfer amount
        const amountForCalculation = transfer.originalAmount || transfer.amount;
        totalTransferredToPakistan += amountForCalculation;
      }
      
      transferDetails.push({
        _id: transfer._id,
        amount: transfer.amount, // Keep display amount as converted amount
        status: transfer.status,
        toBankCountry: toBank?.country,
        // Tax deduction fields
        hasTaxDeduction: transfer.hasTaxDeduction,
        taxDeductionRate: transfer.taxDeductionRate,
        taxDeductionAmount: transfer.taxDeductionAmount,
        taxDeductionCurrency: transfer.taxDeductionCurrency,
        netAmountReceived: transfer.netAmountReceived,
      });
    }
    
    const percentageTransferred = (totalTransferredToPakistan / invoice.amount) * 100;
    const hasMetThreshold = percentageTransferred >= 70;
    
    return {
      invoiceAmount: invoice.amount,
      totalTransferredToPakistan,
      percentageTransferred,
      hasMetThreshold,
      transfers: transferDetails,
    };
  },
});

/**
 * Get all inter-bank transfers with pagination
 */
export const list = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("interBankTransfers"),
      _creationTime: v.number(),
      fromBankAccountId: v.id("bankAccounts"),
      toBankAccountId: v.id("bankAccounts"),
      amount: v.number(),
      currency: v.string(),
      invoiceId: v.optional(v.id("invoices")),
      reference: v.optional(v.string()),
      notes: v.optional(v.string()),
      // Tax deduction fields
      hasTaxDeduction: v.optional(v.boolean()),
      taxDeductionRate: v.optional(v.number()),
      taxDeductionAmount: v.optional(v.number()),
      taxDeductionCurrency: v.optional(v.string()),
      netAmountReceived: v.optional(v.number()),
      status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
      transferDate: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      fromBank: v.optional(v.object({
        _id: v.id("bankAccounts"),
        bankName: v.string(),
        accountName: v.string(),
        currency: v.string(),
        country: v.optional(v.string()),
      })),
      toBank: v.optional(v.object({
        _id: v.id("bankAccounts"),
        bankName: v.string(),
        accountName: v.string(),
        currency: v.string(),
        country: v.optional(v.string()),
      })),
      invoice: v.optional(v.object({
        _id: v.id("invoices"),
        invoiceNumber: v.optional(v.string()),
        amount: v.number(),
        currency: v.string(),
      })),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Require financial access
    await requireFinancialAccess(ctx);
    
    const result = await ctx.db
      .query("interBankTransfers")
      .order("desc")
      .paginate(args.paginationOpts);
    
    // Enrich with bank and invoice details
    const enrichedTransfers = await Promise.all(
      result.page.map(async (transfer) => {
        const fromBank = await ctx.db.get(transfer.fromBankAccountId);
        const toBank = await ctx.db.get(transfer.toBankAccountId);
        const invoice = transfer.invoiceId ? await ctx.db.get(transfer.invoiceId) : null;
        
        return {
          ...transfer,
          fromBank: fromBank ? {
            _id: fromBank._id,
            bankName: fromBank.bankName,
            accountName: fromBank.accountName,
            currency: fromBank.currency,
            country: fromBank.country,
          } : undefined,
          toBank: toBank ? {
            _id: toBank._id,
            bankName: toBank.bankName,
            accountName: toBank.accountName,
            currency: toBank.currency,
            country: toBank.country,
          } : undefined,
          invoice: invoice ? {
            _id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            currency: invoice.currency,
          } : undefined,
        };
      })
    );
    
    return {
      ...result,
      page: enrichedTransfers,
    };
  },
});
