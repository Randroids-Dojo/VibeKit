/**
 * Pure swipe/tap classifier for canvas and touch games.
 *
 * DOM event wiring stays in the consuming project. This module only turns a
 * start/end point plus viewport bounds into a stable gesture result.
 */

export type SwipeGestureKind = 'tap' | 'up-swipe' | 'none'

export interface Point2Like {
  x: number
  y: number
}

export interface SwipeGestureBounds {
  width: number
  height: number
}

export interface SwipeGestureConfig {
  minDistance?: number
  powerHeightFactor?: number
}

export interface SwipeGestureResult {
  kind: SwipeGestureKind
  dx: number
  dy: number
  distance: number
  dragPowerNorm: number
  lateralAngle: number
}

const DEFAULT_MIN_DISTANCE = 30
const DEFAULT_POWER_HEIGHT_FACTOR = 0.55

export function classifySwipeGesture(
  start: Point2Like,
  end: Point2Like,
  bounds: SwipeGestureBounds,
  config: SwipeGestureConfig = {},
): SwipeGestureResult {
  const minDistance = config.minDistance ?? DEFAULT_MIN_DISTANCE
  const powerHeightFactor = config.powerHeightFactor ?? DEFAULT_POWER_HEIGHT_FACTOR
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.hypot(dx, dy)
  const ref = Math.max(1, bounds.height * powerHeightFactor)
  const dragPowerNorm = dy < 0 ? Math.min(Math.abs(dy) / ref, 1) : 0
  const lateralAngle = dx / Math.max(Math.abs(dy), 1)

  let kind: SwipeGestureKind = 'none'
  if (distance > minDistance && dy < -minDistance) {
    kind = 'up-swipe'
  } else if (distance < minDistance) {
    kind = 'tap'
  }

  return {
    kind,
    dx,
    dy,
    distance,
    dragPowerNorm,
    lateralAngle,
  }
}

export function dragPowerNorm(
  start: Point2Like,
  current: Point2Like,
  bounds: SwipeGestureBounds,
  config: SwipeGestureConfig = {},
): number {
  const dy = current.y - start.y
  if (dy >= 0) return 0
  const ref = Math.max(1, bounds.height * (config.powerHeightFactor ?? DEFAULT_POWER_HEIGHT_FACTOR))
  return Math.min(Math.abs(dy) / ref, 1)
}
