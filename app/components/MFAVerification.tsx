"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

interface MFAVerificationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function MFAVerification({ onSuccess, onCancel }: MFAVerificationProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<'sms' | 'totp' | null>(null);
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Determine which MFA method is available
    if (user) {
      // Check if user has SMS MFA enabled
      if (user.phoneNumbers.length > 0) {
        setMfaMethod('sms');
      } else {
        // Default to TOTP for now - Clerk will handle the verification
        setMfaMethod('totp');
      }
    }
  }, [user]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    setIsLoading(true);
    try {
      // Use Clerk's verifyTOTP method for both SMS and TOTP
      // Clerk will handle the appropriate verification based on the user's MFA setup
      await user?.verifyTOTP({ code });
      
      toast.success("Verification successful!");
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard");
      }
    } catch (error: any) {
      console.error("MFA verification error:", error);
      toast.error(error?.errors?.[0]?.message || "Invalid verification code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    // For now, just show a message since Clerk handles the resend logic
    if (mfaMethod === 'sms') {
      toast("Please check your phone for the SMS code or try signing in again");
    } else {
      toast("Please use your authenticator app to generate a new code");
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/login");
    }
  };

  if (!mfaMethod) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading verification options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div>
          <div className="flex justify-center">
            <img
              className="h-16 w-auto"
              src="/images/Logo-Final-Vector-22.png"
              alt="Halal Gelatin"
            />
          </div>
          <h2 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
            Verify Your Identity
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {mfaMethod === 'sms' 
              ? "Enter the verification code sent to your phone"
              : "Enter the code from your authenticator app"
            }
          </p>
        </div>
        
        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleVerify}>
          <div>
            <label htmlFor="code" className="sr-only">
              Verification Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              maxLength={6}
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm text-center text-lg tracking-widest"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying...
                </div>
              ) : (
                "Verify Code"
              )}
            </button>
            
            <div className="flex justify-between">
              {mfaMethod === 'sms' && (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                >
                  Resend Code
                </button>
              )}
              
              <button
                type="button"
                onClick={handleCancel}
                className="text-sm text-gray-600 hover:text-gray-700 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
