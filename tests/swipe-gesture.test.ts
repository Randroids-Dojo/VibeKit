import { describe, expect, it } from 'vitest'
import { classifySwipeGesture, dragPowerNorm } from '../src/swipe-gesture'

const bounds = { width: 400, height: 800 }

describe('classifySwipeGesture', () => {
  it('classifies short movement as a tap', () => {
    const result = classifySwipeGesture({ x: 100, y: 200 }, { x: 110, y: 208 }, bounds)

    expect(result.kind).toBe('tap')
    expect(result.dragPowerNorm).toBe(0)
  })

  it('classifies upward movement as an up-swipe with normalized power', () => {
    const result = classifySwipeGesture({ x: 100, y: 700 }, { x: 130, y: 480 }, bounds)

    expect(result.kind).toBe('up-swipe')
    expect(result.dx).toBe(30)
    expect(result.dy).toBe(-220)
    expect(result.dragPowerNorm).toBeCloseTo(0.5)
    expect(result.lateralAngle).toBeCloseTo(30 / 220)
  })

  it('caps swipe power at one', () => {
    const result = classifySwipeGesture({ x: 100, y: 700 }, { x: 100, y: 0 }, bounds)

    expect(result.kind).toBe('up-swipe')
    expect(result.dragPowerNorm).toBe(1)
  })

  it('does not classify downward drag as shot input', () => {
    const result = classifySwipeGesture({ x: 100, y: 200 }, { x: 100, y: 300 }, bounds)

    expect(result.kind).toBe('none')
    expect(result.dragPowerNorm).toBe(0)
  })

  it('supports custom thresholds and power scaling', () => {
    const result = classifySwipeGesture(
      { x: 100, y: 200 },
      { x: 100, y: 180 },
      bounds,
      { minDistance: 10, powerHeightFactor: 0.5 },
    )

    expect(result.kind).toBe('up-swipe')
    expect(result.dragPowerNorm).toBeCloseTo(0.05)
  })
})

describe('dragPowerNorm', () => {
  it('matches classifier preview power for the current drag', () => {
    expect(dragPowerNorm({ x: 100, y: 700 }, { x: 125, y: 480 }, bounds)).toBeCloseTo(0.5)
  })

  it('returns zero before an upward drag starts', () => {
    expect(dragPowerNorm({ x: 100, y: 200 }, { x: 100, y: 230 }, bounds)).toBe(0)
  })
})
