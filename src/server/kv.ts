/**
 * Upstash Redis (KV) helpers. Server-only: imports `@upstash/redis`,
 * reads `process.env.KV_REST_API_URL` and
 * `process.env.KV_REST_API_TOKEN`, and is meant to run in Node /
 * Edge runtimes where those env vars are wired by the platform.
 *
 *   - `getKv()` returns a `Redis` client when both env vars are
 *     populated and `null` otherwise. Returning null lets routes
 *     degrade gracefully in local dev or preview deploys without a
 *     KV binding.
 *   - `readKv<T>(kv, key, schema)` issues a `GET`, validates the
 *     parsed value against a zod schema, and returns `T | null`.
 *     Upstash auto-parses JSON on reads, so we run zod over the
 *     parsed value directly. Throws nothing on failure.
 *   - `writeKv(kv, key, value, opts?)` serializes via `SET`. When
 *     `opts.ttlSec` is supplied the value gets a TTL; otherwise it
 *     persists until evicted or overwritten. Returns `true` on
 *     success, `false` on thrown access.
 *   - `removeKv(kv, key)` issues `DEL` swallowing failures.
 *
 * Locked to `@upstash/redis` because every consumer game already
 * depends on it. If a future consumer needs a different Redis-shaped
 * client, factor out a thinner `Pick<Redis, 'get'|'set'|'del'>`
 * underneath.
 */

import { Redis } from '@upstash/redis'
import type { z } from 'zod'

// Lazy-cached singleton so route handlers do not pay the
// constructor cost per call. The constructor itself is cheap (it
// just stores the url + token), but `null` is also a valid result
// so we cache the resolution explicitly.
let cached: { instance: Redis | null } | null = null

// Returns the configured `Redis` client, or `null` when either of
// `KV_REST_API_URL` / `KV_REST_API_TOKEN` is missing or empty.
// Useful as a feature flag in dev / preview where KV is not bound.
export function getKv(): Redis | null {
  if (cached !== null) return cached.instance
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    cached = { instance: null }
    return null
  }
  cached = { instance: new Redis({ url, token }) }
  return cached.instance
}

// Reset the cached client. Use only in tests; production callers
// should treat the singleton as immutable for the lifetime of the
// runtime.
export function resetKvForTesting(): void {
  cached = null
}

export interface WriteKvOpts {
  // Time-to-live in seconds. When supplied, the key is set with EX
  // so it auto-expires. When omitted, the value persists.
  ttlSec?: number
}

// Read a value from KV and validate it against a zod schema. Returns
// `null` on missing key, schema rejection, or any thrown access.
export async function readKv<T>(
  kv: Redis,
  key: string,
  schema: z.ZodSchema<T>,
): Promise<T | null> {
  let raw: unknown
  try {
    raw = await kv.get(key)
  } catch {
    return null
  }
  if (raw === null || raw === undefined) return null
  const result = schema.safeParse(raw)
  return result.success ? result.data : null
}

// Write a value to KV. Returns `true` on success, `false` on any
// thrown access. When `opts.ttlSec` is supplied the value auto-
// expires; otherwise it persists.
export async function writeKv(
  kv: Redis,
  key: string,
  value: unknown,
  opts: WriteKvOpts = {},
): Promise<boolean> {
  try {
    if (opts.ttlSec !== undefined && opts.ttlSec > 0) {
      await kv.set(key, value, { ex: opts.ttlSec })
    } else {
      await kv.set(key, value)
    }
    return true
  } catch {
    return false
  }
}

// Remove a key. Swallows any thrown access; the eventual-consistency
// model means callers should not block on a failed delete.
export async function removeKv(kv: Redis, key: string): Promise<void> {
  try {
    await kv.del(key)
  } catch {
    // ignore
  }
}
