import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Get current user's role
export const getCurrentUserRole = query({
  args: {},
  returns: v.union(v.literal("admin"), v.literal("user"), v.null()),
  handler: async (ctx) => {
    // This will be called from the frontend with the user's Clerk ID
    // For now, we'll return null and handle this in the frontend
    return null;
  },
});

// Check if user has permissions (all users have full permissions)
export const isUserAdmin = query({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // All users have full permissions
    return true;
  },
});

// Create or update user
export const createOrUpdateUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        lastLogin: Date.now(),
      });
      return existingUser._id;
    } else {
      // Create new user with full permissions
      return await ctx.db.insert("users", {
        email: args.email,
        name: args.name,
        role: "admin", // All users have admin permissions
        createdAt: Date.now(),
        lastLogin: Date.now(),
      });
    }
  },
});

// Get all users
export const getAllUsers = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("users"),
    _creationTime: v.number(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    createdAt: v.number(),
    lastLogin: v.optional(v.number()),
  })),
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

// Approval system removed - all users have full permissions

// Approval system removed - all users have full permissions

// Approval system removed - all users have full permissions

// Approval system removed - all users have full permissions

// Sync Clerk user with our database
export const syncClerkUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existingUser) {
      // Update existing user's name and last login
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        lastLogin: Date.now(),
      });
    } else {
      // Create new user with full permissions
      await ctx.db.insert("users", {
        email: args.email,
        name: args.name,
        role: "admin", // All users have admin permissions
        createdAt: Date.now(),
        lastLogin: Date.now(),
      });
    }

    return null;
  },
});
