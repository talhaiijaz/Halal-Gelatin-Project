"use client";

import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import { canAccessRoute, type Role } from "@/app/utils/rolePermissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: Array<"super-admin" | "admin" | "production">;
  route?: string; // Optional route path for automatic permission checking
}

function UnauthenticatedContent() {
  const router = useRouter();
  
  useEffect(() => {
    router.push("/login");
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, requiredRoles, route }: ProtectedRouteProps) {
  const router = useRouter();
  const currentUserRole = useQuery(api.users.getCurrentUserRole);
  
  // Use centralized permission system if route is provided, otherwise fall back to requiredRoles
  const hasAccess = useMemo(() => {
    if (!currentUserRole) return false; // Still loading
    
    // If route is provided, use centralized permission system
    if (route) {
      return canAccessRoute(currentUserRole, route);
    }
    
    // Fall back to requiredRoles if no route provided
    if (Array.isArray(requiredRoles) && requiredRoles.length > 0) {
      return requiredRoles.includes(currentUserRole);
    }
    
    // No restrictions
    return true;
  }, [currentUserRole, route, requiredRoles]);

  const showAccessDenied = useMemo(() => {
    if (currentUserRole === undefined) return false; // Still loading
    return !hasAccess;
  }, [currentUserRole, hasAccess]);

  return (
    <>
      <Authenticated>
        {showAccessDenied ? (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-xl">!</span>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Access denied</h1>
              <p className="mt-2 text-gray-600">You don't have permission to view this page.</p>
            </div>
          </div>
        ) : (
          children
        )}
      </Authenticated>
      <Unauthenticated>
        <UnauthenticatedContent />
      </Unauthenticated>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </AuthLoading>
    </>
  );
}
