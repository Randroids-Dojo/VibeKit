import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { Redis } from '@upstash/redis'
import {
  getKv,
  readKv,
  removeKv,
  resetKvForTesting,
  writeKv,
} from '../../src/server/kv'

// Minimal Redis-shaped mock satisfying the methods the kit calls.
function makeMock(): Redis & {
  __get: ReturnType<typeof vi.fn>
  __set: ReturnType<typeof vi.fn>
  __del: ReturnType<typeof vi.fn>
} {
  const get = vi.fn()
  const set = vi.fn()
  const del = vi.fn()
  return {
    get,
    set,
    del,
    __get: get,
    __set: set,
    __del: del,
  } as unknown as Redis & {
    __get: ReturnType<typeof vi.fn>
    __set: ReturnType<typeof vi.fn>
    __del: ReturnType<typeof vi.fn>
  }
}

const Schema = z.object({ name: z.string(), score: z.number() })

beforeEach(() => {
  resetKvForTesting()
})

afterEach(() => {
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  resetKvForTesting()
})

describe('getKv', () => {
  it('returns null when KV_REST_API_URL is missing', () => {
    process.env.KV_REST_API_TOKEN = 'token'
    expect(getKv()).toBeNull()
  })

  it('returns null when KV_REST_API_TOKEN is missing', () => {
    process.env.KV_REST_API_URL = 'https://example.upstash.io'
    expect(getKv()).toBeNull()
  })

  it('returns a Redis client when both env vars are populated', () => {
    process.env.KV_REST_API_URL = 'https://example.upstash.io'
    process.env.KV_REST_API_TOKEN = 'token'
    const client = getKv()
    expect(client).not.toBeNull()
  })

  it('supports Upstash Redis env vars', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    const client = getKv()
    expect(client).not.toBeNull()
  })

  it('caches the singleton across calls', () => {
    process.env.KV_REST_API_URL = 'https://example.upstash.io'
    process.env.KV_REST_API_TOKEN = 'token'
    expect(getKv()).toBe(getKv())
  })
})

describe('readKv', () => {
  it('returns the validated value', async () => {
    const kv = makeMock()
    kv.__get.mockResolvedValue({ name: 'a', score: 5 })
    expect(await readKv(kv, 'foo', Schema)).toEqual({ name: 'a', score: 5 })
  })

  it('returns null when the key is missing', async () => {
    const kv = makeMock()
    kv.__get.mockResolvedValue(null)
    expect(await readKv(kv, 'foo', Schema)).toBeNull()
  })

  it('returns null when the value fails the schema', async () => {
    const kv = makeMock()
    kv.__get.mockResolvedValue({ name: 'a', score: 'not a number' })
    expect(await readKv(kv, 'foo', Schema)).toBeNull()
  })

  it('returns null when GET throws', async () => {
    const kv = makeMock()
    kv.__get.mockRejectedValue(new Error('upstream down'))
    expect(await readKv(kv, 'foo', Schema)).toBeNull()
  })
})

describe('writeKv', () => {
  it('returns true and calls SET without options when ttlSec is omitted', async () => {
    const kv = makeMock()
    kv.__set.mockResolvedValue('OK')
    expect(await writeKv(kv, 'foo', { name: 'a', score: 1 })).toBe(true)
    expect(kv.__set).toHaveBeenCalledWith('foo', { name: 'a', score: 1 })
  })

  it('passes ex when ttlSec is positive', async () => {
    const kv = makeMock()
    kv.__set.mockResolvedValue('OK')
    await writeKv(kv, 'foo', { name: 'a', score: 1 }, { ttlSec: 60 })
    expect(kv.__set).toHaveBeenCalledWith(
      'foo',
      { name: 'a', score: 1 },
      { ex: 60 },
    )
  })

  it('returns false when SET throws', async () => {
    const kv = makeMock()
    kv.__set.mockRejectedValue(new Error('quota'))
    expect(await writeKv(kv, 'foo', { x: 1 })).toBe(false)
  })

  it('treats zero or negative ttlSec as no-TTL', async () => {
    const kv = makeMock()
    kv.__set.mockResolvedValue('OK')
    await writeKv(kv, 'foo', { x: 1 }, { ttlSec: 0 })
    expect(kv.__set).toHaveBeenCalledWith('foo', { x: 1 })
  })
})

describe('removeKv', () => {
  it('issues DEL', async () => {
    const kv = makeMock()
    kv.__del.mockResolvedValue(1)
    await removeKv(kv, 'foo')
    expect(kv.__del).toHaveBeenCalledWith('foo')
  })

  it('does not throw when DEL throws', async () => {
    const kv = makeMock()
    kv.__del.mockRejectedValue(new Error('upstream down'))
    await expect(removeKv(kv, 'foo')).resolves.toBeUndefined()
  })
})
