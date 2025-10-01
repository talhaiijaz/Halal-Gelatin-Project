// Centralized role permission configuration
// This is the single source of truth for all role-based access control

export type Role = "super-admin" | "admin" | "production";

export interface RolePermission {
  canAccess: string[]; // Array of route patterns or "*" for everything
  description: string;
  priority: number; // Higher number = higher priority (admin should be highest)
}

export const rolePermissions: Record<Role, RolePermission> = {
  "super-admin": {
    canAccess: ["*"], // Super-admin can access everything including user management
    description: "Full system access - can view, manage all features and user accounts",
    priority: 200
  },
  admin: {
    canAccess: [
      "/", // Root redirect
      "/home", // Home page accessible to everyone
      "/dashboard", // Dashboard access
      "/clients", "/clients/local", "/clients/international", "/clients/[id]",
      "/orders", "/orders/[id]",
      "/finance", "/finance/reports",
      "/production", "/production/detail", "/production/outsource", 
      "/production/blend", "/production/blends", "/production/blends/[id]", "/production/reader",
      "/shipments", "/deliveries",
      "/logs", "/settings", "/help-center"
      // Note: No /users route - admin cannot access user management
    ],
    description: "Full business access - can manage all features except user accounts",
    priority: 100
  },
  production: {
    canAccess: [
      "/", // Root redirect
      "/home", // Home page accessible to everyone
      "/production",
      "/production/detail",
      "/production/outsource",
      "/production/blend",
      "/production/blends",
      "/production/reader"
    ],
    description: "Production viewing access only - no uploads, deletions, or other pages",
    priority: 30
  }
};

// Helper function to check if a role can access a specific route
export function canAccessRoute(userRole: Role, route: string): boolean {
  const permission = rolePermissions[userRole];
  
  // Admin can access everything
  if (permission.canAccess.includes("*")) {
    return true;
  }
  
  // Check if the route matches any of the allowed patterns
  return permission.canAccess.some(allowedRoute => {
    // Exact match
    if (allowedRoute === route) {
      return true;
    }
    
    // Check if route starts with the allowed pattern (for sub-routes)
    if (route.startsWith(allowedRoute + "/")) {
      return true;
    }
    
    return false;
  });
}

// Helper function to get all accessible routes for a role
export function getAccessibleRoutes(userRole: Role): string[] {
  const permission = rolePermissions[userRole];
  
  if (permission.canAccess.includes("*")) {
    return ["*"]; // Admin has access to everything
  }
  
  return permission.canAccess;
}

// Helper function to check if a role has higher priority than another
export function hasHigherPriority(role1: Role, role2: Role): boolean {
  return rolePermissions[role1].priority > rolePermissions[role2].priority;
}

// Helper function to get role description
export function getRoleDescription(role: Role): string {
  return rolePermissions[role].description;
}

// Helper function to get all roles sorted by priority (highest first)
export function getRolesByPriority(): Role[] {
  return (Object.keys(rolePermissions) as Role[])
    .sort((a, b) => rolePermissions[b].priority - rolePermissions[a].priority);
}
