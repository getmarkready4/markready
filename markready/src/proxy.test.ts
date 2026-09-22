import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const state = vi.hoisted(() => ({ signedIn: true, cohort: "user", referral: "reddit" as string | null }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: unknown[], headers: Record<string, string>) => void } }) => ({
    auth: { getUser: async () => {
      options.cookies.setAll([{ name: "token.0", value: "fresh", options: { httpOnly: true, path: "/" } }], { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache", "x-middleware-next": "unsafe" });
      options.cookies.setAll([{ name: "token.1", value: "chunk", options: { path: "/" } }], {});
      return { data: { user: state.signedIn ? { id: "user" } : null } };
    } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { cohort: state.cohort, referral_source: state.referral } }) }) }) }),
  }),
}));
beforeEach(() => {
  vi.stubEnv("MAINTENANCE_MODE", "0");
  state.signedIn = true; state.cohort = "user"; state.referral = "reddit";
});

it.each([
  ["/score", false, "reddit", 307, "/login"],
  ["/api/score", false, "reddit", 401, null],
  ["/login", true, "reddit", 307, "/score"],
  ["/login", true, null, 307, "/welcome"],
  ["/score", true, null, 307, "/welcome"],
  ["/welcome", true, "reddit", 307, "/score"],
  ["/score", true, "reddit", 200, null],
  ["/api/score", true, "reddit", 200, null],
  ["/login", false, null, 200, null],
] as const)("preserves all refresh cookies and cache headers on %s (%s, %s)", async (path, signedIn, referral, status, destination) => {
  state.signedIn = signedIn; state.referral = referral;
  const response = await proxy(new NextRequest(`https://example.test${path}`));
  expect(response.status).toBe(status);
  expect(response.cookies.get("token.0")?.value).toBe("fresh");
  expect(response.cookies.get("token.0")?.httpOnly).toBe(true);
  expect(response.cookies.get("token.1")?.value).toBe("chunk");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("expires")).toBe("0");
  expect(response.headers.get("pragma")).toBe("no-cache");
  if (status !== 200) expect(response.headers.has("x-middleware-next")).toBe(false);
  if (destination) expect(response.headers.get("location")).toBe(`https://example.test${destination}`);
});

it("landing page with no auth cookie bypasses Supabase, enabling CDN caching", async () => {
  // WHY: Anonymous visitors to "/" must not call Supabase, so the response
  // can be cached on Vercel CDN. Cache-Control headers prove no Supabase
  // interaction (Supabase would set them to private, no-store).
  state.signedIn = false;
  const req = new NextRequest("https://example.test/");
  const response = await proxy(req);
  // No redirect (200 ok), no cache-disabling headers from Supabase
  expect(response.status).toBe(200);
  expect(response.headers.has("cache-control")).toBe(false);
});

it("landing page with auth cookie and valid session redirects to /score", async () => {
  // WHY: Signed-in users arriving at "/" should land on the app, not the
  // marketing page. We accept one Supabase call for this (stale or forged
  // cookies cost a getUser() call, then we fall through to the landing page).
  state.signedIn = true;
  state.referral = "reddit";
  const req = new NextRequest("https://example.test/", {
    headers: {
      // Realistic Supabase auth cookie name, matching the predicate in proxy.ts
      cookie: "sb-testref-auth-token=valid-session-token; Path=/; HttpOnly",
    },
  });
  const response = await proxy(req);
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("https://example.test/score");
});

it("landing page served under MAINTENANCE_MODE", async () => {
  // WHY: The landing page is marketing material and should remain reachable
  // while the app is locked. A visitor should see the product, not a login wall.
  vi.stubEnv("MAINTENANCE_MODE", "1");
  state.signedIn = false;
  const response = await proxy(new NextRequest("https://example.test/"));
  expect(response.status).toBe(200);
  vi.stubEnv("MAINTENANCE_MODE", "0");
});
