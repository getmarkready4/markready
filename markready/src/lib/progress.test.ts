import { describe, it, expect } from "vitest";
import {
  computeBandTrend,
  computeRecurringWeaknesses,
  computeSummary,
  computeStreak,
} from "./progress";
import type { SubmissionRow } from "./progress";
import type { ScoringResult, CriterionKey, CriterionScore, Weakness } from "@/types/scoring";

function makeScoringResult(
  overallBand: number,
  criteria: Partial<Record<string, number>>,
  weakestCriterion: string,
  weaknesses: Array<{ issue: string; index: number; criterion?: string }>
): ScoringResult {
  const criteriaMap: Partial<Record<CriterionKey, CriterionScore>> = {};
  for (const [key, band] of Object.entries(criteria)) {
    if (band !== undefined) {
      criteriaMap[key as CriterionKey] = {
        band,
        strengths_noted: "Good",
        rationale: "Lorem ipsum",
      };
    }
  }

  // Build weaknesses array with provided entries
  // Create up to 3 entries (ScoringResult requires weaknesses to be a 3-tuple, but we only populate what's provided)
  const weaknessesArray: Weakness[] = [];
  const providedIndices = weaknesses.map((w) => w.index);
  const maxIndex = providedIndices.length > 0 ? Math.max(...providedIndices) : -1;
  // Always create at least 3 for type compat, but only populate provided ones
  const createCount = Math.max(3, maxIndex + 1);
  for (let i = 0; i < createCount; i++) {
    const providedWeakness = weaknesses.find((w) => w.index === i);
    weaknessesArray.push({
      criterion: providedWeakness?.criterion ?? (i === 0 ? weakestCriterion : `criterion${i}`),
      issue: providedWeakness?.issue || `default issue ${i}`,
      quoted_example: `example${i}`,
      explanation: `explanation${i}`,
      fix: `fix${i}`,
    });
  }

  return {
    exam: "IELTS",
    word_count: 400,
    overall_band: overallBand,
    criteria: criteriaMap,
    weakest_criterion: weakestCriterion as CriterionKey,
    weaknesses: weaknessesArray,
    vocabulary_upgrades: [
      { original: "a", upgrade: "b", why: "why" },
      { original: "c", upgrade: "d", why: "why" },
      { original: "e", upgrade: "f", why: "why" },
      { original: "g", upgrade: "h", why: "why" },
      { original: "i", upgrade: "j", why: "why" },
    ],
    model_paragraph: {
      target_band: 8,
      criterion_improved: "coherence_cohesion",
      original: "original",
      rewrite: "rewrite",
      changes_explained: "changes",
    },
    examiner_summary: "summary",
  } as ScoringResult;
}

