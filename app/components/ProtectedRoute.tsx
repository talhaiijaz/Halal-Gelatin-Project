"use client";

import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { api } from "@/convex/_generated/api";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: Array<"admin" | "sales" | "finance" | "operations" | "user">;
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

export default function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const hasRoleRequirement = Array.isArray(requiredRoles) && requiredRoles.length > 0;
  const roleQueryResult = hasRoleRequirement
    ? useQuery(api.users.isUserInRoles, { roles: requiredRoles! })
    : true;

  const showAccessDenied = useMemo(() => {
    if (!hasRoleRequirement) return false;
    if (roleQueryResult === undefined) return false; // loading auth query
    return roleQueryResult === false;
  }, [hasRoleRequirement, roleQueryResult]);

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
