import type { SupabaseClient } from "@supabase/supabase-js";

/** Free scored essays a founding-cohort user gets, lifetime. */
export const FREE_TEST_LIMIT = 2;

export type Cohort = "founding" | "waitlist" | "staff";

export function isCohort(value: unknown): value is Cohort {
  return value === "founding" || value === "waitlist" || value === "staff";
}

/**
 * Lifetime count of tests that have consumed quota for this user.
 *
 * Counts:
 *   - completed scores (`scores is not null`)
 *   - in-flight placeholders younger than 5 minutes
 *
 * Quota is spent on *successful scores*, not attempts: a failed LLM call
 * deletes its placeholder, so it stops being counted. The 5-minute window on
 * null-score rows is a concurrency guard — without it a user could fire N
 * parallel requests and have every one pass the check before any of them
 * finished. Orphaned placeholders from crashed requests age out of the count
 * on their own, so no cleanup job is needed.
 *
 * Mirrors the daily-cap query in /api/score, minus the date floor.
 */
export async function countUsedTests(
  service: SupabaseClient,
  userId: string
): Promise<number | null> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { count, error } = await service
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .or(`scores.not.is.null,created_at.gte.${fiveMinAgo}`);

  if (error) {
    console.error("Quota count failed:", error.message);
    return null;
  }

  return count ?? 0;
}

/** Remaining free tests for display. Staff are unlimited (null). */
export function remainingTests(cohort: Cohort, used: number): number | null {
  if (cohort === "staff") return null;
  return Math.max(0, FREE_TEST_LIMIT - used);
}
