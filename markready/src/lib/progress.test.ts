import { describe, it, expect } from "vitest";
import {
  computeBandTrend,
  computeRecurringWeaknesses,
  computeSummary,
} from "./progress";
import type { SubmissionRow } from "./progress";
import type { ScoringResult, CriterionKey, CriterionScore, Weakness } from "@/types/scoring";

function makeScoringResult(
  overallBand: number,
  criteria: Partial<Record<string, number>>,
  weakestCriterion: string,
  weaknesses: Array<{ issue: string; index: number }>
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
      criterion: i === 0 ? weakestCriterion : `criterion${i}`,
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
    weaknesses: weaknessesArray as unknown as [Weakness, Weakness, Weakness],
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
  };
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

  // Test 5b: recentIssues from multiple weaknesses, non-chronological input
  it("collects recentIssues from all weakness entries, newest rows first", () => {
    // This test verifies that:
    // - Input rows are given in NON-chronological order (newest first in input)
    // - Each row has multiple weakness entries, with issues beyond weaknesses[0]
    // - recentIssues collects up to 3 unique issues, processing rows newest→oldest,
    //   iterating through all entries in each row's weaknesses array
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
            { issue: "row2 weakness 0", index: 0 },
            { issue: "row2 weakness 1", index: 1 },
            { issue: "row2 weakness 2", index: 2 },
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
            { issue: "row1 weakness 0", index: 0 },
            { issue: "row1 weakness 1", index: 1 },
            { issue: "row1 weakness 2", index: 2 },
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
