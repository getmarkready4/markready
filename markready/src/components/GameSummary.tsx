import type {
  ScoringResult,
  CriterionKey,
  CriterionScore,
  TaskType,
} from "@/types/scoring";
import {
  PLAIN_CRITERION_LABELS,
  bandVerdict,
  nextAction,
  isCriterionKey,
  wordCountStatus,
} from "@/lib/feedback-copy";

/**
 * The three lines a skimmer reads. Everything here is derived from structured
 * fields — band numbers, the weakest-criterion key, the word count — so it is
 * short and plain regardless of how the scorer chose to phrase itself.
 *
 * If a learner reads nothing else on the page, this should still tell them what
 * they did well, what is costing them marks, and what to do next time.
 */
export function GameSummary({
  result,
  taskType,
}: {
  result: ScoringResult;
  taskType: TaskType;
}) {
  const entries = Object.entries(result.criteria).filter(
    (e): e is [CriterionKey, CriterionScore] =>
      isCriterionKey(e[0]) && e[1] !== undefined
  );
  if (entries.length === 0) return null;

  const best = entries.reduce((a, b) => (b[1].band > a[1].band ? b : a));
  const weakestKey = isCriterionKey(result.weakest_criterion)
    ? result.weakest_criterion
    : entries.reduce((a, b) => (b[1].band < a[1].band ? b : a))[0];
  const weakestBand = result.criteria[weakestKey]?.band;

  const words = wordCountStatus(result.word_count, taskType);

  return (
    <div className="rounded-2xl border border-[#E4DFD3] bg-white shadow-sm divide-y divide-[#E4DFD3]">
      <Row
        icon="✓"
        iconClass="bg-[#E7EFEC] text-[#1F5C4E]"
        label="Best"
        value={PLAIN_CRITERION_LABELS[best[0]]}
        band={best[1].band}
      />
      <Row
        icon="!"
        iconClass="bg-[#F7E9DF] text-[#C97B4A]"
        label="Weakest"
        value={PLAIN_CRITERION_LABELS[weakestKey]}
        band={weakestBand}
      />
      <div className="flex items-start gap-3 px-5 py-4">
        <span className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-[#23282B] text-white text-sm font-bold flex items-center justify-center">
          →
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-[#5B6266] font-semibold">
            Do this next
          </p>
          <p className="text-base text-[#23282B] font-medium leading-snug">
            {nextAction(weakestKey)}
          </p>
        </div>
      </div>
      {words.under && (
        <p className="px-5 py-3 text-sm text-[#C97B4A] bg-[#FDF6F1]">
          {words.message}
        </p>
      )}
    </div>
  );
}

function Row({
  icon,
  iconClass,
  label,
  value,
  band,
}: {
  icon: string;
  iconClass: string;
  label: string;
  value: string;
  band?: number;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span
        className={`flex-shrink-0 w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center ${iconClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-[#5B6266] font-semibold">
          {label}
        </p>
        <p className="text-base text-[#23282B] font-medium leading-snug">{value}</p>
      </div>
      {band !== undefined && (
        <div className="text-right flex-shrink-0">
          <span className="font-serif text-xl font-semibold text-[#23282B] tabular-nums">
            {band.toFixed(1)}
          </span>
          <p className="text-[11px] text-[#5B6266] -mt-1">{bandVerdict(band)}</p>
        </div>
      )}
    </div>
  );
}
