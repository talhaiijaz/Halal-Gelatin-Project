import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

// Get all outsource batches with pagination
export const getAllOutsourceBatches = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("outsourceBatches")
      .withIndex("by_fiscal_year_and_active", (q) => q.eq("fiscalYear", "2025-26").eq("isActive", true))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// Get outsource batch by ID
export const getOutsourceBatchById = query({
  args: { batchId: v.id("outsourceBatches") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.batchId);
  },
});

// Get outsource batches by fiscal year
export const getOutsourceBatchesByFiscalYear = query({
  args: { fiscalYear: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("outsourceBatches")
      .withIndex("by_fiscal_year_and_active", (q) => q.eq("fiscalYear", args.fiscalYear).eq("isActive", true))
      .order("desc")
      .collect();
  },
});

// Get available (unused) outsource batches for blending
export const getAvailableOutsourceBatches = query({
  args: { fiscalYear: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const fiscalYear = args.fiscalYear || "2025-26";
    return await ctx.db
      .query("outsourceBatches")
      .withIndex("by_fiscal_year_and_active", (q) => q.eq("fiscalYear", fiscalYear).eq("isActive", true))
      .filter((q) => q.eq(q.field("isUsed"), false))
      .order("asc")
      .collect();
  },
});

// Get outsource batch statistics
export const getOutsourceBatchStats = query({
  args: { fiscalYear: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const fiscalYear = args.fiscalYear || "2025-26";
    const batches = await ctx.db
      .query("outsourceBatches")
      .withIndex("by_fiscal_year_and_active", (q) => q.eq("fiscalYear", fiscalYear).eq("isActive", true))
      .collect();

    const totalBatches = batches.length;
    const usedBatches = batches.filter(batch => batch.isUsed).length;
    const availableBatches = totalBatches - usedBatches;

    // Calculate quality parameter ranges
    const blooms = batches.map(b => b.bloom).filter(b => b !== undefined) as number[];
    const viscosities = batches.map(b => b.viscosity).filter(v => v !== undefined) as number[];
    const percentages = batches.map(b => b.percentage).filter(p => p !== undefined) as number[];
    const phs = batches.map(b => b.ph).filter(p => p !== undefined) as number[];

    return {
      totalBatches,
      usedBatches,
      availableBatches,
      bloomRange: blooms.length > 0 ? { min: Math.min(...blooms), max: Math.max(...blooms) } : null,
      viscosityRange: viscosities.length > 0 ? { min: Math.min(...viscosities), max: Math.max(...viscosities) } : null,
      percentageRange: percentages.length > 0 ? { min: Math.min(...percentages), max: Math.max(...percentages) } : null,
      phRange: phs.length > 0 ? { min: Math.min(...phs), max: Math.max(...phs) } : null,
    };
  },
});

