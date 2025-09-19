"use client";

import { useState, useEffect } from "react";
// import toast from "react-hot-toast";

interface IdleWarningProps {
  isActive: boolean;
  onExtendSession: () => void;
  onLogout: () => void;
}

export function IdleWarning({ isActive, onExtendSession, onLogout }: IdleWarningProps) {
  const [timeLeft, setTimeLeft] = useState(60); // 60 seconds warning

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(60);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, onLogout]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
            <svg
              className="h-6 w-6 text-orange-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Session Timeout Warning
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            You will be automatically logged out due to inactivity.
          </p>
          <div className="text-2xl font-bold text-orange-600 mb-6">
            {timeLeft} seconds
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onExtendSession}
              className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              Stay Logged In
            </button>
            <button
              onClick={onLogout}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Logout Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
