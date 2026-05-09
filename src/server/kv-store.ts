/**
 * Narrow Redis-shaped client interface for KV-backed feature stores
 * (leaderboards, daily challenges, dedup sets) that need more than the
 * `get` / `set` / `del` surface in `./kv`.
 *
 * This file owns three things:
 *
 *   1. `KvLike` interface. The narrow subset of Redis any compatible
 *      client must implement: hash (`hset` / `hgetall`), sorted set
 *      (`zadd` / `zrange`), `del`, and `set` with NX. Stays narrow on
 *      purpose: adding a new method here is a load-bearing change;
 *      prefer composing on top.
 *
 *   2. `adaptUpstashRedis(redis)` adapter. Takes the `Redis` client
 *      from `@upstash/redis` and returns a `KvLike`. The `set` adapter
 *      maps Upstash's `"OK" | null | string` return to the strict
 *      `"OK" | null` the interface requires (any other string raises a
 *      typed error so misconfigured deploys fail loudly rather than
 *      silently dropping writes).
 *
 *   3. The `KvLike`-shaped argument types for `zadd` and `set`
 *      (`KvLikeZAddOptions`, `KvLikeSetNXOptions`, `KvLikeZAddMember`)
 *      so consumers can type their own thin wrappers without restating
 *      the shapes.
 *
 * Composing a store on top:
 *
 *     import { getKv, adaptUpstashRedis, type KvLike } from
 *       '@randroids-dojo/vibekit/server'
 *
 *     const redis = getKv()
 *     const kv: KvLike | null = redis ? adaptUpstashRedis(redis) : null
 *     // ... pass `kv` into a store factory the consumer owns.
 *
 * Tests: every method has a Map-backed fake under
 * `tests/server/kv-store.test.ts` so consumers can borrow the fake
 * pattern for their own store-level tests.
 */

import type { Redis } from '@upstash/redis'

/** ZADD options. Only `{ nx: true }` is exposed today; sorted-set semantics never need XX/GT/LT/CH at the kit level. */
export type KvLikeZAddOptions = { nx: true } | undefined

/** Sorted-set member descriptor for `zadd`. */
export interface KvLikeZAddMember {
  score: number
  member: string
}

/** SET NX options. Only `{ nx: true }` is exposed; consumers needing TTL on a write should use the `writeKv` helper in `./kv` instead. */
export type KvLikeSetNXOptions = { nx: true }

/**
 * Narrow Redis-shaped client. Lets KV-backed feature stores
 * (leaderboards, dedup sets) accept any compatible client without
 * coupling to one SDK. `@upstash/redis`, `@vercel/kv`, `ioredis`, or
 * a Map-backed test fake all satisfy this shape.
 *
 * All methods are async to match `@upstash/redis` and `@vercel/kv`.
 */
export interface KvLike {
  /**
   * `HSET key field value [field value ...]`. Returns the number of
   * fields that were newly created. Most stores ignore the return
   * value; it is here for symmetry with the underlying clients.
   */
  hset(key: string, value: Record<string, string | number>): Promise<number>
  /**
   * `HGETALL key`. Returns the hash as an object, or `null` when the
   * key does not exist. `null` (not `{}`) is the standard signal for
   * a missing key under both `@upstash/redis` and `@vercel/kv`.
   */
  hgetall(key: string): Promise<Record<string, unknown> | null>
  /**
   * `ZADD key score member`. The `nx` option mirrors `@vercel/kv`'s
   * call shape: `zadd(key, { nx: true }, { score, member })`. Returns
   * the number of new members added (0 when the member already
   * existed under any score), or `null` per the upstream contract.
   */
  zadd(
    key: string,
    options: KvLikeZAddOptions,
    member: KvLikeZAddMember,
  ): Promise<number | null>
  /**
   * `ZRANGE key start stop` returning members ordered by ascending
   * score. 0-based indexes; positive `stop` is inclusive.
   */
  zrange(key: string, start: number, stop: number): Promise<string[]>
  /** `DEL key [key ...]`. Returns the number of keys removed. */
  del(...keys: string[]): Promise<number>
  /**
   * `SET key value NX`. Returns `"OK"` on success, `null` when the key
   * already existed. Used by dedup sets.
   */
  set(key: string, value: string, options: KvLikeSetNXOptions): Promise<'OK' | null>
}

/**
 * Wrap a `@upstash/redis` client in a `KvLike`. The adapter is a thin
 * pass-through except for `set`, where Upstash returns
 * `"OK" | null | string`; the adapter narrows this to the strict
 * `"OK" | null` the `KvLike` contract requires and throws on any other
 * string (so a misconfigured deploy fails loudly rather than silently
 * dropping writes).
 */
export function adaptUpstashRedis(redis: Redis): KvLike {
  return {
    hset(key, value) {
      return redis.hset(key, value)
    },
    hgetall(key) {
      return redis.hgetall(key)
    },
    zadd(key, options, member) {
      if (options === undefined) {
        return redis.zadd(key, member)
      }
      return redis.zadd(key, options, member)
    },
    zrange(key, start, stop) {
      return redis.zrange<string[]>(key, start, stop)
    },
    del(...keys) {
      return redis.del(...keys)
    },
    async set(key, value, options) {
      const result = await redis.set(key, value, options)
      if (result === null || result === 'OK') {
        return result
      }
      throw new Error(
        `adaptUpstashRedis: unexpected SET NX result ${String(result)}`,
      )
    },
  }
}
