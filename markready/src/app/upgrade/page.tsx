"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Shown when a founding user has spent both free tests.
 *
 * There is no checkout yet — payment rails are a later step — so this records
 * interest only. It must not imply a working purchase.
 */
export default function UpgradePage() {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const registerInterest = async () => {
    setState("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upgrade_interest: true }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F3] px-4 py-12">
      <div className="mb-8 text-center">
        <span className="font-serif text-2xl font-semibold text-[#23282B]">MarkReady</span>
      </div>

      <div className="w-full max-w-md bg-white border border-[#E4DFD3] rounded-2xl p-8 text-center">
        <h1 className="font-serif text-xl font-semibold text-[#23282B] mb-3">
          That&rsquo;s both free tests used
        </h1>

        <p className="text-sm text-[#5B6266] mb-6">
          You&rsquo;ve used the two scored essays that come with your founding place.
          We&rsquo;re building an unlimited plan next &mdash; tell us you want it and
          you&rsquo;ll be first to know, at the founding price.
        </p>

        {state === "done" ? (
          <div className="p-4 bg-[#FAF8F3] border border-[#E4DFD3] rounded-lg text-sm text-[#23282B]">
            Noted &mdash; thank you. We&rsquo;ll be in touch before anyone else.
          </div>
        ) : (
          <>
            <button
              onClick={registerInterest}
              disabled={state === "saving"}
              className="w-full py-2.5 rounded-lg bg-[#23282B] text-white text-sm font-medium disabled:opacity-40 hover:bg-[#3A4145] transition-colors"
            >
              {state === "saving" ? "Saving…" : "I want unlimited scoring"}
            </button>
            {state === "error" && (
              <p className="mt-3 text-sm text-red-700">
                Could not save that. Please try again.
              </p>
            )}
          </>
        )}

        <p className="mt-6 pt-4 border-t border-[#E4DFD3] text-sm text-[#5B6266]">
          Your scored essays stay available in your{" "}
          <Link href="/dashboard" className="text-[#23282B] underline">
            dashboard
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
