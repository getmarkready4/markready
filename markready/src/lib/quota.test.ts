import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getScoringUsage, remainingMarks, FREE_MARKS_TOTAL, PACK_MARKS, PACK_DAYS, PACK_PRICE_USD } from "./quota";

const usage = {
  used_successful: 0, free_used: 0, free_remaining: 2, pack_remaining: 0, remaining: 2,
  active: false, lease_expires_at: null, next_expiry_at: null,
};

it("mirrors the database's allowance and keeps staff unlimited", () => {
  // WHY: the plan is 2 free marks for life and a 20-mark, 30-day, US$20 pack;
  // the display constants must not drift from what the database enforces
  expect([FREE_MARKS_TOTAL, PACK_MARKS, PACK_DAYS, PACK_PRICE_USD]).toEqual([2, 20, 30, 20]);
  expect(remainingMarks("user", { remaining: 2 })).toBe(2);
  expect(remainingMarks("user", { remaining: 0 })).toBe(0);
  expect(remainingMarks("staff", { remaining: 0 })).toBeNull();
});

it.each([
  null,
  {},
  { ...usage, used_successful: -1 },
  { ...usage, pack_remaining: "20" },
  { ...usage, active: true, lease_expires_at: null },
  { ...usage, next_expiry_at: "invalid" },
])("fails closed for malformed database usage: %j", async (data) => {
  const service = { rpc: () => ({ abortSignal: vi.fn().mockResolvedValue({ data, error: null }) }) } as unknown as SupabaseClient;
  expect(await getScoringUsage(service, "user")).toBeNull();
});

it("returns only the contract fields and handles thrown transport failures", async () => {
  // WHY: the database still emits a transitional reset_at for the previous
  // deployment; the app must neither require it nor pass it on
  const fromDb = { ...usage, active: true, lease_expires_at: "2026-09-18T00:04:00Z", reset_at: "2026-09-18T00:00:00Z" };
  const abortSignal = vi.fn().mockResolvedValueOnce({ data: fromDb, error: null }).mockRejectedValueOnce(new Error("offline"));
  const service = { rpc: () => ({ abortSignal }) } as unknown as SupabaseClient;
  expect(await getScoringUsage(service, "user")).toEqual({ ...usage, active: true, lease_expires_at: "2026-09-18T00:04:00Z" });
  expect(await getScoringUsage(service, "user")).toBeNull();
});
