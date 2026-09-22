"use client";

import { useEffect, useRef, useState } from "react";

interface TurnstileProps {
  onToken: (token: string | null) => void;
}

declare global {
  interface Window {
    turnstile: {
      render: (
        selector: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark";
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
          size?: "normal" | "compact";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      isReady: () => boolean;
      getResponse: (widgetId?: string) => string;
    };
    __turnstileReset?: () => void;
  }
}

/**
 * Turnstile CAPTCHA widget wrapper. Loads the Cloudflare script once, renders
 * the widget, and calls back with the token. If the script fails to load within
 * 10s (e.g., ad blocker, offline), allows button to submit anyway so Supabase
 * can return a clear error instead of a silent lockout.
 */
export function Turnstile({ onToken }: TurnstileProps) {
  const containerIdRef = useRef<string>("");
  const widgetId = useRef<string | null>(null);
  const scriptLoaded = useRef(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [containerId, setContainerId] = useState<string>("");

  useEffect(() => {
    // Initialize container ID on first render
    if (!containerIdRef.current) {
      containerIdRef.current = `turnstile-${Math.random().toString(36).slice(2)}`;
      setContainerId(containerIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (!containerId) return;

    // Load the Turnstile script once
    if (!scriptLoaded.current && !window.turnstile) {
      scriptLoaded.current = true;
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;

      const timeoutId = setTimeout(() => {
        // Script failed to load within 10s; allow submission without token.
        // Supabase will reject with a clear error if CAPTCHA is enforced.
        onToken(null);
        setHasTimedOut(true);
      }, 10000);

      script.onload = () => {
        clearTimeout(timeoutId);
        // Script loaded; render the widget on next effect
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        onToken(null);
        setHasTimedOut(true);
      };

      document.head.appendChild(script);
    }

    // Render the widget if the script is already loaded
    if (window.turnstile && !widgetId.current) {
      const id = window.turnstile.render(`#${containerIdRef.current}`, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
        theme: "light",
        callback: (token: string) => {
          onToken(token);
        },
        "error-callback": () => {
          onToken(null);
        },
        "expired-callback": () => {
          // Token expired; user must try again
          onToken(null);
        },
        "timeout-callback": () => {
          // Widget challenge timed out; user must try again
          onToken(null);
        },
      });
      widgetId.current = id;
    }

    return () => {
      // Cleanup on unmount
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [containerId, onToken]);

  // Reset the widget (clears token, user must complete again)
  useEffect(() => {
    const reset = () => {
      if (widgetId.current && window.turnstile && !hasTimedOut) {
        window.turnstile.reset(widgetId.current);
      }
      onToken(null);
    };

    // Expose the reset function via window so LoginForm can call it
    window.__turnstileReset = reset;

    return () => {
      delete window.__turnstileReset;
    };
  }, [hasTimedOut, onToken]);

  if (!containerId) return null;

  return (
    <div id={containerId} className="mb-4 flex justify-center" />
  );
}
