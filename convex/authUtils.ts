import { QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

export type Role = "super-admin" | "admin" | "production";

// Authentication and authorization utilities for Convex functions
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

// Get current user with role information
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) {
    throw new AuthError("User not authenticated");
  }

  // Use case-insensitive email comparison
  const normalizedEmail = identity.email.toLowerCase();
  
  // First try exact match with original email
  let user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", identity.email!))
    .unique();

  // If not found, try with lowercase email
  if (!user) {
    user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();
  }

  // If still not found, search through all users for case-insensitive match
  if (!user) {
    const allUsers = await ctx.db.query("users").collect();
    user = allUsers.find(u => u.email.toLowerCase() === normalizedEmail) || null;
  }

  if (!user) {
    // Provide more detailed error information for debugging
    const allUsers = await ctx.db.query("users").collect();
    const userEmails = allUsers.map(u => u.email);
    throw new AuthError(`User not found in database. Looking for: "${identity.email}" (normalized: "${normalizedEmail}"). Available users: ${userEmails.join(", ")}`);
  }

  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    identity
  };
}

// Get current user with role information - graceful version that returns null instead of throwing
export async function getCurrentUserGraceful(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) {
    return null;
  }

  // Use case-insensitive email comparison
  const normalizedEmail = identity.email.toLowerCase();
  
  // First try exact match with original email
  let user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", identity.email!))
    .unique();

  // If not found, try with lowercase email
  if (!user) {
    user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();
  }

  // If still not found, search through all users for case-insensitive match
  if (!user) {
    const allUsers = await ctx.db.query("users").collect();
    user = allUsers.find(u => u.email.toLowerCase() === normalizedEmail) || null;
  }

  if (!user) {
    return null;
  }

  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    identity
  };
}

// Check if user has required role(s)
export async function requireRole(
  ctx: QueryCtx | MutationCtx, 
  requiredRoles: Role | Role[]
): Promise<{ id: string; email: string; name: string; role: Role; identity: any }> {
  const user = await getCurrentUser(ctx);
  
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  if (!roles.includes(user.role)) {
    throw new AuthError(`Access denied. Required role: ${roles.join(" or ")}, user role: ${user.role}`);
  }

  return user;
}

// Check if user is super-admin
export async function requireSuperAdmin(ctx: QueryCtx | MutationCtx) {
  return await requireRole(ctx, "super-admin");
}

// Check if user is admin or super-admin
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  return await requireRole(ctx, ["admin", "super-admin"]);
}

// Check if user can access production features
export async function requireProductionAccess(ctx: QueryCtx | MutationCtx) {
  return await requireRole(ctx, ["production", "admin", "super-admin"]);
}

// Check if user can access production features - graceful version
export async function requireProductionAccessGraceful(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserGraceful(ctx);
  if (!user) {
    throw new AuthError("User not authenticated or not found in database");
  }
  
  const allowedRoles = ["production", "admin", "super-admin"];
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError(`Access denied. Required role: ${allowedRoles.join(" or ")}, user role: ${user.role}`);
  }

  return user;
}

// Check if user can modify data (admin or super-admin only)
export async function requireModifyAccess(ctx: QueryCtx | MutationCtx) {
  return await requireRole(ctx, ["admin", "super-admin"]);
}

// Validate that a user cannot escalate their own role
export function validateRoleChange(currentUserRole: Role, targetRole: Role, targetUserId: string, currentUserId: string) {
  // Users cannot change their own role
  if (currentUserId === targetUserId) {
    throw new AuthError("Users cannot modify their own role");
  }

  // Only super-admin can assign super-admin role
  if (targetRole === "super-admin" && currentUserRole !== "super-admin") {
    throw new AuthError("Only super-admin can assign super-admin role");
  }

  // Only super-admin and admin can assign admin role
  if (targetRole === "admin" && !["super-admin", "admin"].includes(currentUserRole)) {
    throw new AuthError("Only super-admin or admin can assign admin role");
  }

  // Super-admin can assign any role
  if (currentUserRole === "super-admin") {
    return true;
  }

  // Admin can only assign production role
  if (currentUserRole === "admin" && targetRole !== "production") {
    throw new AuthError("Admin can only assign production role");
  }

  return true;
}

// Role hierarchy validation
export function hasHigherRole(role1: Role, role2: Role): boolean {
  const hierarchy = { "super-admin": 3, "admin": 2, "production": 1 };
  return hierarchy[role1] > hierarchy[role2];
}

// Check if user can access user management
export async function requireUserManagementAccess(ctx: QueryCtx | MutationCtx) {
  return await requireSuperAdmin(ctx);
}

// Check if user can access financial data
export async function requireFinancialAccess(ctx: QueryCtx | MutationCtx) {
  return await requireRole(ctx, ["admin", "super-admin"]);
}

// Check if user can access order management
export async function requireOrderAccess(ctx: QueryCtx | MutationCtx) {
  return await requireRole(ctx, ["admin", "super-admin"]);
}

// Check if user can access client management
export async function requireClientAccess(ctx: QueryCtx | MutationCtx) {
  return await requireRole(ctx, ["admin", "super-admin"]);
}
