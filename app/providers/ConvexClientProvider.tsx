"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
console.log("Convex URL:", convexUrl);

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

const convex = new ConvexReactClient(convexUrl);

export default function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log("ConvexClientProvider rendering...");
  return (
    <ConvexProvider client={convex}>
      {children}
    </ConvexProvider>
  );
}