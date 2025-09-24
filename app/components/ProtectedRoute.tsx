"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
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

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();

  return (
    <>
      <Authenticated>
        {children}
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
