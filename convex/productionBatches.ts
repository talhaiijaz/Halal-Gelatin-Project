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
    processingId: v.optional(v.id("productionProcessing")), // Optional processing state ID
  },
  handler: async (ctx, args) => {
    try {
      // Update processing state to "processing"
      if (args.processingId) {
        await ctx.db.patch(args.processingId, {
          status: "processing",
          progress: "Extracting data from PDF...",
          updatedAt: Date.now(),
        });
      }

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

    console.log(`Processing ${lines.length} lines from extracted data`);
    console.log('Raw extracted data:', args.extractedData);

    for (const line of lines) {
      // Skip header lines and empty lines
      if (line.includes('SR') || line.includes('Serial') || line.includes('Batch') || line.includes('Viscocity') || line.includes('Bloom') || line.includes('PH') || line.includes('Conductivity') || line.includes('Moisture') || line.includes('H2O2') || line.includes('SO2') || line.includes('Color') || line.includes('Clarity') || line.includes('Odour') || line.trim() === '') {
        continue;
      }

      // Parse the line data using pipe delimiter (|)
      const parts = line.split('|').map(part => part.trim());
      
      console.log(`Processing line with ${parts.length} parts:`, parts);
      
      if (parts.length >= 13) { // Expected format: SR # | Batch | Viscocity | Bloom | % age | PH | Conductivity | Moisture | H2O2 | SO2 | Color | Clarity | Odour
        // Helper function to parse numeric values, handling percentage signs
        const parseNumeric = (value: string): number | undefined => {
          if (!value || value === 'N/A' || value === '' || value === '|') return undefined;
          const cleaned = value.replace('%', '').trim();
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? undefined : parsed;
        };

        // Helper function to parse string values, handling empty or pipe values
        const parseString = (value: string): string | undefined => {
          if (!value || value === 'N/A' || value === '' || value === '|') return undefined;
          return value.trim();
        };

        // Extract batch number from the data (parts[1] is the Batch column, parts[0] is SR #)
        const extractedBatchNumber = parseNumeric(parts[1]); // Use Batch column, not SR # column
        if (!extractedBatchNumber) {
          console.warn(`Skipping row with invalid batch number: ${parts[1]} (SR #: ${parts[0]})`);
          continue;
        }

                // Check if batch number already exists across ALL files and years
                const existingBatch = await ctx.db
                  .query("productionBatches")
                  .withIndex("by_batch_number", (q) => q.eq("batchNumber", extractedBatchNumber))
                  .filter((q) => q.eq(q.field("isActive"), true))
                  .first();

                if (existingBatch) {
                  const existingSourceReport = existingBatch.sourceReport || 'Unknown file';
                  throw new Error(`Batch number ${extractedBatchNumber} already exists in file "${existingSourceReport}". Cannot create duplicate batch numbers across different files.`);
                }

                const batchData = {
                  batchNumber: extractedBatchNumber,
                  serialNumber: `Batch ${extractedBatchNumber}`, // Keep for database schema compatibility
                  viscosity: parseNumeric(parts[2]), // Viscocity column (index 2)
                  bloom: parseNumeric(parts[3]), // Bloom column (index 3)
                  percentage: parseNumeric(parts[4]), // % age column (index 4)
                  ph: parseNumeric(parts[5]), // PH column (index 5)
                  conductivity: parseNumeric(parts[6]), // Conductivity column (index 6)
                  moisture: parseNumeric(parts[7]), // Moisture column (index 7)
                  h2o2: parseNumeric(parts[8]), // H2O2 column (index 8)
                  so2: parseNumeric(parts[9]), // SO2 column (index 9)
                  color: parseString(parts[10]), // Color column (index 10)
                  clarity: parseString(parts[11]), // Clarity column (index 11)
                  odour: parseString(parts[12]), // Odour column (index 12)
                  sourceReport: args.sourceReport,
                  reportDate: args.reportDate,
                  isUsed: false,
                  year: currentYear,
                  isActive: true,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };

        console.log(`Creating batch with data:`, batchData);

        const batchId = await ctx.db.insert("productionBatches", batchData);
        createdBatches.push(batchId);
      }
    }

    // Update processing state to completed
    if (args.processingId) {
      await ctx.db.patch(args.processingId, {
        status: "completed",
        progress: `Successfully created ${createdBatches.length} batches`,
        completedBatches: createdBatches,
        updatedAt: Date.now(),
      });
    }

      return {
        createdCount: createdBatches.length,
        batchIds: createdBatches,
        nextBatchNumber: nextBatchNumber,
        year: currentYear,
      };
    } catch (error) {
      // Update processing state to error
      if (args.processingId) {
        await ctx.db.patch(args.processingId, {
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
          updatedAt: Date.now(),
        });
      }
      throw error;
    }
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
    try {
      // Check if the batch exists before deleting
      const batch = await ctx.db.get(args.id);
      if (!batch) {
        throw new Error(`Batch with ID ${args.id} not found`);
      }
      
      await ctx.db.delete(args.id);
      console.log(`Successfully deleted batch ${batch.batchNumber} (ID: ${args.id})`);
      return args.id;
    } catch (error) {
      console.error(`Failed to delete batch ${args.id}:`, error);
      throw error;
    }
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
    const errors: string[] = [];
    
    for (const batchId of args.batchIds) {
      try {
        // Check if the batch exists before deleting
        const batch = await ctx.db.get(batchId);
        if (!batch) {
          console.warn(`Batch with ID ${batchId} not found, skipping deletion`);
          continue;
        }
        
        await ctx.db.delete(batchId);
        deletedCount++;
        console.log(`Successfully deleted batch ${batch.batchNumber} (ID: ${batchId})`);
      } catch (error) {
        const errorMsg = `Failed to delete batch ${batchId}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    if (errors.length > 0) {
      console.warn(`Some batches failed to delete: ${errors.join(', ')}`);
    }

    console.log(`Delete operation completed: ${deletedCount}/${args.batchIds.length} batches deleted`);
    return deletedCount;
  },
});

// Get current year info
export const getCurrentYearInfo = query({
  args: {},
  handler: async (ctx) => {
    const currentYear = new Date().getFullYear();
    
    // Get the latest reset record to determine the current active year
    const latestReset = await ctx.db
      .query("batchResetRecords")
      .order("desc")
      .first();
    
    const activeYear = latestReset ? latestReset.year : currentYear;
    
    // Count batches for the active year
    const batchCount = await ctx.db
      .query("productionBatches")
      .withIndex("by_year_and_active", (q) => 
        q.eq("year", activeYear).eq("isActive", true)
      )
      .collect();
    
    return {
      currentYear: activeYear,
      batchCount: batchCount.length,
      lastResetDate: latestReset?.resetDate,
      lastResetNotes: latestReset?.notes
    };
  },
});

// Get available years (years that have batch data)
export const getAvailableYears = query({
  args: {},
  handler: async (ctx) => {
    const batches = await ctx.db
      .query("productionBatches")
      .collect();
    
    const years = Array.from(new Set(batches.map(batch => batch.year).filter(Boolean)));
    return years.sort((a, b) => (b || 0) - (a || 0)); // Sort descending (newest first)
  },
});

// Get file URL for viewing uploaded files
export const getFileUrl = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.fileId);
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


