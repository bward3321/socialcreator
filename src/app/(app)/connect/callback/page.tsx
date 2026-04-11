"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const connected = searchParams.get("connected");

    if (connected && window.opener) {
      // Notify the parent window that the connection succeeded
      window.opener.postMessage(
        { type: "oauth-success", connected: true },
        window.location.origin
      );
      setClosing(true);
      // Auto-close after a short delay
      setTimeout(() => window.close(), 1000);
    } else if (connected) {
      // Opened directly (not as popup) — redirect to /connect
      window.location.href = "/connect?connected=true";
    }
  }, [searchParams]);

  if (closing) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-zinc-200 font-medium">Account connected!</p>
          <p className="text-sm text-zinc-500 mt-1">This window will close automatically...</p>
          <button
            onClick={() => window.close()}
            className="mt-4 text-sm text-purple hover:underline cursor-pointer"
          >
            Close now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-zinc-500">Completing connection...</p>
    </div>
  );
}
