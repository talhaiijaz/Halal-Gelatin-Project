import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Generate upload URL for file uploads
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

