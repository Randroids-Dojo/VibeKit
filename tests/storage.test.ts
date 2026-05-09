import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  listenStorage,
  notifyStorageChange,
  readStorage,
  removeStorage,
  updateStorage,
  writeStorage,
} from '../src/storage'

const KEY = 'gamekit.test.value'
const Schema = z.object({ name: z.string(), count: z.number() })
type Value = z.infer<typeof Schema>

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('readStorage', () => {
  it('returns null when the key is missing', () => {
    expect(readStorage(KEY, Schema)).toBeNull()
  })

  it('parses a stored JSON value that matches the schema', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ name: 'a', count: 3 }))
    expect(readStorage(KEY, Schema)).toEqual({ name: 'a', count: 3 })
  })

  it('returns null when the stored value is malformed JSON', () => {
    window.localStorage.setItem(KEY, '{not json')
    expect(readStorage(KEY, Schema)).toBeNull()
  })

  it('returns null when the stored value fails the schema', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ name: 'a', count: 'no' }))
    expect(readStorage(KEY, Schema)).toBeNull()
  })

  it('returns null when getItem itself throws', () => {
    const spy = vi
      .spyOn(window.localStorage, 'getItem')
      .mockImplementation(() => {
        throw new Error('hostile localStorage')
      })
    expect(readStorage(KEY, Schema)).toBeNull()
    spy.mockRestore()
  })
})

describe('writeStorage', () => {
  it('serializes the value and returns true', () => {
    const value: Value = { name: 'a', count: 3 }
    expect(writeStorage(KEY, value)).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual(value)
  })

  it('returns false when setItem throws (e.g. quota exceeded)', () => {
    const spy = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
    expect(writeStorage(KEY, { name: 'a', count: 3 })).toBe(false)
    spy.mockRestore()
  })

  it('returns false when JSON.stringify throws (cyclic value)', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(writeStorage(KEY, cyclic)).toBe(false)
  })

  it('dispatches the same-tab change event on success', () => {
    const onChange = vi.fn()
    const off = listenStorage(KEY, onChange)
    writeStorage(KEY, { name: 'a', count: 1 })
    expect(onChange).toHaveBeenCalledTimes(1)
    off()
  })
})

describe('removeStorage', () => {
  it('clears the key and dispatches the change event', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ name: 'a', count: 1 }))
    const onChange = vi.fn()
    const off = listenStorage(KEY, onChange)
    removeStorage(KEY)
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(onChange).toHaveBeenCalledTimes(1)
    off()
  })

  it('does not throw when the key is already missing', () => {
    expect(() => removeStorage(KEY)).not.toThrow()
  })
})

describe('updateStorage', () => {
  it('passes null to the updater on first write', () => {
    let received: Value | null = null
    updateStorage(KEY, Schema, (prev) => {
      received = prev
      return { name: 'a', count: 1 }
    })
    expect(received).toBeNull()
  })

  it('passes the parsed previous value on subsequent writes', () => {
    writeStorage(KEY, { name: 'a', count: 1 })
    let received: Value | null = null
    updateStorage(KEY, Schema, (prev) => {
      received = prev
      return { name: prev?.name ?? '', count: (prev?.count ?? 0) + 1 }
    })
    expect(received).toEqual({ name: 'a', count: 1 })
    expect(readStorage(KEY, Schema)).toEqual({ name: 'a', count: 2 })
  })

  it('treats malformed stored JSON as null when computing the next value', () => {
    window.localStorage.setItem(KEY, '{not json')
    updateStorage(KEY, Schema, (prev) => ({
      name: prev?.name ?? 'fresh',
      count: prev?.count ?? 99,
    }))
    expect(readStorage(KEY, Schema)).toEqual({ name: 'fresh', count: 99 })
  })
})

describe('listenStorage same-tab', () => {
  it('fires when notifyStorageChange is called for the same key', () => {
    const onChange = vi.fn()
    const off = listenStorage(KEY, onChange)
    notifyStorageChange(KEY)
    expect(onChange).toHaveBeenCalledTimes(1)
    off()
  })

  it('does not fire for a different key', () => {
    const onChange = vi.fn()
    const off = listenStorage(KEY, onChange)
    notifyStorageChange('gamekit.test.other')
    expect(onChange).not.toHaveBeenCalled()
    off()
  })

  it('stops firing after unsubscribe', () => {
    const onChange = vi.fn()
    const off = listenStorage(KEY, onChange)
    off()
    notifyStorageChange(KEY)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('listenStorage cross-tab', () => {
  it('fires when a storage event with matching key arrives', () => {
    const onChange = vi.fn()
    const off = listenStorage(KEY, onChange)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: KEY,
        oldValue: null,
        newValue: '{}',
      }),
    )
    expect(onChange).toHaveBeenCalledTimes(1)
    off()
  })

  it('fires when storage was cleared (key === null)', () => {
    const onChange = vi.fn()
    const off = listenStorage(KEY, onChange)
    window.dispatchEvent(
      new StorageEvent('storage', { key: null, oldValue: null, newValue: null }),
    )
    expect(onChange).toHaveBeenCalledTimes(1)
    off()
  })

  it('does not fire for a different key', () => {
    const onChange = vi.fn()
    const off = listenStorage(KEY, onChange)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'other.key',
        oldValue: null,
        newValue: '{}',
      }),
    )
    expect(onChange).not.toHaveBeenCalled()
    off()
  })
})
