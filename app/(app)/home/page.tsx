"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import ProtectedRoute from "@/app/components/ProtectedRoute";

function HomePageContent() {
  const { user } = useUser();
  const currentUserRole = useQuery(api.users.getCurrentUserRole);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-orange-100 rounded-full">
            <img
              src="/images/Logo-Final-Vector-22.png"
              alt="Halal Gelatin"
              className="h-16 w-16"
            />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Halal Gelatin
        </h1>
        
        <p className="text-lg text-gray-600 mb-4">
          Hello, {user?.fullName || user?.firstName || "User"}!
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Your Role:</p>
          <p className="text-lg font-semibold text-orange-600 capitalize">
            {currentUserRole || "Loading..."}
          </p>
        </div>
        
        <div className="mt-6 text-sm text-gray-500">
          <p>Use the sidebar to navigate to your available features.</p>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute route="/">
      <HomePageContent />
    </ProtectedRoute>
  );
}
