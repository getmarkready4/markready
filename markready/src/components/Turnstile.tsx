"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

interface TurnstileHandle {
  reset: () => void;
}

interface TurnstileProps {
  onToken: (token: string | null) => void;
  /**
   * Called when the CAPTCHA cannot produce a token and never will — script
   * blocked, offline, widget stalled. The parent MUST use this to stop gating
   * submit, because `onToken(null)` cannot do that job: it leaves the parent's
   * token null, which is indistinguishable from "still waiting". Three earlier
   * attempts at the timeout fix failed for exactly that reason.
   */
  onUnavailable: () => void;
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
  }
}

/**
 * Turnstile CAPTCHA widget wrapper. Loads the Cloudflare script, renders the
 * widget, and calls back with the token. Handles token expiry, widget reset
 * after login attempts, and a 10s fallback if the script fails to load or
 * stalls (ad blocker, network issue, silent challenge failure). The fallback
 * re-enables the submit button so Supabase can return a clear error instead of
 * a permanent lockout. Reset function is exposed via ref so parent can call it
 * on mount (stable) rather than through a window global (fragile).
 */
const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(
  ({ onToken, onUnavailable }, ref) => {
    const containerIdRef = useRef(`turnstile-${Math.random().toString(36).slice(2)}`);
    const widgetIdRef = useRef<string | null>(null);
    const scriptLoadedRef = useRef(false);
    const onTokenRef = useRef(onToken);
    const onUnavailableRef = useRef(onUnavailable);
    const tokenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [scriptReady, setScriptReady] = useState(false);
    const [hasTimedOut, setHasTimedOut] = useState(false);

    // Keep callback refs in sync without affecting effect dependencies
    useEffect(() => {
      onTokenRef.current = onToken;
      onUnavailableRef.current = onUnavailable;
    }, [onToken, onUnavailable]);

    // Arm the 10s timeout on mount, unconditionally. This is the only placement
    // that covers all failure modes: script never loads, script loads but widget
    // never renders, widget renders but challenge never completes, challenge
    // silently stalls. All reduce to the same observable: no token in 10s.
    useEffect(() => {
      const id = setTimeout(() => {
        onUnavailableRef.current();
        setHasTimedOut(true);
      }, 10000);
      tokenTimeoutRef.current = id;
      return () => clearTimeout(id);
    }, []);

    // Load the Turnstile script once globally
    useEffect(() => {
      if (scriptLoadedRef.current || window.turnstile) {
        // Script already loaded
        setScriptReady(true);
        return;
      }

      scriptLoadedRef.current = true;
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;

      script.onload = () => {
        // Script loaded; mark as ready so render effect can proceed
        setScriptReady(true);
      };

      script.onerror = () => {
        // Script failed to load; fail fast instead of waiting 10s
        if (tokenTimeoutRef.current) {
          clearTimeout(tokenTimeoutRef.current);
          tokenTimeoutRef.current = null;
        }
        onUnavailableRef.current();
        setHasTimedOut(true);
      };

      document.head.appendChild(script);
    }, []);

    // Render the widget once script is ready
    useEffect(() => {
      if (!scriptReady || !window.turnstile || widgetIdRef.current) {
        // Either script not ready, global not available, or widget already mounted
        return;
      }

      const id = window.turnstile.render(`#${containerIdRef.current}`, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
        theme: "light",
        callback: (token: string) => {
          // Token received; clear the timeout (only place that disarms it)
          if (tokenTimeoutRef.current) {
            clearTimeout(tokenTimeoutRef.current);
            tokenTimeoutRef.current = null;
          }
          onTokenRef.current(token);
        },
        "error-callback": () => {
          onTokenRef.current(null);
        },
        "expired-callback": () => {
          // Token expired; user must try again (widget auto-resets)
          onTokenRef.current(null);
        },
        "timeout-callback": () => {
          // Challenge timed out; user must try again (widget auto-resets)
          onTokenRef.current(null);
        },
      });
      widgetIdRef.current = id;

      return () => {
        // Cleanup on unmount
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [scriptReady]);

    // Reset the widget (clears token, user must complete again)
    // Expose via ref so parent can call it on mount (not on token arrival)
    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile && !hasTimedOut) {
          window.turnstile.reset(widgetIdRef.current);
        }
        onTokenRef.current(null);
      },
    }));

    if (!scriptReady) return null;

    return (
      <div id={containerIdRef.current} className="mb-4 flex justify-center" />
    );
  }
);

Turnstile.displayName = "Turnstile";

export { Turnstile };
