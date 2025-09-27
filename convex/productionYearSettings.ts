import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get current production year settings
export const getCurrentYearSettings = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("productionYearSettings"),
      _creationTime: v.float64(),
      currentYear: v.number(),
      availableYears: v.array(v.number()),
      createdAt: v.float64(),
      updatedAt: v.float64(),
    })
  ),
  handler: async (ctx) => {
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
    availableYears: v.array(v.number()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  }),
  handler: async (ctx) => {
    const currentYear = new Date().getFullYear();
    const settingsId = await ctx.db.insert("productionYearSettings", {
      currentYear,
      availableYears: [currentYear],
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

// Set current production year
export const setCurrentYear = mutation({
  args: {
    year: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("productionYearSettings").first();
    
    if (!settings) {
      // Create new settings if none exist
      await ctx.db.insert("productionYearSettings", {
        currentYear: args.year,
        availableYears: [args.year],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      // Update existing settings
      await ctx.db.patch(settings._id, {
        currentYear: args.year,
        updatedAt: Date.now(),
      });
    }
    
    return {
      success: true,
      message: `Production year set to ${args.year}`,
    };
  },
});

// Add new year to available years
export const addNewYear = mutation({
  args: {
    year: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("productionYearSettings").first();
    
    if (!settings) {
      // Create new settings with the new year
      await ctx.db.insert("productionYearSettings", {
        currentYear: args.year,
        availableYears: [args.year],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      // Check if year already exists
      if (settings.availableYears.includes(args.year)) {
        return {
          success: false,
          message: `Year ${args.year} already exists`,
        };
      }
      
      // Add new year to available years
      const updatedYears = [...settings.availableYears, args.year].sort((a, b) => b - a); // Sort descending
      
      await ctx.db.patch(settings._id, {
        availableYears: updatedYears,
        updatedAt: Date.now(),
      });
    }
    
    return {
      success: true,
      message: `Year ${args.year} added successfully`,
    };
  },
});

// Get available years for dropdown
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

// Get current active year
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
