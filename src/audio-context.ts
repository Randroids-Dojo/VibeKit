/**
 * Web Audio lifecycle helpers re-implemented in many game projects.
 * Owns a single lazily-created AudioContext and the first-gesture
 * resume that browsers require, plus teardown. Every function is
 * environment-safe: when the Web Audio API is missing (SSR, headless
 * tests, older browsers) creation returns null and the other helpers
 * no-op instead of throwing.
 *
 * Scope is deliberately just the context lifecycle. The synthesis
 * graph (oscillators, filters, SFX, music layers) and any master /
 * bus routing stay in the consumer: projects still diverge on
 * shared-context versus per-layer-context and on master-bus shapes,
 * so that design is left to the consumer rather than fixed here.
 *
 *   - `getAudioContext()` returns the shared context, creating it on
 *     first call (with a `webkitAudioContext` fallback for Safari).
 *   - `resumeAudioContext()` creates-and-resumes from the first user
 *     gesture, since browsers start contexts suspended.
 *   - `closeAudioContext()` tears the context down and drops the
 *     reference so the next `getAudioContext` creates a fresh one.
 *   - `resetAudioContextForTesting()` clears module state without
 *     calling `close()`, for test isolation.
 */

interface AudioContextConstructor {
  new (): AudioContext
}

function resolveAudioContextCtor(): AudioContextConstructor | null {
  if (typeof globalThis === 'undefined') return null
  const g = globalThis as typeof globalThis & {
    AudioContext?: AudioContextConstructor
    webkitAudioContext?: AudioContextConstructor
  }
  return g.AudioContext ?? g.webkitAudioContext ?? null
}

let context: AudioContext | null = null

/**
 * Return the shared AudioContext, creating it on first call. Returns
 * null when the Web Audio API is unavailable (SSR / headless / old
 * browser) or construction throws. The instance is cached; later
 * calls return the same one until `closeAudioContext` or
 * `resetAudioContextForTesting` clears it.
 */
export function getAudioContext(): AudioContext | null {
  if (context) return context
  const Ctor = resolveAudioContextCtor()
  if (!Ctor) return null
  try {
    context = new Ctor()
  } catch {
    context = null
  }
  return context
}

/**
 * Create (if needed) and resume the shared context when it is
 * suspended. Browsers start contexts suspended until a user gesture,
 * so call this from the first click / key / touch handler. No-op when
 * the Web Audio API is unavailable or the context is not suspended.
 * Fire-and-forget.
 */
export function resumeAudioContext(): void {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume()
  }
}

/**
 * Close the shared context and drop the reference so the next
 * `getAudioContext` creates a fresh one. No-op when there is no
 * context. Fire-and-forget close.
 */
export function closeAudioContext(): void {
  if (context) {
    void context.close()
    context = null
  }
}

/**
 * Reset module state for tests without invoking `close()`. Use this
 * in `afterEach` to isolate tests that stub the AudioContext
 * constructor.
 */
export function resetAudioContextForTesting(): void {
  context = null
}
