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
    const handleCallback = async () => {
      if (!isLoaded) return;

      if (isSignedIn && user) {
        setIsCheckingMFA(true);
        
        // Check if user needs MFA verification
        // For Google SSO users, we need to check if they have MFA enabled
        try {
          // Check if user has phone numbers or TOTP factors
          const hasPhoneNumbers = user.phoneNumbers && user.phoneNumbers.length > 0;
          const needsMFA = hasPhoneNumbers; // Adjust this logic based on your MFA requirements
          
          if (needsMFA) {
            // Redirect to MFA verification
            router.push("/verify-mfa");
          } else {
            // No MFA required, go to dashboard
            router.push("/dashboard");
          }
        } catch (error) {
          console.error("Error checking MFA status:", error);
          // Default to dashboard if there's an error
          router.push("/dashboard");
        }
      } else {
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
          {isCheckingMFA ? "Checking security requirements..." : "Completing sign-in..."}
        </p>
      </div>
    </div>
  );
}
