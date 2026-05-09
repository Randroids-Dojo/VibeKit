import { describe, expect, it, vi } from 'vitest'
import type { Redis } from '@upstash/redis'
import { incrementWithExpiry } from '../../src/server/rate-limit'

function makeMock(): Redis & {
  __incr: ReturnType<typeof vi.fn>
  __expire: ReturnType<typeof vi.fn>
} {
  const incr = vi.fn()
  const expire = vi.fn()
  return {
    incr,
    expire,
    __incr: incr,
    __expire: expire,
  } as unknown as Redis & {
    __incr: ReturnType<typeof vi.fn>
    __expire: ReturnType<typeof vi.fn>
  }
}

describe('incrementWithExpiry', () => {
  it('returns 1 and sets the TTL on the first hit', async () => {
    const kv = makeMock()
    kv.__incr.mockResolvedValue(1)
    kv.__expire.mockResolvedValue(1)
    expect(await incrementWithExpiry(kv, 'rl:abc', 60)).toBe(1)
    expect(kv.__expire).toHaveBeenCalledWith('rl:abc', 60)
  })

  it('returns the incremented count without setting TTL on subsequent hits', async () => {
    const kv = makeMock()
    kv.__incr.mockResolvedValue(7)
    kv.__expire.mockResolvedValue(1)
    expect(await incrementWithExpiry(kv, 'rl:abc', 60)).toBe(7)
    expect(kv.__expire).not.toHaveBeenCalled()
  })

  it('still returns the count when EXPIRE fails after a successful INCR', async () => {
    const kv = makeMock()
    kv.__incr.mockResolvedValue(1)
    kv.__expire.mockRejectedValue(new Error('expire failed'))
    expect(await incrementWithExpiry(kv, 'rl:abc', 60)).toBe(1)
  })

  it('returns null when INCR throws', async () => {
    const kv = makeMock()
    kv.__incr.mockRejectedValue(new Error('upstream down'))
    expect(await incrementWithExpiry(kv, 'rl:abc', 60)).toBeNull()
  })

  it('throws on a non-positive window', async () => {
    const kv = makeMock()
    await expect(incrementWithExpiry(kv, 'rl:abc', 0)).rejects.toThrow()
    await expect(incrementWithExpiry(kv, 'rl:abc', -1)).rejects.toThrow()
  })
})
