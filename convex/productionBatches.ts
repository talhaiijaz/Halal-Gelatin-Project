// convex/productionBatches.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getFiscalYear, getCalendarYearFromFiscal, isValidFiscalYear } from "./fiscalYearUtils";

// Get all production batches with pagination (only active batches)
export const getAllBatches = query({
  args: {
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.optional(v.union(v.string(), v.null())),
    })),
    year: v.optional(v.number()),
    fiscalYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paginationOpts = args.paginationOpts || { numItems: 50 };
    
    // Ensure cursor is either string or null, not undefined
    const validPaginationOpts = {
      numItems: paginationOpts.numItems,
      cursor: paginationOpts.cursor ?? null,
    };
    
    let batches;
    
    if (args.fiscalYear) {
      // Use fiscal year if provided
      batches = await ctx.db
        .query("productionBatches")
        .withIndex("by_fiscal_year_and_active", (q) => 
          q.eq("fiscalYear", args.fiscalYear).eq("isActive", true)
        )
        .order("desc")
        .paginate(validPaginationOpts);
    } else {
      // Fallback to calendar year (legacy support)
      const currentYear = args.year || new Date().getFullYear();
      batches = await ctx.db
        .query("productionBatches")
        .withIndex("by_year_and_active", (q) => 
          q.eq("year", currentYear).eq("isActive", true)
        )
        .order("desc")
        .paginate(validPaginationOpts);
    }

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
  args: { 
    year: v.optional(v.number()),
    fiscalYear: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let lastBatch;
    
    if (args.fiscalYear) {
      // Use fiscal year if provided
      lastBatch = await ctx.db
        .query("productionBatches")
        .withIndex("by_fiscal_year_and_active", (q) => 
          q.eq("fiscalYear", args.fiscalYear).eq("isActive", true)
        )
        .order("desc")
        .first();
    } else {
      // Fallback to calendar year (legacy support)
      const currentYear = args.year || new Date().getFullYear();
      lastBatch = await ctx.db
        .query("productionBatches")
        .withIndex("by_year_and_active", (q) => 
          q.eq("year", currentYear).eq("isActive", true)
        )
        .order("desc")
        .first();
    }

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
    fiscalYear: v.optional(v.string()), // Optional fiscal year override
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const currentYear = new Date().getFullYear();
    
    // Determine fiscal year
    let fiscalYear = args.fiscalYear;
    if (!fiscalYear) {
      // Get from settings or use current fiscal year
      const yearSettings = await ctx.db.query("productionYearSettings").first();
      fiscalYear = yearSettings?.currentFiscalYear || getFiscalYear(currentYear);
    }
    
    const batchId = await ctx.db.insert("productionBatches", {
      ...args,
      isUsed: false,
      year: currentYear,
      fiscalYear,
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
    fileId: v.optional(v.id("_storage")), // Optional file storage ID
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

      // Get the current production year from settings
      const yearSettings = await ctx.db.query("productionYearSettings").first();
      const currentYear = yearSettings ? yearSettings.currentYear : new Date().getFullYear();
      const currentFiscalYear = yearSettings?.currentFiscalYear || getFiscalYear(currentYear);
    
    // Get the next batch number to start from for current fiscal year
    const lastBatch = await ctx.db
      .query("productionBatches")
      .withIndex("by_fiscal_year_and_active", (q) => 
        q.eq("fiscalYear", currentFiscalYear).eq("isActive", true)
      )
      .order("desc")
      .first();
    
    let nextBatchNumber = lastBatch ? lastBatch.batchNumber + 1 : 1;

    // Parse the extracted data to create batch records
    const lines = args.extractedData.split('\n').filter(line => line.trim());
    const createdBatches = [];
    const skippedBatches = [];

    console.log(`Processing ${lines.length} lines from extracted data`);
    console.log('Raw extracted data:', args.extractedData);
    console.log('First 5 lines:', lines.slice(0, 5));
    console.log('Last 5 lines:', lines.slice(-5));

    for (const line of lines) {
      // Skip header lines, empty lines, and unwanted sections
      if (line.includes('Batch') || line.includes('Viscocity') || line.includes('Bloom') || line.includes('PH') || line.includes('Conductivity') || line.includes('Moisture') || line.includes('H2O2') || line.includes('SO2') || line.includes('Color') || line.includes('Clarity') || line.includes('Odour') || 
          line.includes('Average') || line.includes('Total') || line.includes('Lot num') || line.includes('Lot Num') || 
          line.includes('201-220') || line.includes('221-240') || line.includes('241-260') || 
          line.includes('Checked By') || line.includes('Verified By') || line.includes('Document Number') || 
          line.includes('Internal Use Only') || line.includes('HGPL-QA') || line.trim() === '') {
        continue;
      }

      // Parse the line data using pipe delimiter (|)
      const parts = line.split('|').map(part => part.trim());
      
      console.log(`Processing line with ${parts.length} parts:`, parts);
      
      if (parts.length >= 12) { // Expected format: Batch | Viscocity | Bloom | % age | PH | Conductivity | Moisture | H2O2 | SO2 | Color | Clarity | Odour
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

        // Extract batch number from the data (parts[0] is now the Batch column)
        const extractedBatchNumber = parseNumeric(parts[0]); // Use Batch column as first column
        if (!extractedBatchNumber) {
          console.warn(`Skipping row with invalid batch number: ${parts[0]}`);
          continue;
        }
        
        console.log(`Processing batch number: ${extractedBatchNumber}`);

                // Check if batch number already exists across ALL files and years
                const existingBatch = await ctx.db
                  .query("productionBatches")
                  .withIndex("by_batch_number", (q) => q.eq("batchNumber", extractedBatchNumber))
                  .filter((q) => q.eq(q.field("isActive"), true))
                  .first();

                if (existingBatch) {
                  console.log(`Skipping batch ${extractedBatchNumber} - already exists in file "${existingBatch.sourceReport || 'Unknown file'}"`);
                  skippedBatches.push({
                    batchNumber: extractedBatchNumber,
                    reason: `Already exists in file "${existingBatch.sourceReport || 'Unknown file'}"`
                  });
                  continue; // Skip this batch instead of throwing an error
                }

                const batchData = {
                  batchNumber: extractedBatchNumber,
                  serialNumber: `Batch ${extractedBatchNumber}`, // Keep for database schema compatibility
                  viscosity: parseNumeric(parts[1]), // Viscocity column (index 1)
                  bloom: parseNumeric(parts[2]), // Bloom column (index 2)
                  percentage: parseNumeric(parts[3]), // % age column (index 3)
                  ph: parseNumeric(parts[4]), // PH column (index 4)
                  conductivity: parseNumeric(parts[5]), // Conductivity column (index 5)
                  moisture: parseNumeric(parts[6]), // Moisture column (index 6)
                  h2o2: parseNumeric(parts[7]), // H2O2 column (index 7)
                  so2: parseNumeric(parts[8]), // SO2 column (index 8)
                  color: parseString(parts[9]), // Color column (index 9)
                  clarity: parseString(parts[10]), // Clarity column (index 10)
                  odour: parseString(parts[11]), // Odour column (index 11)
                  sourceReport: args.sourceReport,
                  reportDate: args.reportDate,
                  fileId: args.fileId, // Store the file ID for viewing
                  isUsed: false,
                  isOnHold: false,
                  year: currentYear,
                  fiscalYear: currentFiscalYear,
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

      // Log summary of what was processed
      const allProcessedBatches = [...createdBatches.map(id => `created`), ...skippedBatches.map(b => `skipped #${b.batchNumber}`)];
      console.log(`Extraction summary: Found ${lines.length} lines, processed ${allProcessedBatches.length} batches`);
      console.log(`Created batches: ${createdBatches.length}, Skipped batches: ${skippedBatches.length}`);

      return {
        createdCount: createdBatches.length,
        skippedCount: skippedBatches.length,
        batchIds: createdBatches,
        skippedBatches: skippedBatches,
        nextBatchNumber: nextBatchNumber,
        year: currentYear,
        summary: `Created ${createdBatches.length} new batches, skipped ${skippedBatches.length} existing batches`,
        extractedLinesCount: lines.length
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
    isOnHold: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
    });

    return id;
  },
});

// Toggle hold status for a production batch
export const toggleBatchHold = mutation({
  args: {
    id: v.id("productionBatches"),
    isOnHold: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, { isOnHold: args.isOnHold, updatedAt: now });
    return args.id;
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

// Update batch status (used/available)
export const updateBatchStatus = mutation({
  args: {
    id: v.id("productionBatches"),
    isUsed: v.boolean(),
    usedInOrder: v.optional(v.string()),
    isOnHold: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const updateData: any = {
      isUsed: args.isUsed,
      updatedAt: Date.now(),
    };
    if (args.isOnHold !== undefined) updateData.isOnHold = args.isOnHold;

    if (args.isUsed) {
      updateData.usedInOrder = args.usedInOrder || null;
      updateData.usedDate = Date.now();
    } else {
      updateData.usedInOrder = null;
      updateData.usedDate = null;
    }

    await ctx.db.patch(args.id, updateData);
    return args.id;
  },
});

// Update multiple batch statuses in bulk
export const updateMultipleBatchStatuses = mutation({
  args: {
    batchIds: v.array(v.id("productionBatches")),
    isUsed: v.boolean(),
    usedInOrder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updateData: any = {
      isUsed: args.isUsed,
      updatedAt: Date.now(),
    };

    if (args.isUsed) {
      updateData.usedInOrder = args.usedInOrder || null;
      updateData.usedDate = Date.now();
    } else {
      updateData.usedInOrder = null;
      updateData.usedDate = null;
    }

    const updatePromises = args.batchIds.map(id => 
      ctx.db.patch(id, updateData)
    );

    await Promise.all(updatePromises);
    return args.batchIds.length;
  },
});

// Delete a batch (disabled - admin only)
export const deleteBatch = mutation({
  args: { id: v.id("productionBatches") },
  handler: async (ctx, args) => {
    throw new Error("Delete functionality is disabled. Please contact the administrator to delete records.");
  },
});

// Delete all batches from a specific report (disabled - admin only)
export const deleteBatchesBySourceReport = mutation({
  args: { sourceReport: v.string() },
  handler: async (ctx, args) => {
    throw new Error("Delete functionality is disabled. Please contact the administrator to delete records.");
  },
});

// Delete multiple batches by IDs
export const deleteMultipleBatches = mutation({
  args: { batchIds: v.array(v.id("productionBatches")) },
  handler: async (ctx, args) => {
    throw new Error("Delete functionality is disabled. Please contact the administrator to delete records.");
  },
});

// Get current year info
export const getCurrentYearInfo = query({
  args: {},
  handler: async (ctx) => {
    // Get the current production year from settings
    const yearSettings = await ctx.db.query("productionYearSettings").first();
    const currentYear = yearSettings ? yearSettings.currentYear : new Date().getFullYear();
    const currentFiscalYear = yearSettings?.currentFiscalYear || getFiscalYear(currentYear);
    
    // Get the latest reset record to determine the current active year
    const latestReset = await ctx.db
      .query("batchResetRecords")
      .order("desc")
      .first();
    
    const activeYear = latestReset ? latestReset.year : currentYear;
    const activeFiscalYear = latestReset?.fiscalYear || currentFiscalYear;
    
    // Count batches for the active fiscal year
    const batchCount = await ctx.db
      .query("productionBatches")
      .withIndex("by_fiscal_year_and_active", (q) => 
        q.eq("fiscalYear", activeFiscalYear).eq("isActive", true)
      )
      .collect();
    
    return {
      currentYear: activeYear,
      currentFiscalYear: activeFiscalYear,
      batchCount: batchCount.length,
      lastResetDate: latestReset?.resetDate,
      lastResetNotes: latestReset?.notes
    };
  },
});

// Get available years (years that have batch data) - legacy
export const getAvailableYears = query({
  args: {},
  handler: async (ctx) => {
    // Get available years from production year settings
    const yearSettings = await ctx.db.query("productionYearSettings").first();
    
    if (yearSettings) {
      return yearSettings.availableYears.sort((a, b) => b - a); // Sort descending (newest first)
    }
    
    // Fallback: get years from existing batches
    const batches = await ctx.db
      .query("productionBatches")
      .collect();
    
    const years = Array.from(new Set(batches.map(batch => batch.year).filter(Boolean)));
    return years.sort((a, b) => (b || 0) - (a || 0)); // Sort descending (newest first)
  },
});

// Get available fiscal years (fiscal years that have batch data)
export const getAvailableFiscalYears = query({
  args: {},
  handler: async (ctx) => {
    // Get available fiscal years from production year settings
    const yearSettings = await ctx.db.query("productionYearSettings").first();
    
    if (yearSettings && yearSettings.availableFiscalYears) {
      return yearSettings.availableFiscalYears.sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)
    }
    
    // Fallback: get fiscal years from existing batches
    const batches = await ctx.db
      .query("productionBatches")
      .collect();
    
    const fiscalYears = Array.from(new Set(batches.map(batch => batch.fiscalYear).filter(Boolean)));
    return fiscalYears.sort((a, b) => (b || "").localeCompare(a || "")); // Sort descending (newest first)
  },
});

// Get file URL for viewing uploaded files
export const getFileUrl = mutation({
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

// Reset batch numbers for new year (legacy)
export const resetBatchNumbersForNewYear = mutation({
  args: { 
    newYear: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentYear = new Date().getFullYear();
    const newFiscalYear = getFiscalYear(args.newYear);
    
    // Get the highest batch number from current fiscal year
    const yearSettings = await ctx.db.query("productionYearSettings").first();
    const currentFiscalYear = yearSettings?.currentFiscalYear || getFiscalYear(currentYear);
    
    const lastBatch = await ctx.db
      .query("productionBatches")
      .withIndex("by_fiscal_year_and_active", (q) => 
        q.eq("fiscalYear", currentFiscalYear).eq("isActive", true)
      )
      .order("desc")
      .first();

    const previousYearMaxBatch = lastBatch ? lastBatch.batchNumber : 0;

    // Mark all current fiscal year batches as inactive
    const currentYearBatches = await ctx.db
      .query("productionBatches")
      .withIndex("by_fiscal_year_and_active", (q) => 
        q.eq("fiscalYear", currentFiscalYear).eq("isActive", true)
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
      fiscalYear: newFiscalYear,
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
      newFiscalYear,
    };
  },
});

// Reset batch numbers for new fiscal year
export const resetBatchNumbersForNewFiscalYear = mutation({
  args: { 
    newFiscalYear: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isValidFiscalYear(args.newFiscalYear)) {
      throw new Error("Invalid fiscal year format. Expected format: YYYY-YY (e.g., 2025-26)");
    }
    
    const newCalendarYear = getCalendarYearFromFiscal(args.newFiscalYear);
    
    // Get the highest batch number from current fiscal year
    const yearSettings = await ctx.db.query("productionYearSettings").first();
    const currentFiscalYear = yearSettings?.currentFiscalYear || getFiscalYear(new Date().getFullYear());
    
    const lastBatch = await ctx.db
      .query("productionBatches")
      .withIndex("by_fiscal_year_and_active", (q) => 
        q.eq("fiscalYear", currentFiscalYear).eq("isActive", true)
      )
      .order("desc")
      .first();

    const previousYearMaxBatch = lastBatch ? lastBatch.batchNumber : 0;

    // Mark all current fiscal year batches as inactive
    const currentYearBatches = await ctx.db
      .query("productionBatches")
      .withIndex("by_fiscal_year_and_active", (q) => 
        q.eq("fiscalYear", currentFiscalYear).eq("isActive", true)
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
      year: newCalendarYear,
      fiscalYear: args.newFiscalYear,
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
      newFiscalYear: args.newFiscalYear,
    };
  },
});


