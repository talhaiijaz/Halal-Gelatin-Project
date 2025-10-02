import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireModifyAccess, getCurrentUser } from "./authUtils";

// Get a setting by key
export const get = query({
  args: { key: v.string() },
  returns: v.union(v.object({
    _id: v.id("settings"),
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }), v.null()),
  handler: async (ctx, args) => {
    // Require admin access for settings
    await requireModifyAccess(ctx);
    
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    return setting;
  },
});

// Get monthly shipment limit (with default fallback)
export const getMonthlyShipmentLimit = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    // Require admin access for settings
    await requireModifyAccess(ctx);
    
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "monthlyShipmentLimit"))
      .first();
    
    // Return setting value or default to 150,000 kg
    return setting ? (setting.value as number) : 150000;
  },
});

// List all settings
export const list = query({
  args: { category: v.optional(v.string()) },
  returns: v.array(v.object({
    _id: v.id("settings"),
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    // Require admin access for settings
    await requireModifyAccess(ctx);
    
    if (args.category) {
      return await ctx.db
        .query("settings")
        .withIndex("by_category", (q) => q.eq("category", args.category))
        .collect();
    }
    
    return await ctx.db.query("settings").collect();
  },
});

// Update or create a setting
export const set = mutation({
  args: {
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
  },
  returns: v.id("settings"),
  handler: async (ctx, args) => {
    // Require admin access for settings modification
    await requireModifyAccess(ctx);
    
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (existing) {
      // Update existing setting
      await ctx.db.patch(existing._id, {
        value: args.value,
        description: args.description,
        category: args.category,
        updatedAt: Date.now(),
        updatedBy: args.updatedBy,
      });
      return existing._id;
    } else {
      // Create new setting
      return await ctx.db.insert("settings", {
        key: args.key,
        value: args.value,
        description: args.description,
        category: args.category,
        updatedAt: Date.now(),
        updatedBy: args.updatedBy,
      });
    }
  },
});

// Initialize default settings (can be called from migration)
export const initializeDefaults = mutation({
  args: {},
  returns: v.object({ created: v.number() }),
  handler: async (ctx) => {
    const defaults = [
      {
        key: "monthlyShipmentLimit",
        value: 150000,
        description: "Maximum allowed shipment quantity per month (in kg)",
        category: "shipments",
      },
    ];
    
    let created = 0;
    for (const setting of defaults) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", setting.key))
        .first();
      
      if (!existing) {
        await ctx.db.insert("settings", {
          ...setting,
          updatedAt: Date.now(),
        });
        created++;
      }
    }
    
    return { created };
  },
});

// Update monthly shipment limit specifically
export const setMonthlyShipmentLimit = mutation({
  args: {
    limit: v.number(),
    updatedBy: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // Require admin access for settings modification
    await requireModifyAccess(ctx);
    
    if (args.limit < 0) {
      throw new Error("Monthly shipment limit cannot be negative");
    }
    
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "monthlyShipmentLimit"))
      .first();
    
    if (existing) {
      // Update existing setting
      await ctx.db.patch(existing._id, {
        value: args.limit,
        description: "Maximum allowed shipment quantity per month (in kg)",
        category: "shipments",
        updatedAt: Date.now(),
        updatedBy: args.updatedBy,
      });
    } else {
      // Create new setting
      await ctx.db.insert("settings", {
        key: "monthlyShipmentLimit",
        value: args.limit,
        description: "Maximum allowed shipment quantity per month (in kg)",
        category: "shipments",
        updatedAt: Date.now(),
        updatedBy: args.updatedBy,
      });
    }
    
    return { success: true };
  },
});
