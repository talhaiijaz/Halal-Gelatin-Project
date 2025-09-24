"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [isCheckingMFA, setIsCheckingMFA] = useState(false);

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
        console.log("User is signed in, redirecting to MFA verification");
        setIsCheckingMFA(true);
        
        // Always redirect to MFA verification after Google sign-in
        // This ensures consistent behavior with normal sign-in
        router.push("/verify-mfa");
      } else {
        console.log("User not signed in, redirecting to login");
        // User is not signed in, redirect to login
        router.push("/login");
      }
    };

    handleCallback();
  }, [isLoaded, isSignedIn, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">
          {isCheckingMFA ? "Redirecting to verification..." : "Completing sign-in..."}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          SSO Callback Page - Debug Mode
        </p>
      </div>
    </div>
  );
}
