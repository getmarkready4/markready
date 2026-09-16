import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getScoringUsage, remainingToday } from "./quota";

it("blocks overlap across midnight while preserving unlimited staff", () => {
  expect(remainingToday("user", 0, true)).toBe(0);
  expect(remainingToday("user", 0, false)).toBe(1);
  expect(remainingToday("user", 1, false)).toBe(0);
  expect(remainingToday("staff", 100, true)).toBeNull();
});

it.each([
  null,
  {},
  { used_successful: -1, active: false, lease_expires_at: null, reset_at: "2026-09-16T00:00:00Z" },
  { used_successful: 0, active: true, lease_expires_at: null, reset_at: "2026-09-16T00:00:00Z" },
  { used_successful: 0, active: false, lease_expires_at: null, reset_at: "invalid" },
])("fails closed for malformed database usage: %j", async (data) => {
  const service = { rpc: () => ({ abortSignal: vi.fn().mockResolvedValue({ data, error: null }) }) } as unknown as SupabaseClient;
  expect(await getScoringUsage(service, "user")).toBeNull();
});

it("preserves the database's usage and handles thrown transport failures", async () => {
  const usage = { used_successful: 0, active: true, lease_expires_at: "2026-09-15T00:04:00Z", reset_at: "2026-09-16T00:00:00Z" };
  const abortSignal = vi.fn().mockResolvedValueOnce({ data: usage, error: null }).mockRejectedValueOnce(new Error("offline"));
  const service = { rpc: () => ({ abortSignal }) } as unknown as SupabaseClient;
  expect(await getScoringUsage(service, "user")).toEqual(usage);
  expect(await getScoringUsage(service, "user")).toBeNull();
});
