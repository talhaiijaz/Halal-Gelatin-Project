import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Submit new feedback
export const submitFeedback = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("bug_report"),
      v.literal("feature_request"),
      v.literal("improvement"),
      v.literal("general_feedback")
    ),
    submittedBy: v.string(),
  },
  returns: v.id("feedback"),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    return await ctx.db.insert("feedback", {
      title: args.title,
      description: args.description,
      category: args.category,
      priority: "medium", // Default priority
      status: "pending", // Default status
      submittedBy: args.submittedBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get all feedback
export const getAllFeedback = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("feedback"),
    _creationTime: v.number(),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    priority: v.string(),
    status: v.string(),
    submittedBy: v.string(),
    adminNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    // Get all feedback ordered by creation date (newest first)
    const feedback = await ctx.db
      .query("feedback")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    
    return feedback.map(item => ({
      _id: item._id,
      _creationTime: item._creationTime,
      title: item.title,
      description: item.description,
      category: item.category,
      priority: item.priority,
      status: item.status,
      submittedBy: item.submittedBy,
      adminNotes: item.adminNotes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  },
});


// Delete feedback
export const deleteFeedback = mutation({
  args: {
    feedbackId: v.id("feedback"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }
    
    await ctx.db.delete(args.feedbackId);
    return null;
  },
});
