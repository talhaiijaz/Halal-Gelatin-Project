"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SSOCallbackPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const checkUserAccess = useMutation(api.users.checkUserAccess);

  useEffect(() => {
    console.log("SSO Callback Page loaded");
    console.log("isLoaded:", isLoaded);
    console.log("isSignedIn:", isSignedIn);
    console.log("user:", user);

    const handleCallback = async () => {
      if (!isLoaded) {
        console.log("Auth not loaded yet, waiting...");
        return;
      }

      if (isSignedIn && user) {
        console.log("User is signed in, checking database access...");
        
        try {
          // Check if user exists in database (don't auto-create)
          const userEmail = user.primaryEmailAddress?.emailAddress || "";
          const userId = await checkUserAccess({
            email: userEmail,
            name: user.fullName || user.firstName || "Unknown User"
          });
          
              if (userId) {
                console.log("User found in database, access granted");
                // Redirect to home page after successful authentication
                router.replace("/home");
              } else {
            console.log("User not found in database, access denied");
            // Redirect to access denied page
            router.replace("/access-denied");
          }
        } catch (error) {
          console.error("Failed to check user access:", error);
          // Redirect to access denied page
          router.replace("/access-denied");
        }
      } else {
        console.log("User not signed in, redirecting to login");
        // User is not signed in, redirect to login
        router.replace("/login");
      }
    };

    handleCallback();
  }, [isLoaded, isSignedIn, user, router, checkUserAccess]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign-in...</p>
        <p className="mt-2 text-xs text-gray-500">
          SSO Callback Page
        </p>
      </div>
    </div>
  );
}
