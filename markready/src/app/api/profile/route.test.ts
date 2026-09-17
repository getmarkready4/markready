import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ user: vi.fn(), profile: vi.fn(), usage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.user } }) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
  rpc: () => ({ abortSignal: mocks.usage }),
}) }));
const usage = {
  used_successful: 0, free_used: 0, free_remaining: 2, pack_remaining: 0, remaining: 2,
  active: false, lease_expires_at: null, next_expiry_at: null,
};
const pack = { marks: 20, days: 30, price_usd: 20 };
beforeEach(() => {
  mocks.user.mockResolvedValue({ data: { user: { id: "user" } } });
  mocks.profile.mockResolvedValue({ data: { cohort: "user", referral_source: "reddit" }, error: null });
  mocks.usage.mockResolvedValue({ data: usage, error: null });
});

it.each([
  ["user", usage, 2],
  ["user", { ...usage, used_successful: 2, free_used: 2, free_remaining: 0, remaining: 0 }, 0],
  ["user", { ...usage, used_successful: 2, free_used: 2, free_remaining: 0, pack_remaining: 20, remaining: 20, next_expiry_at: "2026-10-17T00:00:00Z" }, 20],
  ["user", { ...usage, free_remaining: 1, remaining: 1, active: true, lease_expires_at: "2026-09-18T00:04:00Z" }, 1],
  ["staff", { ...usage, used_successful: 9 }, null],
  ["unknown", usage, 2],
] as const)("returns the fixed allowance contract for %s (%j)", async (cohort, state, remaining) => {
  mocks.profile.mockResolvedValue({ data: { cohort }, error: null });
  mocks.usage.mockResolvedValue({ data: state, error: null });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({
    ...state, user_id: "user", remaining, cohort: cohort === "staff" ? "staff" : "user",
    limit: cohort === "staff" ? null : 2, pack,
  });
});

it("does not represent a missing migration as unused quota", async () => {
  mocks.usage.mockResolvedValue({ data: null, error: { message: "function missing" } });
  expect((await GET()).status).toBe(500);
});

it("requires an authenticated account before returning quota", async () => {
  mocks.user.mockResolvedValue({ data: { user: null } });
  expect((await GET()).status).toBe(401);
});