// Create a new outsource batch
export const createOutsourceBatch = mutation({
  args: {
    batchNumber: v.number(),
    supplierName: v.string(),
    supplierBatchId: v.optional(v.string()),
    viscosity: v.optional(v.number()),
    bloom: v.optional(v.number()),
    percentage: v.optional(v.number()),
    ph: v.optional(v.number()),
    conductivity: v.optional(v.number()),
    moisture: v.optional(v.number()),
    h2o2: v.optional(v.number()),
    so2: v.optional(v.number()),
    color: v.optional(v.string()),
    clarity: v.optional(v.string()),
    odour: v.optional(v.string()),
    sourceReport: v.optional(v.string()),
    reportDate: v.optional(v.number()),
    fileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    fiscalYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const fiscalYear = args.fiscalYear || "2025-26";

    // Check if batch number already exists
    const existingBatch = await ctx.db
      .query("outsourceBatches")
      .withIndex("by_batch_number", (q) => q.eq("batchNumber", args.batchNumber))
      .first();

    if (existingBatch) {
      throw new Error(`Batch number ${args.batchNumber} already exists`);
    }

    return await ctx.db.insert("outsourceBatches", {
      batchNumber: args.batchNumber,
      supplierName: args.supplierName,
      supplierBatchId: args.supplierBatchId,
      viscosity: args.viscosity,
      bloom: args.bloom,
      percentage: args.percentage,
      ph: args.ph,
      conductivity: args.conductivity,
      moisture: args.moisture,
      h2o2: args.h2o2,
      so2: args.so2,
      color: args.color,
      clarity: args.clarity,
      odour: args.odour,
      sourceReport: args.sourceReport,
      reportDate: args.reportDate,
      fileId: args.fileId,
      isUsed: false,
      notes: args.notes,
      year: new Date().getFullYear(),
      fiscalYear,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update an outsource batch
export const updateOutsourceBatch = mutation({
  args: {
    batchId: v.id("outsourceBatches"),
    supplierName: v.optional(v.string()),
    supplierBatchId: v.optional(v.string()),
    viscosity: v.optional(v.number()),
    bloom: v.optional(v.number()),
    percentage: v.optional(v.number()),
    ph: v.optional(v.number()),
    conductivity: v.optional(v.number()),
    moisture: v.optional(v.number()),
    h2o2: v.optional(v.number()),
    so2: v.optional(v.number()),
    color: v.optional(v.string()),
    clarity: v.optional(v.string()),
    odour: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { batchId, ...updates } = args;
    const now = Date.now();

    return await ctx.db.patch(batchId, {
      ...updates,
      updatedAt: now,
    });
  },
});

// Delete an outsource batch
export const deleteOutsourceBatch = mutation({
  args: { batchId: v.id("outsourceBatches") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.batchId);
  },
});

// Mark outsource batch as used
export const markOutsourceBatchAsUsed = mutation({
  args: {
    batchId: v.id("outsourceBatches"),
    usedInOrder: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.patch(args.batchId, {
      isUsed: true,
      usedInOrder: args.usedInOrder,
      usedDate: now,
      updatedAt: now,
    });
  },
});

// Mark outsource batch as available (unused)
export const markOutsourceBatchAsAvailable = mutation({
  args: { batchId: v.id("outsourceBatches") },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.patch(args.batchId, {
      isUsed: false,
      usedInOrder: undefined,
      usedDate: undefined,
      updatedAt: now,
    });
  },
});

// Get next available batch number for outsource batches
export const getNextOutsourceBatchNumber = query({
  args: { fiscalYear: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const fiscalYear = args.fiscalYear || "2025-26";
    const batches = await ctx.db
      .query("outsourceBatches")
      .withIndex("by_fiscal_year_and_active", (q) => q.eq("fiscalYear", fiscalYear).eq("isActive", true))
      .collect();

    if (batches.length === 0) {
      return 1;
    }

    const maxBatchNumber = Math.max(...batches.map(batch => batch.batchNumber));
    return maxBatchNumber + 1;
  },
});

// Reset outsource batches for a new fiscal year
export const resetOutsourceBatchesForFiscalYear = mutation({
  args: { newFiscalYear: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get all active batches
    const activeBatches = await ctx.db
      .query("outsourceBatches")
      .withIndex("by_fiscal_year_and_active", (q) => q.eq("fiscalYear", "2025-26").eq("isActive", true))
      .collect();

    // Mark all batches as inactive
    for (const batch of activeBatches) {
      await ctx.db.patch(batch._id, {
        isActive: false,
        updatedAt: now,
      });
    }

    // Record the reset
    await ctx.db.insert("batchResetRecords", {
      year: new Date().getFullYear(),
      fiscalYear: args.newFiscalYear,
      resetDate: now,
      previousYearMaxBatch: activeBatches.length > 0 ? Math.max(...activeBatches.map(b => b.batchNumber)) : 0,
      newYearStartBatch: 1,
      notes: `Reset ${activeBatches.length} outsource batches for fiscal year ${args.newFiscalYear}`,
      createdAt: now,
    });

    return { message: `Reset ${activeBatches.length} outsource batches for fiscal year ${args.newFiscalYear}` };
  },
});
