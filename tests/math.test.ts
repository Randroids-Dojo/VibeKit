import { describe, it, expect } from 'vitest'
import {
  TAU,
  clamp,
  inverseLerp,
  lerp,
  remap,
  smoothstep,
  wrapAngle,
} from '../src/math'

describe('TAU', () => {
  it('is 2 * Math.PI', () => {
    expect(TAU).toBe(2 * Math.PI)
  })
})

describe('clamp', () => {
  it('returns the value when in range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })
  it('clips to the lower bound', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
  })
  it('clips to the upper bound', () => {
    expect(clamp(99, 0, 10)).toBe(10)
  })
  it('handles negative ranges', () => {
    expect(clamp(0, -5, -1)).toBe(-1)
  })
})

describe('lerp', () => {
  it('returns a at t=0 and b at t=1', () => {
    expect(lerp(2, 8, 0)).toBe(2)
    expect(lerp(2, 8, 1)).toBe(8)
  })
  it('interpolates linearly at t=0.5', () => {
    expect(lerp(2, 8, 0.5)).toBe(5)
  })
  it('does not clamp t', () => {
    expect(lerp(0, 10, 2)).toBe(20)
    expect(lerp(0, 10, -1)).toBe(-10)
  })
})

describe('inverseLerp', () => {
  it('inverts lerp', () => {
    const a = 5
    const b = 25
    const t = 0.3
    expect(inverseLerp(a, b, lerp(a, b, t))).toBeCloseTo(t, 9)
  })
  it('returns 0 for a degenerate range to avoid divide-by-zero', () => {
    expect(inverseLerp(3, 3, 7)).toBe(0)
  })
})

describe('remap', () => {
  it('maps the input range to the output range linearly', () => {
    expect(remap(5, 0, 10, 100, 200)).toBe(150)
  })
  it('handles a flipped output range', () => {
    expect(remap(5, 0, 10, 1, 0)).toBe(0.5)
  })
})

describe('smoothstep', () => {
  it('returns 0 at edge0 and 1 at edge1', () => {
    expect(smoothstep(0, 1, 0)).toBe(0)
    expect(smoothstep(0, 1, 1)).toBe(1)
  })
  it('returns 0.5 at the midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5)
  })
  it('clamps outside the edge interval', () => {
    expect(smoothstep(0, 1, -0.5)).toBe(0)
    expect(smoothstep(0, 1, 1.5)).toBe(1)
  })
})

describe('wrapAngle', () => {
  it('leaves angles inside (-PI, PI] unchanged', () => {
    expect(wrapAngle(1)).toBeCloseTo(1, 9)
    expect(wrapAngle(-1)).toBeCloseTo(-1, 9)
  })
  it('wraps a value above PI down by TAU', () => {
    expect(wrapAngle(Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5, 9)
  })
  it('wraps a value below -PI up by TAU', () => {
    expect(wrapAngle(-Math.PI - 0.5)).toBeCloseTo(Math.PI - 0.5, 9)
  })
})
