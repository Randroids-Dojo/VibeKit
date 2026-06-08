import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  closeAudioContext,
  getAudioContext,
  resetAudioContextForTesting,
  resumeAudioContext,
} from '../src/audio-context'

// happy-dom does not implement the Web Audio API, so every test stubs
// a minimal AudioContext on the global and resets module state after.
class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  close = vi.fn(async () => {
    this.state = 'closed'
  })
}

afterEach(() => {
  resetAudioContextForTesting()
  vi.unstubAllGlobals()
})

describe('getAudioContext', () => {
  it('returns null when the Web Audio API is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)
    expect(getAudioContext()).toBeNull()
  })

  it('creates and caches a single context', () => {
    const ctor = vi.fn(() => new MockAudioContext())
    vi.stubGlobal('AudioContext', ctor)
    const first = getAudioContext()
    const second = getAudioContext()
    expect(first).not.toBeNull()
    expect(second).toBe(first)
    expect(ctor).toHaveBeenCalledTimes(1)
  })

  it('falls back to webkitAudioContext when AudioContext is absent', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', MockAudioContext)
    expect(getAudioContext()).toBeInstanceOf(MockAudioContext)
  })

  it('returns null when construction throws', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('no audio hardware')
        }
      },
    )
    expect(getAudioContext()).toBeNull()
  })
})

describe('resumeAudioContext', () => {
  it('resumes a suspended context', () => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    const ctx = getAudioContext() as unknown as MockAudioContext
    expect(ctx.state).toBe('suspended')
    resumeAudioContext()
    expect(ctx.resume).toHaveBeenCalledTimes(1)
    expect(ctx.state).toBe('running')
  })

  it('does not resume a running context', () => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    const ctx = getAudioContext() as unknown as MockAudioContext
    ctx.state = 'running'
    resumeAudioContext()
    expect(ctx.resume).not.toHaveBeenCalled()
  })

  it('no-ops when the Web Audio API is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)
    expect(() => resumeAudioContext()).not.toThrow()
  })
})

describe('closeAudioContext', () => {
  it('closes the context and lets the next get create a fresh one', () => {
    const ctor = vi.fn(() => new MockAudioContext())
    vi.stubGlobal('AudioContext', ctor)
    const first = getAudioContext() as unknown as MockAudioContext
    closeAudioContext()
    expect(first.close).toHaveBeenCalledTimes(1)
    const second = getAudioContext()
    expect(second).not.toBe(first)
    expect(ctor).toHaveBeenCalledTimes(2)
  })

  it('no-ops when there is no context', () => {
    expect(() => closeAudioContext()).not.toThrow()
  })
})

describe('resetAudioContextForTesting', () => {
  it('drops the cached context without closing it', () => {
    const ctor = vi.fn(() => new MockAudioContext())
    vi.stubGlobal('AudioContext', ctor)
    const first = getAudioContext() as unknown as MockAudioContext
    resetAudioContextForTesting()
    expect(first.close).not.toHaveBeenCalled()
    getAudioContext()
    expect(ctor).toHaveBeenCalledTimes(2)
  })
})
