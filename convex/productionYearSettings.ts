import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getFiscalYear, getNextFiscalYear, getCurrentFiscalYear, isValidFiscalYear } from "./fiscalYearUtils";
import { requireProductionAccess } from "./authUtils";

// Get current production year settings
export const getCurrentYearSettings = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("productionYearSettings"),
      _creationTime: v.float64(),
      currentYear: v.number(),
      currentFiscalYear: v.optional(v.string()),
      availableYears: v.array(v.number()),
      availableFiscalYears: v.optional(v.array(v.string())),
      createdAt: v.float64(),
      updatedAt: v.float64(),
    })
  ),
  handler: async (ctx) => {
    // Require production access
    await requireProductionAccess(ctx);
    
    // Get the first (and only) settings record
    const settings = await ctx.db.query("productionYearSettings").first();
    return settings;
  },
});

// Initialize production year settings if they don't exist
export const initializeYearSettings = mutation({
  args: {},
  returns: v.object({
    _id: v.id("productionYearSettings"),
    _creationTime: v.float64(),
    currentYear: v.number(),
    currentFiscalYear: v.optional(v.string()),
    availableYears: v.array(v.number()),
    availableFiscalYears: v.optional(v.array(v.string())),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  }),
  handler: async (ctx) => {
    // Require production access
    await requireProductionAccess(ctx);
    
    const currentYear = new Date().getFullYear();
    const currentFiscalYear = getFiscalYear(currentYear);
    const settingsId = await ctx.db.insert("productionYearSettings", {
      currentYear,
      currentFiscalYear,
      availableYears: [currentYear],
      availableFiscalYears: [currentFiscalYear],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    const settings = await ctx.db.get(settingsId);
    if (!settings) {
      throw new Error("Failed to create year settings");
    }
    
    return settings;
  },
});

// Set current production year (legacy - for backward compatibility)
export const setCurrentYear = mutation({
  args: {
    year: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Require production access
    await requireProductionAccess(ctx);
    
    const fiscalYear = getFiscalYear(args.year);
    const settings = await ctx.db.query("productionYearSettings").first();
    
    if (!settings) {
      // Create new settings if none exist
      await ctx.db.insert("productionYearSettings", {
        currentYear: args.year,
        currentFiscalYear: fiscalYear,
        availableYears: [args.year],
        availableFiscalYears: [fiscalYear],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      // Update existing settings
      await ctx.db.patch(settings._id, {
        currentYear: args.year,
        currentFiscalYear: fiscalYear,
        updatedAt: Date.now(),
      });
    }
    
    return {
      success: true,
      message: `Production year set to ${fiscalYear}`,
    };
  },
});

// Set current fiscal year
export const setCurrentFiscalYear = mutation({
  args: {
    fiscalYear: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!isValidFiscalYear(args.fiscalYear)) {
      return {
        success: false,
        message: "Invalid fiscal year format. Expected format: YYYY-YY (e.g., 2025-26)",
      };
    }
    
    const calendarYear = parseInt(args.fiscalYear.split('-')[0]);
    const settings = await ctx.db.query("productionYearSettings").first();
    
    if (!settings) {
      // Create new settings if none exist
      await ctx.db.insert("productionYearSettings", {
        currentYear: calendarYear,
        currentFiscalYear: args.fiscalYear,
        availableYears: [calendarYear],
        availableFiscalYears: [args.fiscalYear],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      // Update existing settings
      await ctx.db.patch(settings._id, {
        currentYear: calendarYear,
        currentFiscalYear: args.fiscalYear,
        updatedAt: Date.now(),
      });
    }
    
    return {
      success: true,
      message: `Production fiscal year set to ${args.fiscalYear}`,
    };
  },
});

// Add new year to available years (legacy - for backward compatibility)
export const addNewYear = mutation({
  args: {
    year: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const fiscalYear = getFiscalYear(args.year);
    const settings = await ctx.db.query("productionYearSettings").first();
    
    if (!settings) {
      // Create new settings with the new year
      await ctx.db.insert("productionYearSettings", {
        currentYear: args.year,
        currentFiscalYear: fiscalYear,
        availableYears: [args.year],
        availableFiscalYears: [fiscalYear],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      // Check if year already exists
      if (settings.availableYears.includes(args.year)) {
        return {
          success: false,
          message: `Year ${fiscalYear} already exists`,
        };
      }
      
      // Add new year to available years
      const updatedYears = [...settings.availableYears, args.year].sort((a, b) => b - a); // Sort descending
      const updatedFiscalYears = [...(settings.availableFiscalYears || []), fiscalYear].sort((a, b) => b.localeCompare(a)); // Sort descending
      
      await ctx.db.patch(settings._id, {
        availableYears: updatedYears,
        availableFiscalYears: updatedFiscalYears,
        updatedAt: Date.now(),
      });
    }
    
    return {
      success: true,
      message: `Fiscal year ${fiscalYear} added successfully`,
    };
  },
});

// Add new fiscal year to available years
export const addNewFiscalYear = mutation({
  args: {
    fiscalYear: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!isValidFiscalYear(args.fiscalYear)) {
      return {
        success: false,
        message: "Invalid fiscal year format. Expected format: YYYY-YY (e.g., 2025-26)",
      };
    }
    
    const calendarYear = parseInt(args.fiscalYear.split('-')[0]);
    const settings = await ctx.db.query("productionYearSettings").first();
    
    if (!settings) {
      // Create new settings with the new fiscal year
      await ctx.db.insert("productionYearSettings", {
        currentYear: calendarYear,
        currentFiscalYear: args.fiscalYear,
        availableYears: [calendarYear],
        availableFiscalYears: [args.fiscalYear],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      // Check if fiscal year already exists
      if (settings.availableFiscalYears?.includes(args.fiscalYear)) {
        return {
          success: false,
          message: `Fiscal year ${args.fiscalYear} already exists`,
        };
      }
      
      // Add new fiscal year to available years
      const updatedYears = [...settings.availableYears, calendarYear].sort((a, b) => b - a); // Sort descending
      const updatedFiscalYears = [...(settings.availableFiscalYears || []), args.fiscalYear].sort((a, b) => b.localeCompare(a)); // Sort descending
      
      await ctx.db.patch(settings._id, {
        availableYears: updatedYears,
        availableFiscalYears: updatedFiscalYears,
        updatedAt: Date.now(),
      });
    }
    
    return {
      success: true,
      message: `Fiscal year ${args.fiscalYear} added successfully`,
    };
  },
});

// Get available years for dropdown (legacy - for backward compatibility)
export const getAvailableYears = query({
  args: {},
  returns: v.array(v.number()),
  handler: async (ctx) => {
    const settings = await ctx.db.query("productionYearSettings").first();
    
    if (!settings) {
      // Return current year if no settings exist
      return [new Date().getFullYear()];
    }
    
    return settings.availableYears.sort((a, b) => b - a); // Sort descending (newest first)
  },
});

// Get available fiscal years for dropdown
export const getAvailableFiscalYears = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const settings = await ctx.db.query("productionYearSettings").first();
    
    if (!settings) {
      // Return current fiscal year if no settings exist
      return [getCurrentFiscalYear()];
    }
    
    return (settings.availableFiscalYears || [getCurrentFiscalYear()]).sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)
  },
});

// Get current active year (legacy - for backward compatibility)
export const getCurrentYear = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const settings = await ctx.db.query("productionYearSettings").first();
    
    if (!settings) {
      // Return current year if no settings exist
      return new Date().getFullYear();
    }
    
    return settings.currentYear;
  },
});

// Get current active fiscal year
export const getCurrentFiscalYearSetting = query({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const settings = await ctx.db.query("productionYearSettings").first();
    
    if (!settings) {
      // Return current fiscal year if no settings exist
      return getCurrentFiscalYear();
    }
    
    return settings.currentFiscalYear || getCurrentFiscalYear();
  },
});
