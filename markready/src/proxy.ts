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

  if (!user) {
    if (request.nextUrl.pathname.startsWith("/api/score")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      request.nextUrl.pathname.startsWith("/score") ||
      request.nextUrl.pathname.startsWith("/dashboard")
    ) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } else {
    if (request.nextUrl.pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/score", request.url));
    }
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
    "/api/score",
    "/api/score/:path*",
  ],
};
