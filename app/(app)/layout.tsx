"use client";

import Sidebar from "@/app/components/Sidebar";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { useScrollRestoration } from "@/app/hooks/useScrollRestoration";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize global, path-aware scroll restoration
  useScrollRestoration();

  return (
    <ProtectedRoute requiredRoles={["production", "admin", "super-admin"]}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        
        {/* Main content area */}
        <div className="lg:pl-64">
          {/* Mobile top padding accounts for header + safe areas */}
          <div className="pt-safe-header lg:pt-0">
            <main className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-safe-area">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
