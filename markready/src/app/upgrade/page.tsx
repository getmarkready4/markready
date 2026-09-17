"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Shown when an account has used its free marks.
 *
 * The plan is fixed: 20 successful marks for US$20, valid 30 days from
 * purchase. Checkout is not wired yet — payment rails are the next step — so
 * this presents the plan and records interest. It must not imply a working
 * purchase; packs are currently granted manually after payment.
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
          Get 20 more marks
        </h1>

        <p className="text-sm text-[#5B6266] mb-4">
          Every account starts with two free scored essays. When they&rsquo;re used,
          a Mark Pack gives you 20 more.
        </p>

        <div className="mb-4 rounded-xl border border-[#E4DFD3] bg-[#FAF8F3] px-5 py-4 text-left">
          <p className="font-serif text-2xl font-semibold text-[#23282B]">
            US$20 <span className="text-base font-normal text-[#5B6266]">· 20 marks</span>
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#5B6266]">
            <li>Valid for 30 days from purchase</li>
            <li>Only successful scores count — a failed attempt never uses a mark</li>
            <li>The same full feedback as your free marks</li>
          </ul>
        </div>

        <p className="text-sm text-[#5B6266] mb-6">
          Checkout is being set up. Tap below and we&rsquo;ll email you the moment it opens.
        </p>

        {state === "done" ? (
          <div className="p-4 bg-[#FAF8F3] border border-[#E4DFD3] rounded-lg text-sm text-[#23282B]">
            Noted &mdash; thank you. We&rsquo;ll be in touch as soon as you can buy a pack.
          </div>
        ) : (
          <>
            <button
              onClick={registerInterest}
              disabled={state === "saving"}
              className="w-full py-2.5 rounded-lg bg-[#23282B] text-white text-sm font-medium disabled:opacity-40 hover:bg-[#3A4145] transition-colors"
            >
              {state === "saving" ? "Saving…" : "Notify me when checkout opens"}
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
          {" "}<Link href="/score" className="text-[#23282B] underline">Return to your drafts</Link> to keep writing.
        </p>
      </div>
    </div>
  );
}
