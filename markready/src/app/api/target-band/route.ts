import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeProfile } from "@/lib/write-profile";

// Valid IELTS bands a user may target: 4.0–9.0 in 0.5 steps.
const ALLOWED_TARGETS = new Set([4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9]);

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

  const { target } = body as Record<string, unknown>;

  // `null` clears the goal; otherwise must be an allowed band.
  let value: number | null;
  if (target === null) {
    value = null;
  } else if (typeof target === "number" && ALLOWED_TARGETS.has(target)) {
    value = target;
  } else {
    return NextResponse.json(
      { error: "target must be null or a band between 4.0 and 9.0 in 0.5 steps" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const failure = await writeProfile(service, user, { target_band: value });

  if (failure) {
    console.error("Target band update failed:", failure);
    return NextResponse.json({ error: "Could not save your goal" }, { status: 500 });
  }

  return NextResponse.json({ target_band: value });
}
