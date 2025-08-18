import { mutation } from "./_generated/server";

// Generate upload URL for file uploads
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// Get file URL for downloads
export const getFileUrl = mutation({
  handler: async (ctx, { storageId }: { storageId: string }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
