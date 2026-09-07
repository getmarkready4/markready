import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { countUsedToday, remainingToday, isCohort, DAILY_FREE_LIMIT } from "@/lib/quota";

/**
 * Where a user says they heard about us. Kept in sync with the options in
 * /welcome — these map to the GTM channel plan so signups are directly
 * comparable to marketing effort per channel.
 */
const REFERRAL_SOURCES = [
  "facebook_group",
  "tiktok",
  "youtube",
  "reddit",
  "google_search",
  "friend",
  "review_centre",
  "other",
] as const;

const REFERRAL_SET = new Set<string>(REFERRAL_SOURCES);
const MAX_DETAIL_CHARS = 200;

/**
 * Writes profile fields, recreating the row if it is missing.
 *
 * A plain update against a missing row reports success having changed nothing
 * — which is exactly how a profile cleared in the Table Editor during testing
 * left an account stuck on /welcome forever. So: update first, which keeps
 * everything an existing row already holds; only if nothing matched, insert a
 * fresh row. Returns an error message, or null on success.
 */
async function writeProfile(
  service: SupabaseClient,
  user: User,
  fields: Record<string, unknown>
): Promise<string | null> {
  const { data: updated, error: updateError } = await service
    .from("profiles")
    .update(fields)
    .eq("id", user.id)
    .select("id");
  if (updateError) return updateError.message;
  if (updated && updated.length > 0) return null;

  if (!user.email) return "Account has no email address";
  const { error: insertError } = await service
    .from("profiles")
    .insert({ id: user.id, email: user.email, ...fields });
  return insertError ? insertError.message : null;
}

/** Current cohort, onboarding state, and today's quota — used by /score and /welcome. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: profile, error } = await service
    .from("profiles")
    .select("cohort, referral_source")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Profile read failed:", error.message);
    return NextResponse.json({ error: "Unable to load your profile" }, { status: 500 });
  }

  // Unknown or missing cohort is a regular user: limited, never staff.
  const cohort = isCohort(profile?.cohort) ? profile.cohort : "user";
  const used = await countUsedToday(service, user.id);
  if (used === null) {
    return NextResponse.json({ error: "Unable to load your usage" }, { status: 500 });
  }

  return NextResponse.json({
    cohort,
    referral_source: profile?.referral_source ?? null,
    used,
    remaining: remainingToday(cohort, used),
    limit: cohort === "staff" ? null : DAILY_FREE_LIMIT,
    reset: "midnight UTC",
  });
}

/**
 * Records signup attribution, or interest in a paid plan.
 * Body: { referral_source, referral_detail? } | { upgrade_interest: true }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { referral_source, referral_detail, upgrade_interest } = body as Record<
    string,
    unknown
  >;

  const service = createServiceClient();

  // Interest in a paid plan. No checkout exists yet — this records intent only.
  if (upgrade_interest === true) {
    const failure = await writeProfile(service, user, {
      upgrade_interest_at: new Date().toISOString(),
    });
    if (failure) {
      console.error("Upgrade interest write failed:", failure);
      return NextResponse.json({ error: "Could not record your interest" }, { status: 500 });
    }
    return NextResponse.json({ upgrade_interest: true });
  }

  if (typeof referral_source !== "string" || !REFERRAL_SET.has(referral_source)) {
    return NextResponse.json(
      { error: "referral_source must be one of the listed options" },
      { status: 400 }
    );
  }

  let detail: string | null = null;
  if (referral_detail !== undefined && referral_detail !== null) {
    if (typeof referral_detail !== "string") {
      return NextResponse.json({ error: "referral_detail must be text" }, { status: 400 });
    }
    detail = referral_detail.trim().slice(0, MAX_DETAIL_CHARS) || null;
  }

  const failure = await writeProfile(service, user, {
    referral_source,
    referral_detail: detail,
  });
  if (failure) {
    console.error("Referral source write failed:", failure);
    return NextResponse.json({ error: "Could not save your answer" }, { status: 500 });
  }

  return NextResponse.json({ referral_source, referral_detail: detail });
}
