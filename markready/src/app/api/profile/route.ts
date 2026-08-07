import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { countUsedTests, remainingTests, isCohort, FREE_TEST_LIMIT } from "@/lib/quota";

/**
 * Where a user says they heard about us. Kept in sync with the options in
 * /welcome — these map to the GTM channel plan so signups are directly
 * comparable to marketing effort per channel.
 */
export const REFERRAL_SOURCES = [
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

/** Current cohort, onboarding state, and quota — used by /score and /welcome. */
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

  const cohort = isCohort(profile?.cohort) ? profile.cohort : "waitlist";
  const used = await countUsedTests(service, user.id);
  if (used === null) {
    return NextResponse.json({ error: "Unable to load your usage" }, { status: 500 });
  }

  return NextResponse.json({
    cohort,
    referral_source: profile?.referral_source ?? null,
    used,
    remaining: remainingTests(cohort, used),
    limit: cohort === "staff" ? null : FREE_TEST_LIMIT,
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
    const { error } = await service
      .from("profiles")
      .update({ upgrade_interest_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.error("Upgrade interest update failed:", error.message);
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

  const { error } = await service
    .from("profiles")
    .update({ referral_source, referral_detail: detail })
    .eq("id", user.id);

  if (error) {
    console.error("Referral source update failed:", error.message);
    return NextResponse.json({ error: "Could not save your answer" }, { status: 500 });
  }

  return NextResponse.json({ referral_source, referral_detail: detail });
}
