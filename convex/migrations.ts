// convex/migrations.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getFiscalYear } from "./fiscalYearUtils";

// Migration to update existing 2025 batches to use fiscal year format
export const migrateToFiscalYear = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting migration to fiscal year format...");
    
    // 1. Update production year settings
    const yearSettings = await ctx.db.query("productionYearSettings").first();
    if (yearSettings) {
      const currentFiscalYear = getFiscalYear(yearSettings.currentYear);
      const availableFiscalYears = yearSettings.availableYears.map(year => getFiscalYear(year));
      
      await ctx.db.patch(yearSettings._id, {
        currentFiscalYear,
        availableFiscalYears,
        updatedAt: Date.now(),
      });
      
      console.log(`Updated year settings: ${yearSettings.currentYear} -> ${currentFiscalYear}`);
    } else {
      // Create new settings if none exist
      const currentYear = new Date().getFullYear();
      const currentFiscalYear = getFiscalYear(currentYear);
      
      await ctx.db.insert("productionYearSettings", {
        currentYear,
        currentFiscalYear,
        availableYears: [currentYear],
        availableFiscalYears: [currentFiscalYear],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      console.log(`Created new year settings: ${currentFiscalYear}`);
    }
    
    // 2. Update all existing batches to include fiscal year
    const batches = await ctx.db.query("productionBatches").collect();
    let updatedBatches = 0;
    
    for (const batch of batches) {
      if (!batch.fiscalYear && batch.year) {
        const fiscalYear = getFiscalYear(batch.year);
        await ctx.db.patch(batch._id, {
          fiscalYear,
          updatedAt: Date.now(),
        });
        updatedBatches++;
      }
    }
    
    console.log(`Updated ${updatedBatches} batches with fiscal year information`);
    
    // 3. Update batch reset records
    const resetRecords = await ctx.db.query("batchResetRecords").collect();
    let updatedRecords = 0;
    
    for (const record of resetRecords) {
      if (!record.fiscalYear && record.year) {
        const fiscalYear = getFiscalYear(record.year);
        await ctx.db.patch(record._id, {
          fiscalYear,
        });
        updatedRecords++;
      }
    }
    
    console.log(`Updated ${updatedRecords} reset records with fiscal year information`);
    
    return {
      success: true,
      message: `Migration completed successfully. Updated ${updatedBatches} batches and ${updatedRecords} reset records.`,
      updatedBatches,
      updatedRecords,
    };
  },
});

// Query to check migration status
export const getMigrationStatus = query({
  args: {},
  handler: async (ctx) => {
    const yearSettings = await ctx.db.query("productionYearSettings").first();
    const batches = await ctx.db.query("productionBatches").collect();
    const resetRecords = await ctx.db.query("batchResetRecords").collect();
    
    const batchesWithoutFiscalYear = batches.filter(batch => !batch.fiscalYear && batch.year).length;
    const recordsWithoutFiscalYear = resetRecords.filter(record => !record.fiscalYear && record.year).length;
    
    return {
      yearSettingsHasFiscalYear: !!yearSettings?.currentFiscalYear,
      totalBatches: batches.length,
      batchesWithoutFiscalYear,
      totalResetRecords: resetRecords.length,
      recordsWithoutFiscalYear,
      needsMigration: batchesWithoutFiscalYear > 0 || recordsWithoutFiscalYear > 0 || !yearSettings?.currentFiscalYear,
    };
  },
});