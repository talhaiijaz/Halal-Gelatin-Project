// convex/productionBatches.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all production batches with pagination (only active batches)
export const getAllBatches = query({
  args: {
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.optional(v.union(v.string(), v.null())),
    })),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const paginationOpts = args.paginationOpts || { numItems: 50 };
    const currentYear = args.year || new Date().getFullYear();
    
    // Ensure cursor is either string or null, not undefined
    const validPaginationOpts = {
      numItems: paginationOpts.numItems,
      cursor: paginationOpts.cursor ?? null,
    };
    
    const batches = await ctx.db
      .query("productionBatches")
      .withIndex("by_year_and_active", (q) => 
        q.eq("year", currentYear).eq("isActive", true)
      )
      .order("desc")
      .paginate(validPaginationOpts);

    return batches;
  },
});

// Get batch by batch number
export const getBatchByNumber = query({
  args: { batchNumber: v.number() },
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("productionBatches")
      .withIndex("by_batch_number", (q) => q.eq("batchNumber", args.batchNumber))
      .first();

    return batch;
  },
});

// Get next available batch number for current year
export const getNextBatchNumber = query({
  args: { year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const currentYear = args.year || new Date().getFullYear();
    
    const lastBatch = await ctx.db
      .query("productionBatches")
      .withIndex("by_year_and_active", (q) => 
        q.eq("year", currentYear).eq("isActive", true)
      )
      .order("desc")
      .first();

    return lastBatch ? lastBatch.batchNumber + 1 : 1;
  },
});

// Get batches by source report
export const getBatchesBySourceReport = query({
  args: { sourceReport: v.string() },
  handler: async (ctx, args) => {
    const batches = await ctx.db
      .query("productionBatches")
      .withIndex("by_source_report", (q) => q.eq("sourceReport", args.sourceReport))
      .collect();

    return batches;
  },
});

// Get unused batches (for future batch selection logic)
export const getUnusedBatches = query({
  args: {},
  handler: async (ctx) => {
    const batches = await ctx.db
      .query("productionBatches")
      .withIndex("by_is_used", (q) => q.eq("isUsed", false))
      .collect();

    return batches;
  },
});

// Get batches by viscosity range (for future batch selection logic)
export const getBatchesByViscosityRange = query({
  args: { 
    minViscosity: v.number(), 
    maxViscosity: v.number() 
  },
  handler: async (ctx, args) => {
    const batches = await ctx.db
      .query("productionBatches")
      .filter((q) => 
        q.and(
          q.gte(q.field("viscosity"), args.minViscosity),
          q.lte(q.field("viscosity"), args.maxViscosity),
          q.eq(q.field("isUsed"), false)
        )
      )
      .collect();

    return batches;
  },
});

// Get batches by bloom range (for future batch selection logic)
export const getBatchesByBloomRange = query({
  args: { 
    minBloom: v.number(), 
    maxBloom: v.number() 
  },
  handler: async (ctx, args) => {
    const batches = await ctx.db
      .query("productionBatches")
      .filter((q) => 
        q.and(
          q.gte(q.field("bloom"), args.minBloom),
          q.lte(q.field("bloom"), args.maxBloom),
          q.eq(q.field("isUsed"), false)
        )
      )
      .collect();

    return batches;
  },
});

