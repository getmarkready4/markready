import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getScoringUsage, remainingMarks, isCohort, FREE_MARKS_TOTAL, PACK_MARKS, PACK_DAYS, PACK_PRICE_USD } from "@/lib/quota";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeProfile } from "@/lib/write-profile";

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

/** Current cohort, onboarding state, and marks allowance — used by /score and /welcome. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 30 GET requests per minute per user
  const limit = checkRateLimit(user.id, 30, 60000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

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
  const usage = await getScoringUsage(service, user.id);
  if (usage === null) {
    return NextResponse.json({ error: "Unable to load your usage" }, { status: 500 });
  }

  return NextResponse.json({
    user_id: user.id,
    cohort,
    referral_source: profile?.referral_source ?? null,
    ...usage,
    remaining: remainingMarks(cohort, usage),
    limit: cohort === "staff" ? null : FREE_MARKS_TOTAL,
    pack: { marks: PACK_MARKS, days: PACK_DAYS, price_usd: PACK_PRICE_USD },
  }, { headers: { "Cache-Control": "private, no-store" } });
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

  // Rate limit: 10 POST requests per minute per user
  const limit = checkRateLimit(user.id, 10, 60000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
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
