import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "./providers/ConvexClientProvider";
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "./components/ErrorBoundary";
import InstallPrompt from "./components/InstallPrompt";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Halal Gelatin CRM",
  description: "Gelatin Manufacturing CRM System",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/images/Logo-Final-Vector-22.png", type: "image/png" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: [
      "/images/Logo-Final-Vector-22.png",
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ea580c',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-white`}>
        <ClerkProvider
          signInUrl="/login"
          afterSignInUrl="/sso-callback"
        >
          <ErrorBoundary>
            <ConvexClientProvider>
              {children}
              <InstallPrompt />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    style: {
                      background: '#10b981',
                    },
                  },
                  error: {
                    style: {
                      background: '#ef4444',
                    },
                  },
                }}
              />
            </ConvexClientProvider>
          </ErrorBoundary>
        </ClerkProvider>
      </body>
    </html>
  );
}