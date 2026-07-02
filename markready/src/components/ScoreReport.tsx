import type { ScoringResult, CriterionKey, TaskType } from "@/types/scoring";
import { CRITERION_LABELS, TASK_LABELS } from "@/types/scoring";

function BandBar({ band }: { band: number }) {
  const pct = ((band - 1) / 8) * 100;
  const color =
    band >= 7.5
      ? "bg-teal-700"
      : band >= 6.5
        ? "bg-teal-600"
        : band >= 5.5
          ? "bg-amber-500"
          : "bg-red-400";
  return (
    <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-700`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function BandPill({ band }: { band: number }) {
  const color =
    band >= 7.5
      ? "bg-teal-50 text-teal-800 border-teal-200"
      : band >= 6.5
        ? "bg-teal-50 text-teal-700 border-teal-200"
        : band >= 5.5
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-red-50 text-red-700 border-red-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold border ${color}`}
    >
      {band.toFixed(1)}
    </span>
  );
}

export function ScoreReport({
  result,
  taskType,
}: {
  result: ScoringResult;
  taskType: TaskType;
}) {
  const criteriaEntries = (Object.entries(result.criteria) as [
    CriterionKey,
    import("@/types/scoring").CriterionScore,
  ][]);

  return (
    <div className="space-y-8">
      {/* Overall band hero */}
      <div className="rounded-2xl border border-[#E4DFD3] bg-white px-8 py-8 text-center shadow-sm">
        <p className="text-sm text-[#5B6266] mb-1">Estimated Overall Band</p>
        <div className="font-serif text-8xl font-semibold text-[#1F5C4E] leading-none">
          ~{result.overall_band.toFixed(1)}
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

      {/* Full report */}
      <div>
        <div className="space-y-8">
          {/* Criterion scores */}
          <section className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-[#23282B]">
                Estimated criterion scores
              </h2>
              <span className="text-xs text-[#5B6266]">
                Use the ranking, not the exact number
              </span>
            </div>
            {criteriaEntries.map(([key, val]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#23282B]">
                    {CRITERION_LABELS[key]}
                  </span>
                  <BandPill band={val.band} />
                </div>
                <BandBar band={val.band} />
                {val.strengths_noted && (
                  <p className="text-xs text-[#1F5C4E] bg-[#E7EFEC] rounded-lg px-3 py-2 leading-relaxed">
                    ✓ {val.strengths_noted}
                  </p>
                )}
                <p className="text-xs text-[#5B6266] leading-relaxed">
                  {val.rationale}
                </p>
              </div>
            ))}
          </section>

          {/* Weaknesses */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#23282B]">
              Key weaknesses
            </h2>
            {result.weaknesses.map((w, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[#F7E9DF] text-[#C97B4A] text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#23282B]">
                      {w.issue}
                    </p>
                    <p className="text-xs text-[#5B6266] italic">
                      &ldquo;{w.quoted_example}&rdquo;
                    </p>
                    <p className="text-xs text-[#5B6266]">{w.explanation}</p>
                    <p className="text-xs font-medium text-[#1F5C4E]">
                      Fix: {w.fix}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Vocab upgrades */}
          <section className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-6 shadow-sm space-y-4">
            <h2 className="font-serif text-lg font-semibold text-[#23282B]">
              Vocabulary upgrades
            </h2>
            <div className="space-y-3">
              {result.vocabulary_upgrades.map((v, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="px-3 py-1 rounded-full bg-[#F2EEE5] text-[#5B6266] text-xs font-medium truncate">
                      {v.original}
                    </span>
                    <span className="text-[#C97B4A] text-sm flex-shrink-0">→</span>
                    <span className="px-3 py-1 rounded-full bg-[#E7EFEC] text-[#1F5C4E] text-xs font-semibold truncate">
                      {v.upgrade}
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6266] flex-shrink-0 max-w-[40%]">
                    {v.why}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Model paragraph */}
          <section className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-[#23282B]">
                Band 8 model rewrite
              </h2>
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
                  Band 8 rewrite
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
          <section className="rounded-2xl border border-[#1F5C4E]/20 bg-[#E7EFEC] px-6 py-6 space-y-2">
            <h2 className="font-serif text-lg font-semibold text-[#1F5C4E]">
              Examiner&apos;s verdict
            </h2>
            <p className="text-sm text-[#23282B] leading-relaxed">
              {result.examiner_summary}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
