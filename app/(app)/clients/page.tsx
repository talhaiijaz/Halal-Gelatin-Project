"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClientsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to local clients by default (removing "All Clients" tab)
    router.replace("/clients/local");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}