describe("progress.ts functions", () => {
  // Test 1: Most-often-weakest beats worst-average
  it("ranks criterion by timesWeakest, not avgBand", () => {
    const subs: SubmissionRow[] = [
      {
        id: "1",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          5.5,
          { coherence_cohesion: 4.0, lexical_resource: 7.0 },
          "lexical_resource",
          [{ issue: "lex issue 1", index: 0 }]
        ),
        overall_band: 5.5,
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "2",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          6.0,
          { coherence_cohesion: 4.5, lexical_resource: 6.0 },
          "lexical_resource",
          [{ issue: "lex issue 2", index: 0 }]
        ),
        overall_band: 6.0,
        created_at: "2025-01-02T00:00:00Z",
      },
      {
        id: "3",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          6.5,
          { coherence_cohesion: 5.0, lexical_resource: 6.5 },
          "coherence_cohesion",
          [{ issue: "coh issue 3", index: 0 }]
        ),
        overall_band: 6.5,
        created_at: "2025-01-03T00:00:00Z",
      },
    ];

    const weaknesses = computeRecurringWeaknesses(subs);
    expect(weaknesses.length).toBe(2);
    expect(weaknesses[0].criterion).toBe("lexical_resource");
    expect(weaknesses[0].timesWeakest).toBe(2);
    expect(weaknesses[1].criterion).toBe("coherence_cohesion");
    expect(weaknesses[1].timesWeakest).toBe(1);
  });

  // Test 2: Chronological order (oldest→newest)
  it("returns computeBandTrend in chronological order regardless of input order", () => {
    const subs: SubmissionRow[] = [
      {
        id: "3",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          7.0,
          { task_response: 7.0 },
          "task_response",
          [{ issue: "issue", index: 0 }]
        ),
        overall_band: 7.0,
        created_at: "2025-01-03T00:00:00Z",
      },
      {
        id: "1",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          5.5,
          { task_response: 5.5 },
          "task_response",
          [{ issue: "issue", index: 0 }]
        ),
        overall_band: 5.5,
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "2",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          6.0,
          { task_response: 6.0 },
          "task_response",
          [{ issue: "issue", index: 0 }]
        ),
        overall_band: 6.0,
        created_at: "2025-01-02T00:00:00Z",
      },
    ];

    const trend = computeBandTrend(subs);
    expect(trend.length).toBe(3);
    expect(trend[0].overall).toBe(5.5);
    expect(trend[1].overall).toBe(6.0);
    expect(trend[2].overall).toBe(7.0);
  });

  // Test 3a: Degenerate inputs (empty array)
  it("handles empty array without throwing", () => {
    const trend = computeBandTrend([]);
    const weaknesses = computeRecurringWeaknesses([]);
    const summary = computeSummary([]);

    expect(trend).toEqual([]);
    expect(weaknesses).toEqual([]);
    expect(summary).toEqual({
      total: 0,
      latestOverall: null,
      bestOverall: null,
      deltaFromFirst: null,
    });
  });

  // Test 3b: Degenerate inputs (single-row)
  it("handles single-row array without throwing", () => {
    const subs: SubmissionRow[] = [
      {
        id: "1",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          6.5,
          { task_response: 6.5 },
          "task_response",
          [{ issue: "issue", index: 0 }]
        ),
        overall_band: 6.5,
        created_at: "2025-01-01T00:00:00Z",
      },
    ];

    const trend = computeBandTrend(subs);
    const weaknesses = computeRecurringWeaknesses(subs);
    const summary = computeSummary(subs);

    expect(trend).toHaveLength(1);
    expect(trend[0].overall).toBe(6.5);
    expect(weaknesses).toHaveLength(1);
    expect(weaknesses[0].timesWeakest).toBe(1);
    expect(summary.total).toBe(1);
    expect(summary.deltaFromFirst).toBeNull();
  });

  // Test 4: Missing criteria omitted
  it("omits missing criteria from trend (Task 1 no task_achievement)", () => {
    const subs: SubmissionRow[] = [
      {
        id: "1",
        task_type: "TASK1_ACADEMIC",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          6.0,
          {
            task_achievement: 6.0,
            coherence_cohesion: 6.0,
            lexical_resource: 5.5,
            grammatical_range_accuracy: 6.0,
          },
          "lexical_resource",
          [{ issue: "issue", index: 0 }]
        ),
        overall_band: 6.0,
        created_at: "2025-01-01T00:00:00Z",
      },
    ];

    const trend = computeBandTrend(subs);
    expect(trend).toHaveLength(1);
    expect(trend[0].criteria).toEqual({
      task_achievement: 6.0,
      coherence_cohesion: 6.0,
      lexical_resource: 5.5,
      grammatical_range_accuracy: 6.0,
    });
    expect("task_response" in trend[0].criteria).toBe(false);
  });

  // Test 5: Runtime guard against invalid weakest_criterion
  it("skips rows with invalid weakest_criterion", () => {
    const subs: SubmissionRow[] = [
      {
        id: "1",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          6.0,
          { task_response: 6.0 },
          "invalid_criterion",
          [{ issue: "issue", index: 0 }]
        ),
        overall_band: 6.0,
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "2",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          6.5,
          { task_response: 6.5 },
          "task_response",
          [{ issue: "issue", index: 0 }]
        ),
        overall_band: 6.5,
        created_at: "2025-01-02T00:00:00Z",
      },
    ];

    const weaknesses = computeRecurringWeaknesses(subs);
    expect(weaknesses).toHaveLength(1);
    expect(weaknesses[0].criterion).toBe("task_response");
    expect(weaknesses[0].timesWeakest).toBe(1);
  });

  // Test 5b: recentIssues from multiple weaknesses, non-chronological input, with criterion filtering
  it("collects recentIssues from matching-criterion weaknesses, newest rows first", () => {
    // This test verifies that:
    // - Input rows are given in NON-chronological order (newest first in input)
    // - Each row has multiple weakness entries, with issues beyond weaknesses[0]
    // - recentIssues collects up to 3 unique issues from weaknesses matching the group criterion,
    //   processing rows newest→oldest, iterating through all entries in each row's weaknesses array
    // - The group criterion name ("Coherence & Cohesion") matches weaknesses tagged with key form ("coherence_cohesion")
    const subs: SubmissionRow[] = [
      {
        id: "2",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          6.5,
          { coherence_cohesion: 6.5 },
          "coherence_cohesion",
          [
            { issue: "row2 weakness 0", index: 0, criterion: "coherence_cohesion" },
            { issue: "row2 weakness 1", index: 1, criterion: "coherence_cohesion" },
            { issue: "row2 weakness 2", index: 2, criterion: "coherence_cohesion" },
          ]
        ),
        overall_band: 6.5,
        created_at: "2025-01-02T00:00:00Z",
      },
      {
        id: "1",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          6.0,
          { coherence_cohesion: 6.0 },
          "coherence_cohesion",
          [
            { issue: "row1 weakness 0", index: 0, criterion: "coherence_cohesion" },
            { issue: "row1 weakness 1", index: 1, criterion: "coherence_cohesion" },
            { issue: "row1 weakness 2", index: 2, criterion: "coherence_cohesion" },
          ]
        ),
        overall_band: 6.0,
        created_at: "2025-01-01T00:00:00Z",
      },
    ];

    const weaknesses = computeRecurringWeaknesses(subs);
    expect(weaknesses).toHaveLength(1);
    // Collects from newest row first (row2), then older row (row1)
    // Stops at 3 unique issues
    expect(weaknesses[0].recentIssues).toHaveLength(3);
    expect(weaknesses[0].recentIssues[0]).toBe("row2 weakness 0");
    expect(weaknesses[0].recentIssues[1]).toBe("row2 weakness 1");
    expect(weaknesses[0].recentIssues[2]).toBe("row2 weakness 2");
  });

  // Test 5c: Label-form criterion names match key-form group names
  it("matches label-form criterion strings (Task Response) to key-form group names (task_response)", () => {
    // The model emits human labels like "Task Response", but the grouping uses snake_case keys.
    // This test verifies the criterion matching works correctly with both forms.
    const subs: SubmissionRow[] = [
      {
        id: "1",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: {
          ...makeScoringResult(
            6.0,
            { task_response: 6.0 },
            "task_response",
            [{ issue: "issue from task_response", index: 0 }]
          ),
          weaknesses: [
            {
              issue: "issue from task_response",
              criterion: "Task Response",  // Label form
              quoted_example: "example",
              explanation: "explanation",
              fix: "fix",
            },
          ],
        } as ScoringResult,
        overall_band: 6.0,
        created_at: "2025-01-01T00:00:00Z",
      },
    ];

    const weaknesses = computeRecurringWeaknesses(subs);
    expect(weaknesses).toHaveLength(1);
    expect(weaknesses[0].criterion).toBe("task_response");
    expect(weaknesses[0].recentIssues).toHaveLength(1);
    expect(weaknesses[0].recentIssues[0]).toBe("issue from task_response");
  });

  // Test 5d: Fallback when criterion-matching yields zero issues
  it("falls back to all weaknesses when criterion-matching yields zero issues", () => {
    // 2 submissions, both with weakest_criterion = "lexical_resource",
    // each carrying 3 weaknesses ALL tagged criterion = "task_response" (mismatch).
    // First-pass criterion match yields zero; fallback collects all issues.
    const subs: SubmissionRow[] = [
      {
        id: "2",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: {
          ...makeScoringResult(
            6.5,
            { lexical_resource: 6.5 },
            "lexical_resource",
            [
              { issue: "word1", index: 0 },
              { issue: "word2", index: 1 },
              { issue: "word3", index: 2 },
            ]
          ),
          weaknesses: [
            {
              issue: "word1",
              criterion: "task_response",  // Mismatch: group is lexical_resource
              quoted_example: "example",
              explanation: "explanation",
              fix: "fix",
            },
            {
              issue: "word2",
              criterion: "task_response",
              quoted_example: "example",
              explanation: "explanation",
              fix: "fix",
            },
            {
              issue: "word3",
              criterion: "task_response",
              quoted_example: "example",
              explanation: "explanation",
              fix: "fix",
            },
          ],
        } as ScoringResult,
        overall_band: 6.5,
        created_at: "2025-01-02T00:00:00Z",
      },
      {
        id: "1",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: {
          ...makeScoringResult(
            6.0,
            { lexical_resource: 6.0 },
            "lexical_resource",
            [
              { issue: "vocab1", index: 0 },
              { issue: "vocab2", index: 1 },
              { issue: "vocab3", index: 2 },
            ]
          ),
          weaknesses: [
            {
              issue: "vocab1",
              criterion: "task_response",
              quoted_example: "example",
              explanation: "explanation",
              fix: "fix",
            },
            {
              issue: "vocab2",
              criterion: "task_response",
              quoted_example: "example",
              explanation: "explanation",
              fix: "fix",
            },
            {
              issue: "vocab3",
              criterion: "task_response",
              quoted_example: "example",
              explanation: "explanation",
              fix: "fix",
            },
          ],
        } as ScoringResult,
        overall_band: 6.0,
        created_at: "2025-01-01T00:00:00Z",
      },
    ];

    const weaknesses = computeRecurringWeaknesses(subs);
    expect(weaknesses).toHaveLength(1);
    expect(weaknesses[0].criterion).toBe("lexical_resource");
    // Criterion match yielded zero; fallback collected all 3 unique issues from newest row first
    expect(weaknesses[0].recentIssues.length).toBe(3);
    expect(weaknesses[0].recentIssues[0]).toBe("word1");
    expect(weaknesses[0].recentIssues[1]).toBe("word2");
    expect(weaknesses[0].recentIssues[2]).toBe("word3");
  });

  // Test 6: Rows with null scores are skipped
  it("skips rows with scores: null without throwing", () => {
    const subs: SubmissionRow[] = [
      {
        id: "1",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: null, // placeholder row
        overall_band: null,
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "2",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: makeScoringResult(
          6.0,
          { task_response: 6.0 },
          "task_response",
          [{ issue: "issue", index: 0 }]
        ),
        overall_band: 6.0,
        created_at: "2025-01-02T00:00:00Z",
      },
      {
        id: "3",
        task_type: "TASK2",
        question: "q",
        essay: "e",
        scores: null, // another placeholder
        overall_band: null,
        created_at: "2025-01-03T00:00:00Z",
      },
    ];

    const trend = computeBandTrend(subs);
    const weaknesses = computeRecurringWeaknesses(subs);
    const summary = computeSummary(subs);

    expect(trend).toHaveLength(1);
    expect(weaknesses).toHaveLength(1);
    expect(summary.total).toBe(1);
  });
});

