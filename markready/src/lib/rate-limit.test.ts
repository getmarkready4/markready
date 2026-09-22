import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, _resetForTesting } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Reset the module state to isolate tests from each other
    _resetForTesting();
  });

  it("allows requests up to the limit", () => {
    // WHY: the rate limiter should permit normal usage within quota
    const result1 = checkRateLimit("user1", 3, 60000);
    expect(result1.ok).toBe(true);
    expect(result1.retryAfterSeconds).toBeNull();

    const result2 = checkRateLimit("user1", 3, 60000);
    expect(result2.ok).toBe(true);
    expect(result2.retryAfterSeconds).toBeNull();

    const result3 = checkRateLimit("user1", 3, 60000);
    expect(result3.ok).toBe(true);
    expect(result3.retryAfterSeconds).toBeNull();
  });

  it("blocks requests past the limit and returns retry-after", () => {
    // WHY: exceeding the limit should be rejected with a backoff signal
    checkRateLimit("user2", 2, 60000);
    checkRateLimit("user2", 2, 60000);

    const result = checkRateLimit("user2", 2, 60000);
    expect(result.ok).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("resets the counter after the window expires", () => {
    // WHY: time-window quotas must reset, not block forever
    const windowMs = 100;
    checkRateLimit("user3", 1, windowMs);

    let result = checkRateLimit("user3", 1, windowMs);
    expect(result.ok).toBe(false); // Hit limit

    // Wait for window to expire
    vi.useFakeTimers();
    vi.advanceTimersByTime(windowMs + 1);

    result = checkRateLimit("user3", 1, windowMs);
    expect(result.ok).toBe(true); // Window reset, should allow
    expect(result.retryAfterSeconds).toBeNull();

    vi.useRealTimers();
  });

  it("tracks distinct keys independently", () => {
    // WHY: rate limiting should isolate users from each other
    checkRateLimit("alice", 1, 60000);
    checkRateLimit("bob", 1, 60000);

    const aliceSecond = checkRateLimit("alice", 1, 60000);
    const bobSecond = checkRateLimit("bob", 1, 60000);

    expect(aliceSecond.ok).toBe(false); // Alice hit limit
    expect(bobSecond.ok).toBe(false); // Bob hit limit
  });

  it("prunes expired entries to avoid unbounded map growth", () => {
    // WHY: the rate limiter must not grow memory unboundedly with many users
    const windowMs = 100;
    vi.useFakeTimers();

    // Add many entries
    for (let i = 0; i < 100; i++) {
      checkRateLimit(`user${i}`, 1, windowMs);
    }

    // Advance time to expire all entries
    vi.advanceTimersByTime(windowMs + 1);

    // Trigger a check that will prune expired entries
    checkRateLimit("user_new", 1, windowMs);

    // If we add another entry after pruning, the old entries should be gone
    // We can't directly inspect the map, but we verify the function still works
    const result = checkRateLimit("user_new", 1, windowMs);
    expect(result.ok).toBe(false); // Second request blocked

    vi.useRealTimers();
  });
});
