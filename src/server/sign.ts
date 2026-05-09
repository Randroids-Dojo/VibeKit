/**
 * HMAC-SHA256 signed tokens for race-start / replay / admin flows.
 * The kit ships a tiny encoding (base64url JSON payload + base64url
 * signature joined by a dot) intentionally simpler than JWT: no
 * algorithm-negotiation header, no expiration claim parsing, no
 * key-id rotation. Callers add expiration and audience checks at
 * the application layer if they need them, typically by including
 * `iat` / `exp` fields in the payload they sign.
 *
 *   - `signToken(payload, secret)` JSON-encodes the payload,
 *     HMAC-SHA256-signs the encoded payload, and returns the
 *     `<payload>.<signature>` token string.
 *   - `verifyToken<T>(token, secret, schema?)` splits the token,
 *     re-computes the signature, compares with `timingSafeEqual`,
 *     parses the payload as JSON, and validates it against an
 *     optional zod schema. Returns the parsed payload on success
 *     and `null` on any failure (malformed token, signature
 *     mismatch, JSON parse failure, schema rejection).
 *
 * Server-only: imports `node:crypto`. Runs in Node and Edge runtimes
 * that polyfill `node:crypto`. Browser callers must not import this
 * module.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { z } from 'zod'

function base64UrlEncode(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlDecode(input: string): Buffer {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4)
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function hmac(payloadB64: string, secret: string): string {
  return base64UrlEncode(
    createHmac('sha256', secret).update(payloadB64).digest(),
  )
}

// Sign an arbitrary JSON-serializable payload. The output is a
// `<base64url(json)>.<base64url(hmac)>` string suitable for query
// strings or JSON values. Throws if the payload is not JSON-
// serializable (cyclic value, BigInt, etc.).
export function signToken(payload: unknown, secret: string): string {
  if (!secret) throw new Error('signToken: secret is required')
  const json = JSON.stringify(payload)
  if (json === undefined) {
    throw new Error('signToken: payload is not JSON-serializable')
  }
  const payloadB64 = base64UrlEncode(Buffer.from(json, 'utf8'))
  const sigB64 = hmac(payloadB64, secret)
  return `${payloadB64}.${sigB64}`
}

// Verify and decode a token. Returns the parsed payload on success
// (validated against `schema` when supplied), or `null` on any
// failure mode. Constant-time signature comparison via
// `timingSafeEqual`.
export function verifyToken<T>(
  token: string,
  secret: string,
  schema?: z.ZodSchema<T>,
): T | null {
  if (!secret || typeof token !== 'string') return null
  const dotIndex = token.indexOf('.')
  if (dotIndex < 0) return null
  const payloadB64 = token.slice(0, dotIndex)
  const sigB64 = token.slice(dotIndex + 1)
  if (!payloadB64 || !sigB64) return null
  const expectedSig = hmac(payloadB64, secret)
  const expected = Buffer.from(expectedSig, 'utf8')
  const actual = Buffer.from(sigB64, 'utf8')
  if (expected.length !== actual.length) return null
  if (!timingSafeEqual(expected, actual)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'))
  } catch {
    return null
  }
  if (schema === undefined) return parsed as T
  const result = schema.safeParse(parsed)
  return result.success ? result.data : null
}
