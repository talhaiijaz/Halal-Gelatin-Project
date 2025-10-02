import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Start processing state
export const startProcessing = mutation({
  args: {
    fileName: v.string(),
  },
  returns: v.id("productionProcessing"),
  handler: async (ctx, args) => {
    // Clear any existing processing states first
    const existingStates = await ctx.db
      .query("productionProcessing")
      .withIndex("by_status", (q) => q.eq("status", "uploading"))
      .collect();
    
    for (const state of existingStates) {
      await ctx.db.delete(state._id);
    }

    const processingStates = await ctx.db
      .query("productionProcessing")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();
    
    for (const state of processingStates) {
      await ctx.db.delete(state._id);
    }

    // Create new processing state
    return await ctx.db.insert("productionProcessing", {
      status: "uploading",
      fileName: args.fileName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Update processing state
export const updateProcessingState = mutation({
  args: {
    processingId: v.id("productionProcessing"),
    status: v.union(v.literal("uploading"), v.literal("processing"), v.literal("completed"), v.literal("error")),
    progress: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    completedBatches: v.optional(v.array(v.id("productionBatches"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.processingId, {
      status: args.status,
      progress: args.progress,
      errorMessage: args.errorMessage,
      completedBatches: args.completedBatches,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Get current processing state
export const getCurrentProcessingState = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("productionProcessing"),
      _creationTime: v.float64(),
      status: v.union(v.literal("uploading"), v.literal("processing"), v.literal("completed"), v.literal("error")),
      fileName: v.string(),
      progress: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      completedBatches: v.optional(v.array(v.id("productionBatches"))),
      createdAt: v.float64(),
      updatedAt: v.float64(),
    })
  ),
  handler: async (ctx) => {
    // Get the most recent processing state
    const states = await ctx.db
      .query("productionProcessing")
      .order("desc")
      .take(1);
    
    if (states.length === 0) {
      return null;
    }

    const state = states[0];
    
    // If it's completed or error, only return it if it's recent (within last 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    if ((state.status === "completed" || state.status === "error") && state.updatedAt < fiveMinutesAgo) {
      return null;
    }

    return state;
  },
});

// Clear processing state
export const clearProcessingState = mutation({
  args: {
    processingId: v.id("productionProcessing"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.processingId);
    return null;
  },
});

