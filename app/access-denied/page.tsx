"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, Mail } from "lucide-react";

export default function AccessDeniedPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    // Auto sign out after 5 seconds
    const timer = setTimeout(() => {
      signOut();
    }, 5000);

    return () => clearTimeout(timer);
  }, [signOut]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
            Access Denied
          </h2>
          
          <p className="text-lg text-gray-600 mb-6">
            Your account is not authorized to access this system.
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <Mail className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  <strong>Need access?</strong> Contact your administrator to request access to the system.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => router.push("/login")}
              className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </button>
            
            <button
              onClick={() => signOut()}
              className="w-full flex justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              Sign Out
            </button>
          </div>
          
          <p className="mt-6 text-xs text-gray-500">
            You will be automatically signed out in a few seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
