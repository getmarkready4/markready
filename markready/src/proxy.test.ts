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
