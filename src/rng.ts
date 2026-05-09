/**
 * Tiny seeded pseudo-random number generator (Mulberry32 variant).
 * `makeRng(seed)` returns a function that yields a new float in
 * `[0, 1)` on each call, deterministic from the seed: two calls with
 * the same seed produce the same sequence. Use for replay testing,
 * deterministic spawns, and any system that needs reproducible
 * randomness.
 *
 * Avoid `Math.random` in determinism-sensitive code paths: a stray
 * call invalidates a recorded ghost / replay without warning. Pick
 * one shared `rng()` per system and pass it down.
 *
 * Helpers built on top of the raw float source:
 *   - `range(rng, lo, hi)` returns a uniform float in `[lo, hi)`.
 *   - `pick(rng, items)` returns a uniform-random element.
 *   - `gauss(rng)` returns a standard-normal sample (Box-Muller).
 *
 * Algorithm note: Mulberry32 is a 32-bit LCG with good statistical
 * properties for game-loop randomness. Not cryptographically secure;
 * if you need crypto-quality randomness use `crypto.getRandomValues`.
 */

// Returns a deterministic float-in-[0, 1) generator from a numeric
// seed. Re-seeding with the same number produces the same sequence.
export function makeRng(seed: number): () => number {
  let s = seed >>> 0
  if (s === 0) s = 1
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Uniform float in [lo, hi).
export function range(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

// Uniform-random element of a non-empty array. Returns undefined for
// an empty array so the caller can decide how to handle that.
export function pick<T>(rng: () => number, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(rng() * items.length)]
}

// Standard-normal (mean 0, stddev 1) sample via Box-Muller.
export function gauss(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
