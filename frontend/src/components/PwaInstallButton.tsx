"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

/** Shows an install CTA on Chromium desktop/Android when the browser allows A2HS. */
export function PwaInstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setDeferred(null);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !deferred) return null;

  return (
    <button
      type="button"
      className="fixed bottom-5 right-5 z-50 rounded-full bg-pop px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,90,95,0.35)] transition hover:brightness-105 active:scale-[0.98]"
      onClick={async () => {
        await deferred.prompt();
        try {
          await deferred.userChoice;
        } finally {
          setDeferred(null);
          setVisible(false);
        }
      }}
    >
      Install app
    </button>
  );
}
