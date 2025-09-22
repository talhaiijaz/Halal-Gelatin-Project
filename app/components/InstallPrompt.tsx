"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    // @ts-ignore
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      // @ts-ignore
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (!visible) return null;

  const onInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setVisible(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
      <div className="mx-auto max-w-md rounded-xl shadow-lg border border-gray-200 bg-white">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900">Install app</h3>
          <p className="mt-1 text-xs text-gray-600">Add Halal Gelatin CRM to your home screen for a better mobile experience.</p>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setVisible(false)} className="px-3 py-2 text-sm rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200">
              Not now
            </button>
            <button onClick={onInstall} className="px-3 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700">
              Install
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


