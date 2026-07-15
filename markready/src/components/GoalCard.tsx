"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TARGET_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const FLOOR = 4; // band scale floor used for the progress bar

export function GoalCard({
  target,
  best,
}: {
  target: number | null;
  best: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(target === null);
  const [choice, setChoice] = useState<number>(target ?? 7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: number | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/target-band", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: value }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Could not save your goal.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const reached = target !== null && best !== null && best >= target;
  const gap = target !== null && best !== null ? target - best : null;
  const pct =
    target !== null && best !== null
      ? Math.max(0, Math.min(100, ((best - FLOOR) / (target - FLOOR)) * 100))
      : 0;

  return (
    <div className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-[#23282B]">
          Your goal
        </h2>
        {target !== null && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-[#1F5C4E] hover:text-[#154136] hover:underline"
          >
            Change
          </button>
        )}
      </div>

      {target !== null && !editing ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-[#5B6266]">Target band</p>
              <p className="font-serif text-3xl font-semibold text-[#1F5C4E]">
                {target.toFixed(1)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#5B6266]">Your best</p>
              <p className="font-serif text-3xl font-semibold text-[#23282B]">
                {best !== null ? best.toFixed(1) : "—"}
              </p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                reached ? "bg-teal-600" : "bg-[#1F5C4E]"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-sm text-[#5B6266]">
            {reached ? (
              <span className="font-medium text-[#1F5C4E]">
                🎉 Goal reached — time to aim higher?
              </span>
            ) : gap !== null ? (
              <>
                <span className="font-medium text-[#23282B]">
                  {gap.toFixed(1)} band
                </span>{" "}
                to go — keep practising.
              </>
            ) : (
              "Score an essay to start tracking progress toward your goal."
            )}
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-[#5B6266]">
            Set the band you&apos;re aiming for and track your progress toward it.
          </p>
          <div className="flex flex-wrap gap-2">
            {TARGET_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => setChoice(b)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  choice === b
                    ? "bg-[#1F5C4E] text-white border-[#1F5C4E]"
                    : "bg-white text-[#23282B] border-[#E4DFD3] hover:border-[#1F5C4E]"
                }`}
              >
                {b.toFixed(1)}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={() => save(choice)}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#1F5C4E] text-white font-semibold text-sm hover:bg-[#154136] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Set goal"}
            </button>
            {target !== null && (
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="text-sm text-[#5B6266] hover:text-[#23282B] hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
