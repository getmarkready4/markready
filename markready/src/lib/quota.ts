import type { SupabaseClient } from "@supabase/supabase-js";

/** Free scored essays a regular user gets per UTC day. */
export const DAILY_FREE_LIMIT = 1;

export type Cohort = "user" | "staff";

export function isCohort(value: unknown): value is Cohort {
  return value === "user" || value === "staff";
}

/**
 * Tests that have consumed today's quota for this user (UTC day).
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
 */
export async function countUsedToday(
  service: SupabaseClient,
  userId: string
): Promise<number | null> {
  const utcMidnight = new Date();
  utcMidnight.setUTCHours(0, 0, 0, 0);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { count, error } = await service
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", utcMidnight.toISOString())
    .or(`scores.not.is.null,created_at.gte.${fiveMinAgo}`);

  if (error) {
    console.error("Quota count failed:", error.message);
    return null;
  }

  return count ?? 0;
}

/** Free marks left today, for display. Staff are unlimited (null). */
export function remainingToday(cohort: Cohort, used: number): number | null {
  if (cohort === "staff") return null;
  return Math.max(0, DAILY_FREE_LIMIT - used);
}
