/**
 * Defensive localStorage helpers, validated with zod schemas.
 * Every function is SSR-safe (returns a sensible default when
 * `window` / `localStorage` is missing), JSON-safe (catches parse
 * failure), schema-safe (rejects values that fail the supplied
 * schema), and quota-safe (writes return `false` on quota errors
 * instead of throwing). Same-tab and cross-tab change subscribers
 * are folded into a single `listenStorage` API:
 *
 *   - Cross-tab updates flow through the standard `storage` event
 *     that browsers dispatch on every other window when localStorage
 *     changes in one window.
 *   - Same-tab updates flow through a `gamekit:storage` CustomEvent
 *     that `writeStorage` / `removeStorage` / `notifyStorageChange`
 *     dispatch directly. The standard `storage` event does NOT fire
 *     in the same window that wrote the change, so without this
 *     a writer in tab A cannot react to its own write in tab A.
 *
 * The kit holds zod as a runtime dependency (already universal in
 * the consumer projects) so callers can pass a `z.ZodSchema<T>`
 * directly. If a future consumer needs a non-zod validator, factor
 * out a thinner `Validator<T> = (raw: unknown) => T | null` layer
 * underneath.
 */

import type { z } from 'zod'

const SAME_TAB_EVENT = 'gamekit:storage'

interface StorageDetail {
  key: string
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// Read a value, validate it against a zod schema, and return it.
// Returns null on SSR, missing key, malformed JSON, schema rejection,
// or any thrown access error. Callers should treat null as "no value
// available, use the default" rather than as a definitive "user has
// not stored anything yet".
export function readStorage<T>(
  key: string,
  schema: z.ZodSchema<T>,
): T | null {
  const storage = getLocalStorage()
  if (!storage) return null
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return null
  }
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const result = schema.safeParse(parsed)
  return result.success ? result.data : null
}

// Serialize and persist a value. Returns true on success, false on
// SSR, quota exhaustion, or any thrown access error. Successful
// writes also dispatch a same-tab `gamekit:storage` event so any
// `listenStorage` subscriber on the same key in the same window
// fires immediately.
export function writeStorage(key: string, value: unknown): boolean {
  const storage = getLocalStorage()
  if (!storage) return false
  let serialized: string
  try {
    serialized = JSON.stringify(value)
  } catch {
    return false
  }
  try {
    storage.setItem(key, serialized)
  } catch {
    return false
  }
  notifyStorageChange(key)
  return true
}

// Remove a key. No-op on SSR or thrown access. Successful removals
// also dispatch the same-tab event.
export function removeStorage(key: string): void {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    return
  }
  notifyStorageChange(key)
}

// Read-modify-write helper for the common "load-mutate-save" pattern.
// `updater` receives the current parsed value (or null) and returns
// the next value. The next value is written and a change event is
// fired. Returns the same boolean as `writeStorage`. Note that this
// is NOT atomic across tabs; two tabs writing concurrently can race.
export function updateStorage<T>(
  key: string,
  schema: z.ZodSchema<T>,
  updater: (prev: T | null) => T,
): boolean {
  const prev = readStorage(key, schema)
  return writeStorage(key, updater(prev))
}

// Dispatch the same-tab change event without writing anything.
// Useful when state is reconstructed from another source and you
// want subscribers to re-read.
export function notifyStorageChange(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(
      new CustomEvent<StorageDetail>(SAME_TAB_EVENT, { detail: { key } }),
    )
  } catch {
    // CustomEvent or dispatchEvent unavailable in this environment;
    // subscribers in this tab will simply not fire. Cross-tab still
    // works through the browser's native storage event.
  }
}

// Subscribe to changes on `key` from any tab (including this one).
// Returns an unsubscribe function. Cross-tab events come through
// the standard `storage` event; same-tab events come through the
// `gamekit:storage` CustomEvent that `writeStorage` and
// `removeStorage` dispatch.
//
// `onChange` runs synchronously when the event fires; the consumer
// is responsible for re-reading via `readStorage` if they need the
// new value.
export function listenStorage(
  key: string,
  onChange: () => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onCrossTab = (e: StorageEvent) => {
    // `e.key === null` indicates a `Storage.clear()` call cleared
    // every key; fan out the change since `key` is among the keys.
    if (e.key === null || e.key === key) onChange()
  }
  const onSameTab = (e: Event) => {
    const detail = (e as CustomEvent<StorageDetail>).detail
    if (detail !== undefined && detail.key === key) onChange()
  }
  window.addEventListener('storage', onCrossTab)
  window.addEventListener(SAME_TAB_EVENT, onSameTab)
  return () => {
    window.removeEventListener('storage', onCrossTab)
    window.removeEventListener(SAME_TAB_EVENT, onSameTab)
  }
}
