import { describe, it, expect } from 'vitest'
import { gauss, makeRng, pick, range } from '../src/rng'

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
