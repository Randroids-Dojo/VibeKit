import { describe, it, expect, vi } from 'vitest'
import {
  adaptUpstashRedis,
  type KvLike,
} from '../../src/server/kv-store'

/**
 * Build a Map-backed fake KvLike. Stores hashes in `hashes`, sorted
 * sets in `zsets` (sorted on insert by score), and string values in
 * `strings`. Only the operations defined on `KvLike` are implemented;
 * the goal is to be a reference implementation consumers can borrow
 * for their own store-level tests.
 */
function makeFakeKv(): KvLike {
  const hashes = new Map<string, Record<string, unknown>>()
  const zsets = new Map<string, { score: number; member: string }[]>()
  const strings = new Map<string, string>()

  return {
    async hset(key, value) {
      const existing = hashes.get(key) ?? {}
      let added = 0
      for (const [field, v] of Object.entries(value)) {
        if (!(field in existing)) added += 1
        existing[field] = v
      }
      hashes.set(key, existing)
      return added
    },
    async hgetall(key) {
      const v = hashes.get(key)
      return v ? { ...v } : null
    },
    async zadd(key, options, member) {
      const set = zsets.get(key) ?? []
      const idx = set.findIndex((m) => m.member === member.member)
      if (idx !== -1) {
        if (options?.nx) return 0
        set[idx] = member
      } else {
        set.push(member)
      }
      set.sort((a, b) => a.score - b.score)
      zsets.set(key, set)
      return idx === -1 ? 1 : 0
    },
    async zrange(key, start, stop) {
      const set = zsets.get(key) ?? []
      return set.slice(start, stop + 1).map((m) => m.member)
    },
    async del(...keys) {
      let removed = 0
      for (const k of keys) {
        if (hashes.delete(k)) removed += 1
        if (zsets.delete(k)) removed += 1
        if (strings.delete(k)) removed += 1
      }
      return removed
    },
    async set(key, value, options) {
      if (options.nx && strings.has(key)) return null
      strings.set(key, value)
      return 'OK'
    },
  }
}

describe('KvLike fake (reference implementation)', () => {
  it('hset / hgetall round-trip and report newly-added field count', async () => {
    const kv = makeFakeKv()
    expect(await kv.hset('k', { a: 1, b: '2' })).toBe(2)
    expect(await kv.hgetall('k')).toEqual({ a: 1, b: '2' })
    // Update one field, add another
    expect(await kv.hset('k', { a: 9, c: 'z' })).toBe(1)
    expect(await kv.hgetall('k')).toEqual({ a: 9, b: '2', c: 'z' })
  })

  it('hgetall returns null for a missing key', async () => {
    const kv = makeFakeKv()
    expect(await kv.hgetall('missing')).toBeNull()
  })

  it('zadd inserts in score order and zrange returns members ascending', async () => {
    const kv = makeFakeKv()
    await kv.zadd('lb', undefined, { score: 30, member: 'c' })
    await kv.zadd('lb', undefined, { score: 10, member: 'a' })
    await kv.zadd('lb', undefined, { score: 20, member: 'b' })
    expect(await kv.zrange('lb', 0, 10)).toEqual(['a', 'b', 'c'])
  })

  it('zadd nx leaves an existing member unchanged', async () => {
    const kv = makeFakeKv()
    expect(await kv.zadd('lb', undefined, { score: 100, member: 'a' })).toBe(1)
    // Reattempting with NX is a no-op
    expect(
      await kv.zadd('lb', { nx: true }, { score: 999, member: 'a' }),
    ).toBe(0)
    expect(await kv.zrange('lb', 0, 10)).toEqual(['a'])
  })

  it('set NX returns OK once and null on the second attempt', async () => {
    const kv = makeFakeKv()
    expect(await kv.set('dedup:1', 'x', { nx: true })).toBe('OK')
    expect(await kv.set('dedup:1', 'y', { nx: true })).toBeNull()
  })

  it('del removes hash, zset, and string keys and returns the count', async () => {
    const kv = makeFakeKv()
    await kv.hset('h', { a: 1 })
    await kv.zadd('z', undefined, { score: 1, member: 'm' })
    await kv.set('s', 'v', { nx: true })
    expect(await kv.del('h', 'z', 's', 'missing')).toBe(3)
    expect(await kv.hgetall('h')).toBeNull()
    expect(await kv.zrange('z', 0, 10)).toEqual([])
  })
})

describe('adaptUpstashRedis', () => {
  function makeUpstashSpy(overrides: Record<string, unknown> = {}) {
    return {
      hset: vi.fn().mockResolvedValue(2),
      hgetall: vi.fn().mockResolvedValue({ a: 1 }),
      zadd: vi.fn().mockResolvedValue(1),
      zrange: vi.fn().mockResolvedValue(['x']),
      del: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue('OK'),
      ...overrides,
    } as unknown as Parameters<typeof adaptUpstashRedis>[0]
  }

  it('forwards hset / hgetall / zrange / del calls verbatim', async () => {
    const spy = makeUpstashSpy()
    const kv = adaptUpstashRedis(spy)
    await kv.hset('k', { a: 1 })
    await kv.hgetall('k')
    await kv.zrange('z', 0, 5)
    await kv.del('a', 'b')
    expect(spy.hset).toHaveBeenCalledWith('k', { a: 1 })
    expect(spy.hgetall).toHaveBeenCalledWith('k')
    expect(spy.zrange).toHaveBeenCalledWith('z', 0, 5)
    expect(spy.del).toHaveBeenCalledWith('a', 'b')
  })

  it('routes zadd through both signatures depending on the options flag', async () => {
    const spy = makeUpstashSpy()
    const kv = adaptUpstashRedis(spy)
    await kv.zadd('z', undefined, { score: 1, member: 'a' })
    expect(spy.zadd).toHaveBeenLastCalledWith('z', { score: 1, member: 'a' })
    await kv.zadd('z', { nx: true }, { score: 2, member: 'b' })
    expect(spy.zadd).toHaveBeenLastCalledWith(
      'z',
      { nx: true },
      { score: 2, member: 'b' },
    )
  })

  it('narrows set NX results to "OK" | null', async () => {
    const spyOk = makeUpstashSpy({
      set: vi.fn().mockResolvedValue('OK'),
    })
    const spyNull = makeUpstashSpy({
      set: vi.fn().mockResolvedValue(null),
    })
    expect(await adaptUpstashRedis(spyOk).set('k', 'v', { nx: true })).toBe('OK')
    expect(await adaptUpstashRedis(spyNull).set('k', 'v', { nx: true })).toBeNull()
  })

  it('throws on an unexpected SET return value rather than silently coercing', async () => {
    const spy = makeUpstashSpy({
      set: vi.fn().mockResolvedValue('UNEXPECTED'),
    })
    await expect(adaptUpstashRedis(spy).set('k', 'v', { nx: true })).rejects.toThrow(
      /unexpected SET NX result/,
    )
  })
})
