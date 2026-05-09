import { describe, it, expect } from 'vitest'
import {
  createRng,
  deserializeRng,
  gauss,
  makeRng,
  pick,
  range,
  serializeRng,
  splitRng,
} from '../src/rng'

describe('makeRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = makeRng(42)
    const b = makeRng(42)
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b())
    }
  })

  it('produces different sequences for different seeds', () => {
    const a = makeRng(1)
    const b = makeRng(2)
    let allEqual = true
    for (let i = 0; i < 10; i++) {
      if (a() !== b()) {
        allEqual = false
        break
      }
    }
    expect(allEqual).toBe(false)
  })

  it('only emits floats in [0, 1)', () => {
    const r = makeRng(123)
    for (let i = 0; i < 1000; i++) {
      const x = r()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('treats seed 0 as if it were 1 so the generator does not stall', () => {
    const a = makeRng(0)
    const b = makeRng(1)
    expect(a()).toBe(b())
  })
})

describe('range', () => {
  it('returns values in [lo, hi)', () => {
    const r = makeRng(7)
    for (let i = 0; i < 200; i++) {
      const v = range(r, 5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThan(10)
    }
  })
})

describe('pick', () => {
  it('returns one of the supplied items', () => {
    const items = ['a', 'b', 'c']
    const r = makeRng(99)
    for (let i = 0; i < 50; i++) {
      const item = pick(r, items)
      expect(items).toContain(item)
    }
  })

  it('returns undefined for an empty array', () => {
    expect(pick(makeRng(1), [])).toBeUndefined()
  })
})

describe('gauss', () => {
  it('produces a roughly zero-mean standard-normal distribution over many samples', () => {
    const r = makeRng(2024)
    let sum = 0
    let sumSq = 0
    const n = 10000
    for (let i = 0; i < n; i++) {
      const x = gauss(r)
      sum += x
      sumSq += x * x
    }
    const mean = sum / n
    const variance = sumSq / n - mean * mean
    expect(Math.abs(mean)).toBeLessThan(0.05)
    expect(Math.abs(variance - 1)).toBeLessThan(0.1)
  })
})

describe('createRng', () => {
  it('produces the same sequence for the same seed across instances', () => {
    const a = createRng(42)
    const b = createRng(42)
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  it('exposes a serialisable state that advances with every call', () => {
    const r = createRng(123)
    const s0 = r.state
    r.next()
    expect(r.state).not.toBe(s0)
  })

  it('throws on NaN, Infinity, and non-numeric seeds', () => {
    expect(() => createRng(Number.NaN)).toThrow()
    expect(() => createRng(Number.POSITIVE_INFINITY)).toThrow()
    // @ts-expect-error: testing runtime guard
    expect(() => createRng('nope')).toThrow()
  })
})

describe('Rng.nextInt', () => {
  it('returns integers uniformly within [min, maxExclusive)', () => {
    const r = createRng(1)
    for (let i = 0; i < 200; i++) {
      const v = r.nextInt(3, 7)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThan(7)
    }
  })

  it('throws when the range is empty or non-integer', () => {
    const r = createRng(1)
    expect(() => r.nextInt(5, 5)).toThrow()
    expect(() => r.nextInt(5, 4)).toThrow()
    expect(() => r.nextInt(0.5, 3)).toThrow()
  })
})

describe('Rng.nextBool', () => {
  it('always advances state, even on edge probabilities, so replays line up', () => {
    const r = createRng(1)
    const s0 = r.state
    r.nextBool(0)
    const s1 = r.state
    r.nextBool(1)
    const s2 = r.state
    expect(s0).not.toBe(s1)
    expect(s1).not.toBe(s2)
  })

  it('returns false for probability <= 0 and true for >= 1', () => {
    const r = createRng(1)
    expect(r.nextBool(0)).toBe(false)
    expect(r.nextBool(-0.5)).toBe(false)
    expect(r.nextBool(1)).toBe(true)
    expect(r.nextBool(2)).toBe(true)
  })
})

describe('splitRng', () => {
  it('derives an independent sub-stream that depends on the label', () => {
    const a = splitRng(createRng(1), 'ai')
    const b = splitRng(createRng(1), 'damage')
    // The two child streams should diverge.
    let same = true
    for (let i = 0; i < 5; i++) {
      if (a.next() !== b.next()) {
        same = false
        break
      }
    }
    expect(same).toBe(false)
  })

  it('depends on the parent state, not just the label', () => {
    const a = splitRng(createRng(1), 'ai')
    const b = splitRng(createRng(2), 'ai')
    let same = true
    for (let i = 0; i < 5; i++) {
      if (a.next() !== b.next()) {
        same = false
        break
      }
    }
    expect(same).toBe(false)
  })

  it('throws on empty labels in non-production mode', () => {
    expect(() => splitRng(createRng(1), '')).toThrow()
  })
})

describe('serializeRng / deserializeRng', () => {
  it('round-trips byte-exactly mid-sequence', () => {
    const a = createRng(99)
    a.next()
    a.next()
    const snapshot = serializeRng(a)
    const b = deserializeRng(snapshot)
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  it('does not advance the source rng when snapshotting', () => {
    const a = createRng(7)
    a.next()
    const before = a.state
    serializeRng(a)
    expect(a.state).toBe(before)
  })
})
