"use client";

import { useState, useMemo } from "react";
import type { Weakness } from "@/types/scoring";
import { annotateEssay, countAnnotated } from "@/lib/annotate-essay";
import { PLAIN_CRITERION_SHORT, isCriterionKey } from "@/lib/feedback-copy";

/**
 * The learner's own essay with the flagged phrases highlighted. Tapping one
 * opens the fix for that weakness.
 *
 * Reading load here is close to zero — they wrote the text, so a highlight
 * tells them where the problem is without a single sentence of explanation.
 */
export function AnnotatedEssay({
  essay,
  weaknesses,
}: {
  essay: string;
  weaknesses: Weakness[];
}) {
  const segments = useMemo(() => annotateEssay(essay, weaknesses), [essay, weaknesses]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const found = countAnnotated(segments);
  if (!essay || found === 0) return null;

  const open = openIndex !== null ? weaknesses[openIndex] : null;
  const openCriterion =
    open && isCriterionKey(open.criterion) ? PLAIN_CRITERION_SHORT[open.criterion] : null;

  return (
    <section className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-6 shadow-sm space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-[#23282B]">
          Your essay, marked
        </h2>
        <span className="text-xs text-[#5B6266]">
          {found} {found === 1 ? "spot" : "spots"} to fix — tap one
        </span>
      </div>

      <p className="text-sm leading-loose text-[#23282B] whitespace-pre-wrap">
        {segments.map((seg, i) =>
          seg.weaknessIndex === null ? (
            <span key={i}>{seg.text}</span>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() =>
                setOpenIndex(openIndex === seg.weaknessIndex ? null : seg.weaknessIndex)
              }
              className={`rounded px-0.5 underline decoration-2 underline-offset-4 transition-colors ${
                openIndex === seg.weaknessIndex
                  ? "bg-[#F7E9DF] decoration-[#C97B4A]"
                  : "bg-[#FDF6F1] decoration-[#E0B79B] hover:bg-[#F7E9DF]"
              }`}
            >
              {seg.text}
            </button>
          )
        )}
      </p>

      {open && (
        <div className="rounded-xl border border-[#E4DFD3] bg-[#FDF6F1] px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2">
            {openCriterion && (
              <span className="px-2 py-0.5 rounded-full bg-[#F7E9DF] text-[#C97B4A] text-[11px] font-semibold">
                {openCriterion}
              </span>
            )}
            <p className="text-sm font-semibold text-[#23282B]">{open.issue}</p>
          </div>
          <p className="text-sm text-[#1F5C4E] font-medium">{open.fix}</p>
        </div>
      )}
    </section>
  );
}
