import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { 
  getCurrentUser, 
  getCurrentUserGraceful,
  requireSuperAdmin, 
  requireUserManagementAccess,
  validateRoleChange,
  type Role 
} from "./authUtils";

// Get current user's role
export const getCurrentUserRole = query({
  args: {},
  returns: v.union(v.literal("super-admin"), v.literal("admin"), v.literal("production"), v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUserGraceful(ctx);
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
    const user = await getCurrentUserGraceful(ctx);
    if (!user) return false;
    return args.roles.includes(user.role);
  },
});

// Check if user has admin permissions
export const isUserAdmin = query({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    try {
      const currentUser = await getCurrentUser(ctx);
      return ["admin", "super-admin"].includes(currentUser.role);
    } catch {
      return false;
    }
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
    // Require authenticated identity; will throw if unauthenticated
    const current = await getCurrentUser(ctx);

    // Ensure the provided email matches the authenticated user's email
    if (current.email?.toLowerCase() !== args.email.toLowerCase()) {
      return null;
    }

    // Check if user exists in database
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existingUser) {
      // Update last login time
      await ctx.db.patch(existingUser._id, {
        // For safety, prefer the authenticated name rather than client-provided
        name: args.name || existingUser.name,
        lastLogin: Date.now(),
      });
      return existingUser._id;
    } else {
      // User not found in database - access denied
      return null;
    }
  },
});

// Create or update user (for manual user management) - SUPER-ADMIN ONLY
export const createOrUpdateUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.optional(v.union(v.literal("super-admin"), v.literal("admin"), v.literal("production"))),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Require super-admin access for user management
    const currentUser = await requireUserManagementAccess(ctx);
    
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    const targetRole = args.role || "production";
    const targetUserId = existingUser?._id || "new";

    // Validate role change permissions
    validateRoleChange(currentUser.role, targetRole, targetUserId, currentUser.id);

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        role: targetRole,
        lastLogin: Date.now(),
      });
      return existingUser._id;
    } else {
      // Create new user (only for manual user management)
      return await ctx.db.insert("users", {
        email: args.email,
        name: args.name,
        role: targetRole,
        createdAt: Date.now(),
        lastLogin: Date.now(),
      });
    }
  },
});

// Get all users - SUPER-ADMIN ONLY
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
    // Require super-admin access to view all users
    await requireUserManagementAccess(ctx);
    return await ctx.db.query("users").collect();
  },
});

// Debug function to check authentication status - for troubleshooting
export const debugAuth = query({
  args: {},
  returns: v.object({
    hasIdentity: v.boolean(),
    email: v.optional(v.string()),
    normalizedEmail: v.optional(v.string()),
    userFound: v.boolean(),
    userRole: v.optional(v.union(v.literal("super-admin"), v.literal("admin"), v.literal("production"))),
    allUserEmails: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const hasIdentity = !!identity?.email;
    const email = identity?.email;
    const normalizedEmail = email?.toLowerCase();
    
    let userFound = false;
    let userRole = null;
    
    if (email) {
      try {
        const user = await getCurrentUserGraceful(ctx);
        userFound = !!user;
        userRole = user?.role;
      } catch {
        userFound = false;
      }
    }
    
    const allUsers = await ctx.db.query("users").collect();
    const allUserEmails = allUsers.map(u => u.email);
    
    return {
      hasIdentity,
      email,
      normalizedEmail,
      userFound,
      userRole: userRole || undefined,
      allUserEmails,
    };
  },
});

// Internal function to create a user directly (for debugging)
export const createUserDirectly = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("super-admin"), v.literal("admin"), v.literal("production")),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existingUser) {
      return existingUser._id;
    }

    // Create new user
    return await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      role: args.role,
      createdAt: Date.now(),
      lastLogin: Date.now(),
    });
  },
});

// Approval system removed - all users have full permissions

// Approval system removed - all users have full permissions

// Approval system removed - all users have full permissions

// Approval system removed - all users have full permissions


