"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Kept in sync with REFERRAL_SOURCES in /api/profile. */
const SOURCES = [
  { value: "facebook_group", label: "Facebook group" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "reddit", label: "Reddit" },
  { value: "google_search", label: "Google search" },
  { value: "friend", label: "A friend or colleague" },
  { value: "review_centre", label: "A review centre or teacher" },
  { value: "other", label: "Somewhere else" },
] as const;

export default function WelcomePage() {
  const router = useRouter();
  const [source, setSource] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referral_source: source,
          referral_detail: source === "other" ? detail : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save your answer. Please try again.");
        setSaving(false);
        return;
      }

      // The proxy decides where this user belongs (scorer or waitlist).
      router.push("/score");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F3] px-4 py-12">
      <div className="mb-8 text-center">
        <span className="font-serif text-2xl font-semibold text-[#23282B]">MarkReady</span>
      </div>

      <div className="w-full max-w-md bg-white border border-[#E4DFD3] rounded-2xl p-8">
        <h1 className="font-serif text-xl font-semibold text-[#23282B] mb-2">
          One quick question
        </h1>
        <p className="text-sm text-[#5B6266] mb-6">
          How did you hear about MarkReady? This genuinely helps us decide where to
          spend our time.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <fieldset className="space-y-2 mb-4">
            <legend className="sr-only">How did you hear about MarkReady?</legend>
            {SOURCES.map((s) => (
              <label
                key={s.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  source === s.value
                    ? "border-[#23282B] bg-[#FAF8F3]"
                    : "border-[#E4DFD3] hover:border-[#C9C2B2]"
                }`}
              >
                <input
                  type="radio"
                  name="referral_source"
                  value={s.value}
                  checked={source === s.value}
                  onChange={(e) => setSource(e.target.value)}
                  className="accent-[#23282B]"
                />
                <span className="text-sm text-[#23282B]">{s.label}</span>
              </label>
            ))}
          </fieldset>

          {source === "other" && (
            <div className="mb-4">
              <label
                htmlFor="detail"
                className="block text-sm font-medium text-[#23282B] mb-1"
              >
                Where, roughly?
              </label>
              <input
                id="detail"
                type="text"
                value={detail}
                maxLength={200}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-[#E4DFD3] rounded-lg text-sm text-[#23282B] focus:outline-none focus:border-[#23282B]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!source || saving}
            className="w-full py-2.5 rounded-lg bg-[#23282B] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3A4145] transition-colors"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
