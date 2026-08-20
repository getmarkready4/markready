"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import type { ScoringResult, CriterionKey, TaskType } from "@/types/scoring";
import { CRITERION_LABELS, TASK_LABELS } from "@/types/scoring";
import { GameSummary } from "./GameSummary";
import { AnnotatedEssay } from "./AnnotatedEssay";
import {
  PLAIN_CRITERION_LABELS,
  PLAIN_CRITERION_SHORT,
  isCriterionKey,
  splitQuotedExample,
} from "@/lib/feedback-copy";

const REVEAL_MS = 1100; // how long one bar takes to fill
const STAGGER_MS = 320; // gap between consecutive criteria starting
const HERO_DELAY_MS = 150;
const CRITERIA_DELAY_MS = 500;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// useSyncExternalStore rather than an effect: the OS setting is external state,
// and subscribing this way keeps the server snapshot (false) consistent with
// hydration instead of setting state during an effect.
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_MOTION_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}

/**
 * Eased 0→1 progress, starting after `delay`. Returns 1 outright when disabled,
 * so the bar and the number are always driven by one value and cannot drift out
 * of sync with each other.
 */
function useReveal(enabled: boolean, delay: number, duration = REVEAL_MS) {
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / duration);
      setT(1 - Math.pow(1 - p, 3)); // ease-out cubic: quick, then settling
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);

    // Safety net. requestAnimationFrame does not fire in a hidden tab, and the
    // band is the whole point of the page — it must never be left showing 0.0
    // because an animation frame never arrived. setTimeout still runs when
    // hidden, so this guarantees the real score lands regardless.
    const settle = window.setTimeout(
      () => setT(1),
      delay + duration + 400
    );

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(settle);
      cancelAnimationFrame(raf);
    };
  }, [enabled, delay, duration]);

  return enabled ? t : 1;
}

// Colour comes from the *final* band, never the in-flight value — otherwise the
// bar visibly changes colour mid-fill as it crosses each threshold.
function barColor(band: number) {
  return band >= 7.5
    ? "bg-teal-700"
    : band >= 6.5
      ? "bg-teal-600"
      : band >= 5.5
        ? "bg-amber-500"
        : "bg-red-400";
}

function pillColor(band: number) {
  return band >= 7.5
    ? "bg-teal-50 text-teal-800 border-teal-200"
    : band >= 6.5
      ? "bg-teal-50 text-teal-700 border-teal-200"
      : band >= 5.5
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";
}

function BandBar({ band, t }: { band: number; t: number }) {
  const fullPct = ((band - 1) / 8) * 100;
  return (
    <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
      <div
        className={`h-full rounded-full ${barColor(band)}`}
        style={{ width: `${Math.max(0, fullPct * t)}%` }}
      />
    </div>
  );
}

