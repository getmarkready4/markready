import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Free successful marks per account, lifetime. The enforcing copy of this
 * number lives inside the database function `scoring_usage`; this one is for
 * display and must be kept in step with it.
 */
export const FREE_MARKS_TOTAL = 2;

/** The paid plan: one pack, bought outright, valid from the day of purchase. */
export const PACK_MARKS = 20;
export const PACK_DAYS = 30;
export const PACK_PRICE_USD = 20;

export type Cohort = "user" | "staff";

export function isCohort(value: unknown): value is Cohort {
  return value === "user" || value === "staff";
}

export type ScoringUsage = {
  /** Completed marks, lifetime, from any source. */
  used_successful: number;
  free_used: number;
  free_remaining: number;
  /** Marks left across unexpired, unrevoked packs. */
  pack_remaining: number;
  /** Marks that can be started right now: free plus pack, minus any in flight. */
  remaining: number;
  active: boolean;
  lease_expires_at: string | null;
  /** Earliest expiry among packs that still hold marks; null when none. */
  next_expiry_at: string | null;
};

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isIsoOrNull = (v: unknown): v is string | null =>
  v === null || (typeof v === "string" && Number.isFinite(Date.parse(v)));

/**
 * The database owns the allowance definition; this validates its shape and
 * returns only the fields that form the app's contract. Anything else the
 * function emits (such as the transitional `reset_at`) is dropped here.
 */
export async function getScoringUsage(
  service: SupabaseClient,
  userId: string
): Promise<ScoringUsage | null> {
  try {
    const { data, error } = await service.rpc("scoring_usage", { p_user_id: userId })
      .abortSignal(AbortSignal.timeout(10_000));
    if (error || !data ||
        !isCount(data.used_successful) || !isCount(data.free_used) ||
        !isCount(data.free_remaining) || !isCount(data.pack_remaining) || !isCount(data.remaining) ||
        typeof data.active !== "boolean" ||
        !isIsoOrNull(data.lease_expires_at) || !isIsoOrNull(data.next_expiry_at) ||
        (data.active && data.lease_expires_at === null)) return null;
    return {
      used_successful: data.used_successful,
      free_used: data.free_used,
      free_remaining: data.free_remaining,
      pack_remaining: data.pack_remaining,
      remaining: data.remaining,
      active: data.active,
      lease_expires_at: data.lease_expires_at,
      next_expiry_at: data.next_expiry_at,
    };
  } catch {
    return null;
  }
}

/** Marks left, for display. Staff are unlimited (null). */
export function remainingMarks(cohort: Cohort, usage: Pick<ScoringUsage, "remaining">): number | null {
  if (cohort === "staff") return null;
  return usage.remaining;
}
