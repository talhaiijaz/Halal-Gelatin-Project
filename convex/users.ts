import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Get current user's role
export const getCurrentUserRole = query({
  args: {},
  returns: v.union(v.literal("super-admin"), v.literal("admin"), v.literal("production"), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .unique();

    return user?.role ?? null;
  },
});

// Check if the current user is in any of the required roles
export const isUserInRoles = query({
  args: {
        roles: v.array(v.union(
          v.literal("super-admin"),
          v.literal("admin"),
          v.literal("production")
        )),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) return false;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .unique();

    if (!user) return false;
    return args.roles.includes(user.role);
  },
});

// Check if user has permissions (all users have full permissions)
export const isUserAdmin = query({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Deprecated: prefer isUserInRoles/getCurrentUserRole. Keep returning true for now.
    return true;
  },
});

// Check if user exists and update last login (for authentication)
export const checkUserAccess = mutation({
  args: {
    email: v.string(),
    name: v.string(),
  },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    // Check if user exists in database
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existingUser) {
      // Update last login time
      await ctx.db.patch(existingUser._id, {
        name: args.name, // Update name in case it changed in Clerk
        lastLogin: Date.now(),
      });
      return existingUser._id;
    } else {
      // User not found in database - access denied
      return null;
    }
  },
});

// Create or update user (for manual user management)
export const createOrUpdateUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.optional(v.union(v.literal("super-admin"), v.literal("admin"), v.literal("production"))),
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
        role: args.role || existingUser.role,
        lastLogin: Date.now(),
      });
      return existingUser._id;
    } else {
      // Create new user (only for manual user management)
      return await ctx.db.insert("users", {
        email: args.email,
        name: args.name,
            role: args.role || "production", // Default to production role for manual creation
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
        role: v.union(v.literal("super-admin"), v.literal("admin"), v.literal("production")),
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


