"use client";

import Sidebar from "@/app/components/Sidebar";
import ProtectedRoute from "@/app/components/ProtectedRoute";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        
        {/* Main content area */}
        <div className="lg:pl-64">
          {/* Mobile top padding to account for mobile header */}
                  <div className="pt-16 lg:pt-0">
          <main className="p-3 sm:p-4 lg:p-6 xl:p-8">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}