import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export type Role = "super-admin" | "admin" | "production";

export class ApiAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiAuthError";
  }
}

// Get current user with role information from API routes
export async function getCurrentUserFromApi() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    throw new ApiAuthError("User not authenticated");
  }

  // Get user role from Convex
  const userRole = await convex.query(api.users.getCurrentUserRole, {});
  
  if (!userRole) {
    // If no role found but user has email in session claims, assume super-admin
    if (sessionClaims?.email) {
      console.log(`User authenticated with email ${sessionClaims.email} but not found in Convex. Assuming super-admin permissions.`);
      return {
        userId,
        role: "super-admin" as const
      };
    }
    
    throw new ApiAuthError(`User not found in database or insufficient permissions. Clerk email: ${sessionClaims?.email}, Clerk userId: ${userId}.`);
  }

  return {
    userId,
    role: userRole
  };
}

// Check if user has required role(s) in API routes
export async function requireApiRole(requiredRoles: Role | Role[]) {
  const user = await getCurrentUserFromApi();
  
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  if (!roles.includes(user.role)) {
    throw new ApiAuthError(`Access denied. Required role: ${roles.join(" or ")}, user role: ${user.role}`);
  }

  return user;
}

// Check if user is admin or super-admin in API routes
export async function requireApiAdmin() {
  return await requireApiRole(["admin", "super-admin"]);
}

// Check if user is super-admin in API routes
export async function requireApiSuperAdmin() {
  return await requireApiRole("super-admin");
}

// Check if user can access production features in API routes
export async function requireApiProductionAccess() {
  return await requireApiRole(["production", "admin", "super-admin"]);
}

// Check if user can modify data in API routes
export async function requireApiModifyAccess() {
  return await requireApiRole(["admin", "super-admin"]);
}

// Check if user can access financial data in API routes
export async function requireApiFinancialAccess() {
  return await requireApiRole(["admin", "super-admin"]);
}

// Check if user can access order management in API routes
export async function requireApiOrderAccess() {
  return await requireApiRole(["admin", "super-admin"]);
}

// Check if user can access client management in API routes
export async function requireApiClientAccess() {
  return await requireApiRole(["admin", "super-admin"]);
}

// Debug function to check API authentication status
export async function debugApiAuth() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        hasClerkAuth: false,
        userId: null,
        userRole: null,
        error: "No Clerk authentication"
      };
    }

    const userRole = await convex.query(api.users.getCurrentUserRole, {});
    return {
      hasClerkAuth: true,
      userId,
      userRole,
      error: null
    };
  } catch (error) {
    return {
      hasClerkAuth: false,
      userId: null,
      userRole: null,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
