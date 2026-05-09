/**
 * Generic numeric helpers re-implemented in many game projects.
 * Pulling them here so the same definition is shared and tested
 * once. All functions are pure and have no side effects.
 *
 *   - `TAU` is `2 * Math.PI`. Convenient for angle math.
 *   - `clamp(value, lo, hi)` clips `value` to the inclusive range.
 *   - `lerp(a, b, t)` linearly interpolates between `a` and `b` at
 *     `t` in `[0, 1]`. `t` is not clamped; pass `clamp(t, 0, 1)` if
 *     you need that.
 *   - `inverseLerp(a, b, value)` returns the `t` such that
 *     `lerp(a, b, t) === value`. Returns 0 when `a === b` so a
 *     degenerate range does not divide by zero.
 *   - `remap(value, inLo, inHi, outLo, outHi)` maps `value` from one
 *     range to another. Composes inverseLerp + lerp.
 *   - `smoothstep(edge0, edge1, value)` Hermite-interpolates value
 *     across the edge interval, with C1 continuity at the edges.
 *   - `wrapAngle(theta)` maps `theta` to `(-PI, PI]`.
 */

export const TAU = Math.PI * 2

export function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo
  if (value > hi) return hi
  return value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0
  return (value - a) / (b - a)
}

export function remap(
  value: number,
  inLo: number,
  inHi: number,
  outLo: number,
  outHi: number,
): number {
  return lerp(outLo, outHi, inverseLerp(inLo, inHi, value))
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const t = clamp(inverseLerp(edge0, edge1, value), 0, 1)
  return t * t * (3 - 2 * t)
}

export function wrapAngle(theta: number): number {
  return Math.atan2(Math.sin(theta), Math.cos(theta))
}
