import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE === "1") {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }
    if (request.nextUrl.pathname.startsWith("/login")) {
      return NextResponse.next({ request });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  const isLogin = path.startsWith("/login");
  const isWelcome = path.startsWith("/welcome");
  const isUpgrade = path.startsWith("/upgrade");
  const isAppRoute = path.startsWith("/score") || path.startsWith("/dashboard");

  if (!user) {
    if (path.startsWith("/api/score")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isAppRoute || isWelcome || isUpgrade) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return supabaseResponse;
  }

  // API routes enforce cohort and quota themselves (see /api/score) — skip the
  // profile lookup here so we don't add a round-trip to every scoring request.
  if (isApi) return supabaseResponse;

  // Onboarding gate. Quota is deliberately NOT checked here: it needs a
  // submissions count, and paying that on every page load isn't worth it.
  // /api/score returns `quota_exhausted` and the client routes to /upgrade.
  //
  // A missing profile row (e.g. cleared during testing) is treated as
  // not-yet-onboarded; /welcome recreates the row when the answer is saved.
  const { data: profile } = await supabase
    .from("profiles")
    .select("cohort, referral_source")
    .eq("id", user.id)
    .maybeSingle();

  const needsOnboarding = profile?.cohort !== "staff" && !profile?.referral_source;
  const home = needsOnboarding ? "/welcome" : "/score";

  if (isLogin) {
    return NextResponse.redirect(new URL(home, request.url));
  }
  if (needsOnboarding && !isWelcome) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }
  if (!needsOnboarding && isWelcome) {
    return NextResponse.redirect(new URL("/score", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/login",
    "/login/:path*",
    "/score",
    "/score/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/welcome",
    "/upgrade",
    "/api/score",
    "/api/score/:path*",
  ],
};
