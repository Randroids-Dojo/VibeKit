/**
 * Seeded deterministic pseudo-random number generator (Mulberry32).
 *
 * Two APIs share one algorithm:
 *
 *   1. The lightweight functional form. `makeRng(seed)` returns a
 *      `() => number` function. Helpers `range`, `pick`, `gauss` operate
 *      on that function. Use this when a closure is enough and a saved
 *      state is not needed.
 *
 *   2. The richer object form. `createRng(seed)` returns an `Rng` with
 *      a serialisable `state` plus `next` / `nextInt` / `nextBool`
 *      methods. `splitRng` derives an independent sub-stream from a
 *      label. `serializeRng` / `deserializeRng` round-trip a save slot
 *      byte-exactly. Use this for replay determinism, save / load, and
 *      sub-system fan-out.
 *
 * Both forms produce the same Mulberry32 sequence for a given seed when
 * the caller stays inside one form; mixing the two on the same seed is
 * not supported because the state advance points are independent.
 *
 * Determinism rules the object form enforces:
 *
 *   - Same seed produces the same sequence across runs and JS engines.
 *   - `splitRng(parent, label)` consumes exactly one parent advance plus
 *     an FNV-1a hash of the label. Callers that need to fan out from a
 *     fixed parent state must snapshot first.
 *   - Every `next` / `nextInt` / `nextBool` advances the state by one
 *     step, even when a guard short-circuits the result, so per-tick
 *     usage counts stay stable across replays.
 *
 * Algorithm: Mulberry32. Public-domain 15-line PRNG. Uniform output in
 * `[0, 1)`. Period 2^32 (ample for game-side randomness; not crypto).
 * The implementation uses `Math.imul` so output is identical on V8,
 * SpiderMonkey, and JavaScriptCore.
 */

// Functional form ---------------------------------------------------------

/**
 * Returns a deterministic float-in-[0, 1) generator from a numeric seed.
 * Re-seeding with the same number produces the same sequence. Avoid
 * `Math.random` in determinism-sensitive code paths.
 */
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

/** Uniform float in `[lo, hi)`. */
export function range(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

/** Uniform-random element of a non-empty array. `undefined` on empty input. */
export function pick<T>(rng: () => number, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(rng() * items.length)]
}

/** Standard-normal (mean 0, stddev 1) sample via Box-Muller. */
export function gauss(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// Object form -------------------------------------------------------------

/**
 * A deterministic PRNG. The `state` field is the single u32 word the
 * algorithm advances; serialising / restoring this number reproduces
 * every future roll byte-for-byte.
 */
export interface Rng {
  /** Current u32 state word. Snapshotted by `serializeRng`. */
  state: number
  /** Returns a uniform float in `[0, 1)`. Advances state by one step. */
  next: () => number
  /**
   * Returns a uniform integer in `[min, maxExclusive)`. Throws when the
   * range is empty or non-finite. Advances state by one step.
   */
  nextInt: (min: number, maxExclusive: number) => number
  /**
   * Returns `true` with the given probability. Edges (`<= 0`, `>= 1`)
   * still advance the state so the call is observable in a replay.
   */
  nextBool: (probability: number) => boolean
}

/**
 * Build a fresh PRNG from a 32-bit integer seed.
 *
 * Seed normalisation: NaN / ±Infinity throw. Floats throw outside
 * production and floor silently in production. Negative integers map
 * via `seed >>> 0`. The algorithm allows seed `0`.
 */
export function createRng(seed: number): Rng {
  return makeRngObject(normaliseSeed(seed))
}

/**
 * Derive a deterministic sub-stream from a parent. The label is hashed
 * with FNV-1a and mixed with one parent advance to produce a fresh
 * seed. Two parents with the same label still produce different
 * children because the parent state mixes in.
 *
 * Side effect: consumes one parent state advance. Callers that need to
 * fan out from a fixed parent state must snapshot first:
 *
 *     const snap = serializeRng(parent)
 *     const a = splitRng(parent, "ai")
 *     const b = splitRng(deserializeRng(snap), "damage")
 *
 * Empty labels throw outside production and use a fixed sentinel hash
 * in production so a buggy caller cannot silently re-roll.
 */
export function splitRng(parent: Rng, label: string): Rng {
  if (typeof label !== "string") {
    throw new TypeError(`splitRng label must be a string, got ${typeof label}`)
  }
  if (label.length === 0 && process.env.NODE_ENV !== "production") {
    throw new Error(
      "splitRng label must be a non-empty string; pass a stable subsystem name (e.g. 'ai')",
    )
  }
  const labelHash = fnv1a32(label)
  parent.next()
  const mixed = (Math.imul(parent.state, 0x9e3779b1) ^ labelHash) >>> 0
  return makeRngObject(mixed === 0 ? 1 : mixed)
}

/**
 * Snapshot a PRNG's state for save / replay. Returns the single u32
 * word. Pure: does not advance the source PRNG.
 */
export function serializeRng(rng: Rng): number {
  return rng.state >>> 0
}

/**
 * Reconstruct a PRNG from a previously serialised state. Input is
 * normalised the same way as `createRng`.
 */
export function deserializeRng(state: number): Rng {
  return makeRngObject(normaliseSeed(state))
}

// Implementation ----------------------------------------------------------

function makeRngObject(initialState: number): Rng {
  let state = initialState >>> 0

  const rng: Rng = {
    state,
    next: () => {
      state = advance(state)
      rng.state = state
      return mulberry32Output(state)
    },
    nextInt: (min: number, maxExclusive: number) => {
      if (
        !Number.isFinite(min) ||
        !Number.isFinite(maxExclusive) ||
        !Number.isInteger(min) ||
        !Number.isInteger(maxExclusive)
      ) {
        throw new RangeError(
          `nextInt requires integer bounds, got [${min}, ${maxExclusive})`,
        )
      }
      if (maxExclusive <= min) {
        throw new RangeError(
          `nextInt requires maxExclusive > min, got [${min}, ${maxExclusive})`,
        )
      }
      const r = maxExclusive - min
      state = advance(state)
      rng.state = state
      return min + Math.floor(mulberry32Output(state) * r)
    },
    nextBool: (probability: number) => {
      state = advance(state)
      rng.state = state
      if (!Number.isFinite(probability) || probability <= 0) return false
      if (probability >= 1) return true
      return mulberry32Output(state) < probability
    },
  }
  return rng
}

function advance(state: number): number {
  return (state + 0x6d2b79f5) >>> 0
}

function mulberry32Output(state: number): number {
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function normaliseSeed(seed: number): number {
  if (typeof seed !== "number" || Number.isNaN(seed) || !Number.isFinite(seed)) {
    throw new RangeError(
      `createRng requires a finite numeric seed, got ${String(seed)}`,
    )
  }
  if (!Number.isInteger(seed)) {
    if (process.env.NODE_ENV !== "production") {
      throw new RangeError(
        `createRng requires an integer seed; got ${seed}. Pass Math.floor(seed) explicitly to opt in.`,
      )
    }
    return Math.floor(seed) >>> 0
  }
  return seed >>> 0
}

function fnv1a32(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
