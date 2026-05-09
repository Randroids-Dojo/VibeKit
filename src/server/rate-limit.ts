/**
 * Fixed-window rate-limit primitive backed by Redis INCR + EXPIRE.
 * `incrementWithExpiry(kv, key, windowSec)` returns the post-increment
 * count for the key. The first call in a window seeds the counter at
 * 1 and sets a TTL equal to `windowSec`; subsequent calls in the same
 * window increment without resetting the TTL, so the window slides
 * forward only by full `windowSec` boundaries (same behavior as
 * Cloudflare / Upstash documented patterns).
 *
 * Caller decides the policy: compare the returned count against a
 * limit and reject when over. Returning the count rather than a
 * boolean lets the caller surface "you have N requests left in this
 * window" in error messages.
 *
 *   const count = await incrementWithExpiry(kv, `rl:${ip}:start-race`, 60)
 *   if (count > 10) return new Response('rate limited', { status: 429 })
 *
 * Returns `null` when both the INCR and the EXPIRE throw (KV
 * unavailable). Callers MUST treat null as "fail open" or "fail
 * closed" deliberately; this primitive does not pick for them.
 *
 * Notes:
 *   - Fixed-window not sliding-window. A burst exactly at the window
 *     boundary can fire `2 * limit` requests in one second. Use a
 *     proper sliding-window algorithm if you need stricter bounds.
 *   - The TTL is set on the FIRST hit only. Concurrent first-hits
 *     can race; both EXPIRE calls land but the second is a no-op
 *     against an already-expiring key. Acceptable for rate-limit
 *     accuracy.
 *   - Atomicity: INCR + EXPIRE are two round-trips. A crash between
 *     them leaves a counter without a TTL (it persists forever).
 *     Counter keys are application-scoped; if you care, set a
 *     periodic cleanup or use Upstash Lua for true atomicity.
 */

import type { Redis } from '@upstash/redis'

export async function incrementWithExpiry(
  kv: Redis,
  key: string,
  windowSec: number,
): Promise<number | null> {
  if (windowSec <= 0) {
    throw new Error(
      `incrementWithExpiry: windowSec must be positive, got ${windowSec}`,
    )
  }
  let count: number
  try {
    count = await kv.incr(key)
  } catch {
    return null
  }
  if (count === 1) {
    try {
      await kv.expire(key, windowSec)
    } catch {
      // EXPIRE failed but INCR succeeded; the key persists without a
      // TTL until the next manual EXPIRE / DEL. The caller still
      // sees the count and can proceed.
    }
  }
  return count
}
