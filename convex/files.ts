import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireProductionAccess, getCurrentUser } from "./authUtils";

// Generate upload URL for file uploads
export const generateUploadUrl = mutation(async (ctx) => {
  // Require production access for file uploads
  await requireProductionAccess(ctx);
  return await ctx.storage.generateUploadUrl();
});

