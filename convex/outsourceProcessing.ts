import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get current outsource processing state
export const getCurrentOutsourceProcessingState = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("outsourceProcessing"),
      _creationTime: v.float64(),
      status: v.union(v.literal("uploading"), v.literal("processing"), v.literal("completed"), v.literal("error")),
      fileName: v.string(),
      progress: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      completedBatches: v.optional(v.array(v.id("outsourceBatches"))),
      createdAt: v.float64(),
      updatedAt: v.float64(),
    })
  ),
  handler: async (ctx) => {
    // Get the most recent processing state
    const states = await ctx.db
      .query("outsourceProcessing")
      .order("desc")
      .take(1);
    
    if (states.length === 0) {
      return null;
    }

    const state = states[0];
    
    // Only return if it's currently processing or uploading
    if (state.status === "uploading" || state.status === "processing") {
      return state;
    }
    
    return null;
  },
});

// Start outsource processing
export const startOutsourceProcessing = mutation({
  args: {
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Clear any existing processing state
    const existingStates = await ctx.db
      .query("outsourceProcessing")
      .order("desc")
      .take(1);
    
    const existingState = existingStates.length > 0 && 
      (existingStates[0].status === "uploading" || existingStates[0].status === "processing") 
      ? existingStates[0] : null;
    
    if (existingState) {
      await ctx.db.delete(existingState._id);
    }
    
    // Create new processing state
    return await ctx.db.insert("outsourceProcessing", {
      fileName: args.fileName,
      status: "uploading",
      progress: "Starting upload...",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update outsource processing state
export const updateOutsourceProcessingState = mutation({
  args: {
    processingId: v.id("outsourceProcessing"),
    status: v.optional(v.union(v.literal("uploading"), v.literal("processing"), v.literal("completed"), v.literal("error"))),
    progress: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    completedBatches: v.optional(v.array(v.id("outsourceBatches"))),
  },
  handler: async (ctx, args) => {
    const { processingId, ...updates } = args;
    const now = Date.now();
    
    return await ctx.db.patch(processingId, {
      ...updates,
      updatedAt: now,
    });
  },
});

// Clear outsource processing state
export const clearOutsourceProcessingState = mutation({
  args: {},
  handler: async (ctx) => {
    const existingStates = await ctx.db
      .query("outsourceProcessing")
      .order("desc")
      .take(1);
    
    const existingState = existingStates.length > 0 && 
      (existingStates[0].status === "uploading" || existingStates[0].status === "processing") 
      ? existingStates[0] : null;
    
    if (existingState) {
      await ctx.db.delete(existingState._id);
    }
    
    return { success: true };
  },
});
