/**
 * Per-instance in-memory rate limiting. NOT an access control.
 * A single user can exceed this limit by the number of concurrent instances,
 * and a cold start resets the counter entirely. This is a cheap brake on
 * accidental client loops and casual hammering, not an enforced quota.
 */

type Entry = { count: number; resetAt: number };

const limits = new Map<string, Entry>();

/** Maximum map size before we begin targeted eviction. */
const MAX_KEYS = 10000;

/** Track when we last pruned to avoid scanning on every call. */
let lastPruneTime = Date.now();

/**
 * Check whether a key is within its rate limit.
 * Prunes expired entries periodically (once per window, not on every call).
 * If the map grows too large, evicts oldest expired entries first, then by resetAt.
 * @param key User ID or similar identifier
 * @param limit Maximum requests per window
 * @param windowMs Time window in milliseconds
 * @returns { ok: boolean, retryAfterSeconds: number | null }
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSeconds: number | null } {
  const now = Date.now();

  // Prune expired entries at most once per window, not on every call.
  // This keeps the hot path fast while still cleaning up dead entries.
  if (now - lastPruneTime > windowMs) {
    const toDelete: string[] = [];
    for (const [k, entry] of limits.entries()) {
      if (entry.resetAt <= now) {
        toDelete.push(k);
      }
    }
    for (const k of toDelete) {
      limits.delete(k);
    }
    lastPruneTime = now;
  }

  // If map is still too large after pruning, evict oldest entries by resetAt
  // to make room. This ensures all users are not reset at once.
  if (limits.size >= MAX_KEYS) {
    const entries = Array.from(limits.entries());
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    // Evict the oldest 10% to make space
    const toEvict = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < toEvict; i++) {
      limits.delete(entries[i][0]);
    }
  }

  const entry = limits.get(key);

  if (!entry || entry.resetAt <= now) {
    // First request in window or window has expired
    limits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: null };
  }

  // Window is still active
  if (entry.count < limit) {
    entry.count++;
    return { ok: true, retryAfterSeconds: null };
  }

  // Limit exceeded
  const secondsUntilReset = Math.ceil((entry.resetAt - now) / 1000);
  return { ok: false, retryAfterSeconds: secondsUntilReset };
}

/**
 * Clear module state for testing. Resets the limits map and prune timestamp.
 * @internal For testing only.
 */
export function _resetForTesting(): void {
  limits.clear();
  lastPruneTime = Date.now();
}
