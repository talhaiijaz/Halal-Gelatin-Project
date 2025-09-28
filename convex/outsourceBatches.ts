import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

// Get all outsource batches with pagination
export const getAllOutsourceBatches = query({
  args: { 
    paginationOpts: paginationOptsValidator,
    fiscalYear: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const fiscalYear = args.fiscalYear || "2025-26";
    return await ctx.db
      .query("outsourceBatches")
      .withIndex("by_fiscal_year_and_active", (q) => q.eq("fiscalYear", fiscalYear).eq("isActive", true))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// Get current year info for outsource batches
export const getCurrentYearInfo = query({
  args: {},
  handler: async (ctx) => {
    // Get the current year info from production year settings
    const yearSettings = await ctx.db
      .query("productionYearSettings")
      .first();
    
    return {
      currentYear: yearSettings?.currentYear || new Date().getFullYear(),
      currentFiscalYear: yearSettings?.currentFiscalYear || "2025-26",
      availableYears: yearSettings?.availableYears || [],
      availableFiscalYears: yearSettings?.availableFiscalYears || ["2025-26"],
    };
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
      serialNumber: args.serialNumber,
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
    serialNumber: v.optional(v.string()),
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

// Delete multiple outsource batches by IDs
export const deleteMultipleBatches = mutation({
  args: { batchIds: v.array(v.id("outsourceBatches")) },
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
      } catch (error) {
        const errorMessage = `Failed to delete batch ${batchId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }
    
    if (errors.length > 0) {
      console.warn(`Some batches could not be deleted:`, errors);
    }
    
    return deletedCount;
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

// Create outsource batches from extracted PDF data
export const createOutsourceBatchesFromExtractedData = mutation({
  args: {
    extractedData: v.string(),
    sourceReport: v.string(),
    reportDate: v.number(),
    processingId: v.optional(v.id("outsourceProcessing")),
    fileId: v.optional(v.id("_storage")),
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

      const now = Date.now();
      const fiscalYear = "2025-26"; // Current fiscal year
      const currentYear = new Date().getFullYear();

      // Get the next batch number to start from for current fiscal year
      const lastBatch = await ctx.db
        .query("outsourceBatches")
        .withIndex("by_fiscal_year_and_active", (q) => 
          q.eq("fiscalYear", fiscalYear).eq("isActive", true)
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
            .query("outsourceBatches")
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
            year: currentYear,
            fiscalYear: fiscalYear,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          };

          console.log(`Creating batch with data:`, batchData);

          const batchId = await ctx.db.insert("outsourceBatches", batchData);
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


// Get file URL for outsource batch
export const getOutsourceFileUrl = mutation({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.fileId);
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