// Create a new batch
export const createBatch = mutation({
  args: {
    batchNumber: v.number(),
    serialNumber: v.string(),
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
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const currentYear = new Date().getFullYear();
    
    const batchId = await ctx.db.insert("productionBatches", {
      ...args,
      isUsed: false,
      year: currentYear,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return batchId;
  },
});

// Create multiple batches from extracted data
export const createBatchesFromExtractedData = mutation({
  args: {
    extractedData: v.string(), // Raw extracted text from PDF
    sourceReport: v.string(),
    reportDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentYear = new Date().getFullYear();
    
    // Get the next batch number to start from for current year
    const lastBatch = await ctx.db
      .query("productionBatches")
      .withIndex("by_year_and_active", (q) => 
        q.eq("year", currentYear).eq("isActive", true)
      )
      .order("desc")
      .first();
    
    let nextBatchNumber = lastBatch ? lastBatch.batchNumber + 1 : 1;

    // Parse the extracted data to create batch records
    const lines = args.extractedData.split('\n').filter(line => line.trim());
    const createdBatches = [];

    for (const line of lines) {
      // Skip header lines and empty lines
      if (line.includes('SR') || line.includes('Serial') || line.includes('Batch') || line.trim() === '') {
        continue;
      }

      // Parse the line data (this is a simplified parser - you might need to adjust based on actual data format)
      const parts = line.split(/\s+/).filter(part => part.trim());
      
      if (parts.length >= 3) { // Minimum required fields
        const batchId = await ctx.db.insert("productionBatches", {
          batchNumber: nextBatchNumber++,
          serialNumber: parts[0] || `SR #${nextBatchNumber}`,
          viscosity: parseFloat(parts[1]) || undefined,
          bloom: parseFloat(parts[2]) || undefined,
          percentage: parseFloat(parts[3]) || undefined,
          ph: parseFloat(parts[4]) || undefined,
          conductivity: parseFloat(parts[5]) || undefined,
          moisture: parseFloat(parts[6]) || undefined,
          h2o2: parseFloat(parts[7]) || undefined,
          so2: parseFloat(parts[8]) || undefined,
          color: parts[9] || undefined,
          clarity: parts[10] || undefined,
          odour: parts[11] || undefined,
          sourceReport: args.sourceReport,
          reportDate: args.reportDate,
          isUsed: false,
          year: currentYear,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        createdBatches.push(batchId);
      }
    }

    return {
      createdCount: createdBatches.length,
      batchIds: createdBatches,
      nextBatchNumber: nextBatchNumber,
      year: currentYear,
    };
  },
});

// Update a batch
export const updateBatch = mutation({
  args: {
    id: v.id("productionBatches"),
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
    const { id, ...updates } = args;
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

// Mark batch as used (for future batch selection logic)
export const markBatchAsUsed = mutation({
  args: {
    id: v.id("productionBatches"),
    usedInOrder: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isUsed: true,
      usedInOrder: args.usedInOrder,
      usedDate: Date.now(),
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Delete a batch
export const deleteBatch = mutation({
  args: { id: v.id("productionBatches") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Delete all batches from a specific report
export const deleteBatchesBySourceReport = mutation({
  args: { sourceReport: v.string() },
  handler: async (ctx, args) => {
    const batches = await ctx.db
      .query("productionBatches")
      .withIndex("by_source_report", (q) => q.eq("sourceReport", args.sourceReport))
      .collect();

    for (const batch of batches) {
      await ctx.db.delete(batch._id);
    }

    return batches.length;
  },
});

// Delete multiple batches by IDs
export const deleteMultipleBatches = mutation({
  args: { batchIds: v.array(v.id("productionBatches")) },
  handler: async (ctx, args) => {
    let deletedCount = 0;
    
    for (const batchId of args.batchIds) {
      try {
        await ctx.db.delete(batchId);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete batch ${batchId}:`, error);
      }
    }

    return deletedCount;
  },
});

// Get batch reset records
export const getBatchResetRecords = query({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db
      .query("batchResetRecords")
      .order("desc")
      .collect();

    return records;
  },
});

// Reset batch numbers for new year
export const resetBatchNumbersForNewYear = mutation({
  args: { 
    newYear: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentYear = new Date().getFullYear();
    
    // Get the highest batch number from current year
    const lastBatch = await ctx.db
      .query("productionBatches")
      .withIndex("by_year_and_active", (q) => 
        q.eq("year", currentYear).eq("isActive", true)
      )
      .order("desc")
      .first();

    const previousYearMaxBatch = lastBatch ? lastBatch.batchNumber : 0;

    // Mark all current year batches as inactive
    const currentYearBatches = await ctx.db
      .query("productionBatches")
      .withIndex("by_year_and_active", (q) => 
        q.eq("year", currentYear).eq("isActive", true)
      )
      .collect();

    for (const batch of currentYearBatches) {
      await ctx.db.patch(batch._id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }

    // Create reset record
    await ctx.db.insert("batchResetRecords", {
      year: args.newYear,
      resetDate: Date.now(),
      previousYearMaxBatch,
      newYearStartBatch: 1,
      notes: args.notes,
      createdAt: Date.now(),
    });

    return {
      previousYearMaxBatch,
      newYearStartBatch: 1,
      batchesMarkedInactive: currentYearBatches.length,
    };
  },
});

// Get current year info
export const getCurrentYearInfo = query({
  args: {},
  handler: async (ctx) => {
    const currentYear = new Date().getFullYear();
    
    const activeBatches = await ctx.db
      .query("productionBatches")
      .withIndex("by_year_and_active", (q) => 
        q.eq("year", currentYear).eq("isActive", true)
      )
      .collect();

    const lastBatch = activeBatches.length > 0 
      ? activeBatches.reduce((max, batch) => batch.batchNumber > max.batchNumber ? batch : max)
      : null;

    const resetRecord = await ctx.db
      .query("batchResetRecords")
      .withIndex("by_year", (q) => q.eq("year", currentYear))
      .first();

    return {
      currentYear,
      totalActiveBatches: activeBatches.length,
      lastBatchNumber: lastBatch?.batchNumber || 0,
      nextBatchNumber: lastBatch ? lastBatch.batchNumber + 1 : 1,
      wasReset: !!resetRecord,
      resetDate: resetRecord?.resetDate,
    };
  },
});
