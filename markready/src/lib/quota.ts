import type { SupabaseClient } from "@supabase/supabase-js";

/** Free scored essays a regular user gets per UTC day. */
export const DAILY_FREE_LIMIT = 1;

export type Cohort = "user" | "staff";

export function isCohort(value: unknown): value is Cohort {
  return value === "user" || value === "staff";
}

export type ScoringUsage = {
  used_successful: number;
  active: boolean;
  lease_expires_at: string | null;
  reset_at: string;
};

/** The database owns both the UTC clock and the reservation usage definition. */
export async function getScoringUsage(
  service: SupabaseClient,
  userId: string
): Promise<ScoringUsage | null> {
  try {
    const { data, error } = await service.rpc("scoring_usage", { p_user_id: userId })
      .abortSignal(AbortSignal.timeout(10_000));
    if (error || !data || !Number.isInteger(data.used_successful) || data.used_successful < 0 ||
        typeof data.active !== "boolean" ||
        typeof data.reset_at !== "string" || !Number.isFinite(Date.parse(data.reset_at)) ||
        !(data.lease_expires_at === null || (typeof data.lease_expires_at === "string" && Number.isFinite(Date.parse(data.lease_expires_at)))) ||
        (data.active && data.lease_expires_at === null)) return null;
    return data as ScoringUsage;
  } catch {
    return null;
  }
}

/** Free marks left today, for display. Staff are unlimited (null). */
export function remainingToday(cohort: Cohort, used: number, active = false): number | null {
  if (cohort === "staff") return null;
  return Math.max(0, DAILY_FREE_LIMIT - used - Number(active));
}