describe("computeStreak", () => {
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // Noon UTC keeps each row squarely inside its intended UTC day.
  const dayISO = (offset: number): string =>
    new Date(todayUTC - offset * 86_400_000 + 12 * 3_600_000).toISOString();
  const row = (id: string, offset: number, scored = true): SubmissionRow => ({
    id,
    task_type: "TASK2",
    question: "q",
    essay: "e",
    scores: scored ? ({} as ScoringResult) : null,
    overall_band: scored ? 6 : null,
    created_at: dayISO(offset),
  });

  it("returns 0 for no submissions", () => {
    expect(computeStreak([])).toEqual({ current: 0, activeToday: false });
  });

  it("counts consecutive days ending today", () => {
    // WHY: a live streak must include today and every unbroken prior day
    const r = computeStreak([row("a", 0), row("b", 1), row("c", 2)]);
    expect(r).toEqual({ current: 3, activeToday: true });
  });

  it("keeps yesterday's streak alive but flags not-active-today", () => {
    // WHY: missing today shouldn't break the streak until the day ends — the
    // user can still save it; the UI needs to nudge them (activeToday=false)
    const r = computeStreak([row("a", 1), row("b", 2)]);
    expect(r).toEqual({ current: 2, activeToday: false });
  });

  it("resets to 0 once a full day is missed", () => {
    // WHY: last practice two days ago means the streak has genuinely lapsed
    expect(computeStreak([row("a", 2), row("b", 3)])).toEqual({
      current: 0,
      activeToday: false,
    });
  });

  it("counts a day once even with multiple submissions", () => {
    // WHY: streak is days practised, not essays scored
    const r = computeStreak([row("a", 0), row("b", 0), row("c", 1)]);
    expect(r).toEqual({ current: 2, activeToday: true });
  });

  it("ignores unscored placeholder rows", () => {
    // WHY: an in-flight placeholder (null scores) is not a completed practice —
    // today's placeholder must not count (activeToday=false), but yesterday's
    // real submission still keeps a 1-day streak alive.
    const r = computeStreak([row("a", 0, false), row("b", 1)]);
    expect(r).toEqual({ current: 1, activeToday: false });
  });
});
