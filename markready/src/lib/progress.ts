import type { ScoringResult, TaskType, CriterionKey } from "@/types/scoring";

export interface SubmissionRow {
  id: string;
  task_type: TaskType;
  question: string | null;
  essay: string | null;
  scores: ScoringResult | null;
  overall_band: number | null;
  created_at: string;
}

const CRITERION_KEYS: CriterionKey[] = [
  "task_response",
  "task_achievement",
  "coherence_cohesion",
  "lexical_resource",
  "grammatical_range_accuracy",
];

function normalizeCriterion(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

export function computeBandTrend(subs: SubmissionRow[]): {
  date: string;
  overall: number | null;
  criteria: Partial<Record<CriterionKey, number>>;
}[] {
  if (subs.length === 0) return [];

  // Sort by created_at ascending (oldest first)
  const sorted = [...subs].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return sorted
    .filter((sub) => sub.scores !== null)
    .map((sub) => {
      const criteria: Partial<Record<CriterionKey, number>> = {};
      for (const key of CRITERION_KEYS) {
        if (sub.scores && key in sub.scores.criteria) {
          const score = sub.scores.criteria[key];
          if (score && "band" in score) {
            criteria[key] = score.band;
          }
        }
      }
      return {
        date: sub.created_at,
        overall: sub.overall_band,
        criteria,
      };
    });
}

export function computeRecurringWeaknesses(subs: SubmissionRow[]): {
  criterion: CriterionKey;
  timesWeakest: number;
  avgBand: number;
  recentIssues: string[];
}[] {
  if (subs.length === 0) return [];

  // Group by weakest_criterion
  const groups: Record<
    string,
    { rows: SubmissionRow[]; band_sum: number; band_count: number }
  > = {};

  for (const sub of subs) {
    // Skip rows with null scores (in-flight placeholders)
    if (sub.scores === null) {
      continue;
    }

    const weakest = sub.scores.weakest_criterion;
    // Runtime guard: skip if weakest_criterion is not in CRITERION_KEYS
    if (!CRITERION_KEYS.includes(weakest as CriterionKey)) {
      continue;
    }

    if (!groups[weakest]) {
      groups[weakest] = { rows: [], band_sum: 0, band_count: 0 };
    }
    groups[weakest].rows.push(sub);

    // Accumulate band for this criterion
    // Use explicit null check (band != null) so a band of 0 is not excluded
    if (
      weakest in sub.scores.criteria &&
      sub.scores.criteria[weakest as CriterionKey]?.band != null
    ) {
      const band = sub.scores.criteria[weakest as CriterionKey]!.band;
      groups[weakest].band_sum += band;
      groups[weakest].band_count += 1;
    }
  }

  const results = Object.entries(groups).map(([criterion, { rows, band_sum, band_count }]) => {
    // Collect up to 3 recent issues from weaknesses in each row.
    // First pass: only weaknesses where criterion matches the group criterion (normalized).
    // If that yields zero issues, fall back to all weaknesses.
    // Sort rows newest→oldest (descending created_at) internally within the function,
    // then iterate through each row's full weaknesses array in order, collecting unique issues
    // until 3 found. This ensures newest submissions' issues appear first and captures issues
    // beyond weaknesses[0] when applicable. Exact-string deduplication across all rows.
    const sortedRows = [...rows].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const normalizedCriterionName = normalizeCriterion(criterion);

    // First pass: filter by matching criterion
    const issues: string[] = [];
    for (const row of sortedRows) {
      if (row.scores && row.scores.weaknesses) {
        for (const weakness of row.scores.weaknesses) {
          if (
            weakness.issue &&
            !issues.includes(weakness.issue) &&
            normalizeCriterion(weakness.criterion) === normalizedCriterionName
          ) {
            issues.push(weakness.issue);
            if (issues.length === 3) break;
          }
        }
      }
      if (issues.length === 3) break;
    }

    // Fallback: if zero issues found, collect all weaknesses
    if (issues.length === 0) {
      for (const row of sortedRows) {
        if (row.scores && row.scores.weaknesses) {
          for (const weakness of row.scores.weaknesses) {
            if (weakness.issue && !issues.includes(weakness.issue)) {
              issues.push(weakness.issue);
              if ((issues as Array<string>).length === 3) break;
            }
          }
        }
        if ((issues as Array<string>).length === 3) break;
      }
    }

    return {
      criterion: criterion as CriterionKey,
      timesWeakest: rows.length,
      avgBand: band_count > 0 ? band_sum / band_count : 0,
      recentIssues: issues,
    };
  });

  // Sort by timesWeakest descending
  results.sort((a, b) => b.timesWeakest - a.timesWeakest);

  return results;
}

export function computeSummary(subs: SubmissionRow[]): {
  total: number;
  latestOverall: number | null;
  bestOverall: number | null;
  deltaFromFirst: number | null;
} {
  // Filter out rows with null scores (in-flight placeholders)
  const validSubs = subs.filter((sub) => sub.scores !== null);

  if (validSubs.length === 0) {
    return {
      total: 0,
      latestOverall: null,
      bestOverall: null,
      deltaFromFirst: null,
    };
  }

  // Sort by created_at (newest first for latest, chronological for first)
  const byDate = [...validSubs].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const latest = byDate[0].overall_band ?? null;

  let best: number | null = null;
  for (const sub of validSubs) {
    if (sub.overall_band !== null) {
      if (best === null || sub.overall_band > best) {
        best = sub.overall_band;
      }
    }
  }

  let delta: number | null = null;
  if (validSubs.length >= 2) {
    const chrono = [...validSubs].sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    const first = chrono[0].overall_band;
    const last = chrono[chrono.length - 1].overall_band;
    if (first !== null && last !== null) {
      delta = last - first;
    }
  }

  return {
    total: validSubs.length,
    latestOverall: latest,
    bestOverall: best,
    deltaFromFirst: delta,
  };
}