function BandPill({ band, t }: { band: number; t: number }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-0.5 rounded-full text-sm font-semibold border tabular-nums ${pillColor(band)}`}
    >
      {(band * t).toFixed(1)}
    </span>
  );
}

/** One criterion row — bar and number share a single progress value. */
function CriterionRow({
  label,
  sublabel,
  band,
  index,
  animate,
  children,
}: {
  label: string;
  /** Official IELTS criterion name, shown small beneath the plain-English one. */
  sublabel?: string;
  band: number;
  index: number;
  animate: boolean;
  children: React.ReactNode;
}) {
  const t = useReveal(animate, CRITERIA_DELAY_MS + index * STAGGER_MS);
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-sm font-medium text-[#23282B]">{label}</span>
          {sublabel && sublabel !== label && (
            <span className="block text-[11px] text-[#5B6266]">{sublabel}</span>
          )}
        </div>
        <BandPill band={band} t={t} />
      </div>
      <BandBar band={band} t={t} />
      {children}
    </div>
  );
}

export function ScoreReport({
  result,
  taskType,
  essay,
  animate = false,
}: {
  result: ScoringResult;
  taskType: TaskType;
  /** The candidate's submission, used to highlight flagged phrases in place. */
  essay?: string;
  /**
   * Reveal the scores progressively. On for the fresh result on /score; off on
   * /dashboard/[id], where replaying the count-up every time you reopen an old
   * essay would just be in the way.
   */
  animate?: boolean;
}) {
  const criteriaEntries = (Object.entries(result.criteria) as [
    CriterionKey,
    import("@/types/scoring").CriterionScore,
  ][]);

  const reducedMotion = usePrefersReducedMotion();
  const revealing = animate && !reducedMotion;
  const heroT = useReveal(revealing, HERO_DELAY_MS, REVEAL_MS + 300);

  return (
    <div className="space-y-8">
      {/* Overall band hero */}
      <div className="rounded-2xl border border-[#E4DFD3] bg-white px-8 py-8 text-center shadow-sm">
        <p className="text-sm text-[#5B6266] mb-1">Estimated Overall Band</p>
        <div className="font-serif text-8xl font-semibold text-[#1F5C4E] leading-none tabular-nums">
          ~{(result.overall_band * heroT).toFixed(1)}
        </div>
        <p className="text-xs text-[#5B6266] mt-3">
          {result.word_count} words · IELTS {TASK_LABELS[taskType]}
        </p>
        {/* Task 1 extras */}
        {result.overview_present !== undefined && (
          <div className="mt-3 flex justify-center gap-3">
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full border ${
                result.overview_present
                  ? "bg-teal-50 border-teal-200 text-teal-700"
                  : "bg-red-50 border-red-200 text-red-600"
              }`}
            >
              {result.overview_present ? "Overview present" : "Overview missing"}
            </span>
          </div>
        )}
        {result.data_accuracy_note &&
          result.data_accuracy_note !== "No inaccuracies detected" && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Data note: {result.data_accuracy_note}
            </p>
          )}
        <p className="mt-4 text-[11px] text-[#5B6266]/80 leading-relaxed max-w-md mx-auto">
          This is an AI-generated estimate to guide your practice, not an
          official IELTS result. Use it to find your weakest areas — treat
          the exact band as approximate.
        </p>
      </div>

      {/* TIER 1 — the skim layer. Everything below is derived from structured
          fields or is the candidate's own words, so it needs no reading skill. */}
      <GameSummary result={result} taskType={taskType} />

      {/* Criterion scores. Plain label leads; the official IELTS term is kept as
          a subtitle so candidates still learn it without needing it to decode
          their own result. Prose rationale is demoted to Tier 2. */}
      <section className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg font-semibold text-[#23282B]">
          Your four scores
        </h2>
        {criteriaEntries.map(([key, val], i) => (
          <CriterionRow
            key={key}
            label={PLAIN_CRITERION_LABELS[key] ?? CRITERION_LABELS[key]}
            sublabel={CRITERION_LABELS[key]}
            band={val.band}
            index={i}
            animate={revealing}
          >
            <Disclosure label="Why this score">
              {val.strengths_noted && (
                <p className="text-xs text-[#1F5C4E] bg-[#E7EFEC] rounded-lg px-3 py-2 leading-relaxed">
                  ✓ {val.strengths_noted}
                </p>
              )}
              <p className="text-xs text-[#5B6266] leading-relaxed">{val.rationale}</p>
            </Disclosure>
          </CriterionRow>
        ))}
      </section>

      {/* Fixes. The offending phrases are shown as chips of the candidate's own
          words — recognisable at a glance; the wordy explanation is Tier 2. */}
      {result.weaknesses.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-lg font-semibold text-[#23282B]">
            Fix {result.weaknesses.length}{" "}
            {result.weaknesses.length === 1 ? "thing" : "things"}
          </h2>
          {result.weaknesses.map((w, i) => {
            const fragments = splitQuotedExample(w.quoted_example ?? "");
            const badge = isCriterionKey(w.criterion)
              ? PLAIN_CRITERION_SHORT[w.criterion]
              : null;
            return (
              <div
                key={i}
                className="rounded-2xl border border-[#E4DFD3] bg-white px-5 py-4 shadow-sm space-y-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F7E9DF] text-[#C97B4A] text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  {badge && (
                    <span className="px-2 py-0.5 rounded-full bg-[#F2EEE5] text-[#5B6266] text-[11px] font-semibold">
                      {badge}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-[#23282B]">{w.issue}</p>
                </div>

                {fragments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {fragments.map((f, j) => (
                      <span
                        key={j}
                        className="px-2.5 py-1 rounded-lg bg-[#FDF6F1] text-[#C97B4A] text-xs font-medium line-through decoration-[#E0B79B]"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-sm text-[#1F5C4E] font-medium leading-snug">
                  {w.fix}
                </p>

                <Disclosure label="Why it matters">
                  <p className="text-xs text-[#5B6266] leading-relaxed">
                    {w.explanation}
                  </p>
                </Disclosure>
              </div>
            );
          })}
        </section>
      )}

      {/* Vocabulary swaps — already a before/after pair, so it reads without
          any prose. The rationale moves behind a toggle. */}
      {result.vocabulary_upgrades.length > 0 && (
        <section className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-6 shadow-sm space-y-4">
          <h2 className="font-serif text-lg font-semibold text-[#23282B]">
            Swap these words
          </h2>
          <div className="space-y-2.5">
            {result.vocabulary_upgrades.map((v, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-[#F2EEE5] text-[#5B6266] text-xs font-medium line-through decoration-[#C9C2B2]">
                    {v.original}
                  </span>
                  <span className="text-[#C97B4A] text-sm">→</span>
                  <span className="px-3 py-1 rounded-full bg-[#E7EFEC] text-[#1F5C4E] text-xs font-semibold">
                    {v.upgrade}
                  </span>
                </div>
                <Disclosure label="Why">
                  <p className="text-xs text-[#5B6266] leading-relaxed">{v.why}</p>
                </Disclosure>
              </div>
            ))}
          </div>
        </section>
      )}

      {essay && <AnnotatedEssay essay={essay} weaknesses={result.weaknesses} />}

      {/* TIER 3 — the full examiner report, unchanged. Kept intact for the
          candidate who wants the detail; collapsed so nobody has to wade
          through it to find out what to fix. */}
      <details className="group rounded-2xl border border-[#E4DFD3] bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between">
          <span className="font-serif text-lg font-semibold text-[#23282B]">
            Full examiner report
          </span>
          <span className="text-xs text-[#5B6266] group-open:hidden">Show</span>
          <span className="text-xs text-[#5B6266] hidden group-open:inline">Hide</span>
        </summary>

        <div className="px-6 pb-6 space-y-6 border-t border-[#E4DFD3] pt-5">
          {/* Model paragraph */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-[#23282B]">
                Band {result.model_paragraph.target_band} model rewrite
              </h3>
              <span className="text-xs text-[#5B6266]">
                Weakest paragraph improved
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#5B6266] uppercase tracking-wide">
                  Your version
                </p>
                <p className="text-sm text-[#23282B] bg-[#F2EEE5] rounded-xl px-4 py-4 leading-relaxed">
                  {result.model_paragraph.original}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#1F5C4E] uppercase tracking-wide">
                  Band {result.model_paragraph.target_band} rewrite
                </p>
                <p className="text-sm text-[#23282B] bg-[#E7EFEC] rounded-xl px-4 py-4 leading-relaxed">
                  {result.model_paragraph.rewrite}
                </p>
              </div>
            </div>
            <p className="text-xs text-[#5B6266] leading-relaxed border-t border-[#E4DFD3] pt-3">
              {result.model_paragraph.changes_explained}
            </p>
          </section>

          {/* Examiner summary */}
          <section className="rounded-2xl border border-[#1F5C4E]/20 bg-[#E7EFEC] px-5 py-5 space-y-2">
            <h3 className="font-serif text-base font-semibold text-[#1F5C4E]">
              Examiner&apos;s verdict
            </h3>
            <p className="text-sm text-[#23282B] leading-relaxed">
              {result.examiner_summary}
            </p>
          </section>
        </div>
      </details>
    </div>
  );
}

/** Tier 2 — detail available on demand, never in the way. */
function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group/d">
      <summary className="cursor-pointer list-none text-xs text-[#5B6266] hover:text-[#23282B] inline-flex items-center gap-1">
        <span className="transition-transform group-open/d:rotate-90">›</span>
        {label}
      </summary>
      <div className="mt-1.5 space-y-1.5">{children}</div>
    </details>
  );
}
