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
    const now = Date.now();
    const fiscalYear = "2025-26"; // Current fiscal year

    // Get the next batch number
    const existingBatches = await ctx.db
      .query("outsourceBatches")
      .withIndex("by_fiscal_year_and_active", (q) => q.eq("fiscalYear", fiscalYear).eq("isActive", true))
      .collect();

    let nextBatchNumber = 1;
    if (existingBatches.length > 0) {
      const maxBatchNumber = Math.max(...existingBatches.map(batch => batch.batchNumber));
      nextBatchNumber = maxBatchNumber + 1;
    }

    // Parse the extracted data (similar to production batches)
    const lines = args.extractedData.split('\n').filter(line => line.trim());
    const createdBatches: any[] = [];
    const skippedBatches: Array<{batchNumber: number; reason: string}> = [];
    let currentBatchNumber = nextBatchNumber;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Try to extract batch data from the line
      // This is a simplified parser - you might need to adjust based on your PDF format
      const batchData = parseOutsourceBatchLine(trimmedLine);
      
      if (batchData) {
        try {
          const batchId = await ctx.db.insert("outsourceBatches", {
            batchNumber: currentBatchNumber,
            serialNumber: batchData.serialNumber || `OUT-${currentBatchNumber}`,
            viscosity: batchData.viscosity,
            bloom: batchData.bloom,
            percentage: batchData.percentage,
            ph: batchData.ph,
            conductivity: batchData.conductivity,
            moisture: batchData.moisture,
            h2o2: batchData.h2o2,
            so2: batchData.so2,
            color: batchData.color,
            clarity: batchData.clarity,
            odour: batchData.odour,
            sourceReport: args.sourceReport,
            reportDate: args.reportDate,
            fileId: args.fileId,
            isUsed: false,
            year: new Date().getFullYear(),
            fiscalYear,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });

          createdBatches.push({ batchId, batchNumber: currentBatchNumber });
          currentBatchNumber++;
        } catch (error) {
          console.error(`Error creating batch ${currentBatchNumber}:`, error);
          skippedBatches.push({
            batchNumber: currentBatchNumber,
            reason: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          currentBatchNumber++;
        }
      } else {
        skippedBatches.push({
          batchNumber: currentBatchNumber,
          reason: "Could not parse batch data from line"
        });
        currentBatchNumber++;
      }
    }

    return {
      createdCount: createdBatches.length,
      skippedCount: skippedBatches.length,
      summary: `Created ${createdBatches.length} outsource batches, skipped ${skippedBatches.length}`,
      skippedBatches,
      extractedLinesCount: lines.length,
    };
  },
});

// Helper function to parse batch data from a line (similar to production batches)
function parseOutsourceBatchLine(line: string): any {
  // This uses the same parsing logic as production batches
  // The AI extraction should work the same way for both
  
  const batchData: any = {};
  
  // Extract serial number (this is the key field, same as production)
  const serialMatch = line.match(/(?:serial|sr|batch)[:\s#]*([A-Za-z0-9\-_]+)/i);
  if (serialMatch) {
    batchData.serialNumber = serialMatch[1].trim();
  }

  // Extract bloom
  const bloomMatch = line.match(/bloom[:\s]+(\d+(?:\.\d+)?)/i);
  if (bloomMatch) {
    batchData.bloom = parseFloat(bloomMatch[1]);
  }

  // Extract viscosity
  const viscosityMatch = line.match(/viscosity[:\s]+(\d+(?:\.\d+)?)/i);
  if (viscosityMatch) {
    batchData.viscosity = parseFloat(viscosityMatch[1]);
  }

  // Extract pH
  const phMatch = line.match(/ph[:\s]+(\d+(?:\.\d+)?)/i);
  if (phMatch) {
    batchData.ph = parseFloat(phMatch[1]);
  }

  // Extract percentage
  const percentageMatch = line.match(/percentage[:\s]+(\d+(?:\.\d+)?)/i);
  if (percentageMatch) {
    batchData.percentage = parseFloat(percentageMatch[1]);
  }

  // Extract conductivity
  const conductivityMatch = line.match(/conductivity[:\s]+(\d+(?:\.\d+)?)/i);
  if (conductivityMatch) {
    batchData.conductivity = parseFloat(conductivityMatch[1]);
  }

  // Extract moisture
  const moistureMatch = line.match(/moisture[:\s]+(\d+(?:\.\d+)?)/i);
  if (moistureMatch) {
    batchData.moisture = parseFloat(moistureMatch[1]);
  }

  // Extract H2O2
  const h2o2Match = line.match(/h2o2[:\s]+(\d+(?:\.\d+)?)/i);
  if (h2o2Match) {
    batchData.h2o2 = parseFloat(h2o2Match[1]);
  }

  // Extract SO2
  const so2Match = line.match(/so2[:\s]+(\d+(?:\.\d+)?)/i);
  if (so2Match) {
    batchData.so2 = parseFloat(so2Match[1]);
  }

  // Extract color
  const colorMatch = line.match(/color[:\s]+([^,]+)/i);
  if (colorMatch) {
    batchData.color = colorMatch[1].trim();
  }

  // Extract clarity
  const clarityMatch = line.match(/clarity[:\s]+([^,]+)/i);
  if (clarityMatch) {
    batchData.clarity = clarityMatch[1].trim();
  }

  // Extract odour
  const odourMatch = line.match(/odour[:\s]+([^,]+)/i);
  if (odourMatch) {
    batchData.odour = odourMatch[1].trim();
  }

  // Return batch data if we found at least one quality parameter
  const hasQualityData = batchData.bloom || batchData.viscosity || batchData.ph || 
                        batchData.percentage || batchData.conductivity || batchData.moisture ||
                        batchData.h2o2 || batchData.so2 || batchData.color || 
                        batchData.clarity || batchData.odour;

  return hasQualityData ? batchData : null;
}

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
