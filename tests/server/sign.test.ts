import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { signToken, verifyToken } from '../../src/server/sign'

const SECRET = 'test-secret-please-rotate'
const Schema = z.object({ raceId: z.string(), iat: z.number() })

describe('signToken', () => {
  it('returns a `<payload>.<sig>` shaped string', () => {
    const token = signToken({ raceId: 'r1', iat: 1 }, SECRET)
    const parts = token.split('.')
    expect(parts).toHaveLength(2)
    const [payloadB64, sigB64] = parts as [string, string]
    expect(payloadB64.length).toBeGreaterThan(0)
    expect(sigB64.length).toBeGreaterThan(0)
  })

  it('produces the same token for the same payload + secret (deterministic)', () => {
    const a = signToken({ raceId: 'r1', iat: 1 }, SECRET)
    const b = signToken({ raceId: 'r1', iat: 1 }, SECRET)
    expect(a).toBe(b)
  })

  it('produces a different token when the secret changes', () => {
    const a = signToken({ raceId: 'r1', iat: 1 }, SECRET)
    const b = signToken({ raceId: 'r1', iat: 1 }, 'different-secret')
    expect(a).not.toBe(b)
  })

  it('throws on an empty secret to prevent unsigned tokens', () => {
    expect(() => signToken({ x: 1 }, '')).toThrow()
  })

  it('throws on a non-JSON-serializable payload', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => signToken(cyclic, SECRET)).toThrow()
  })
})

describe('verifyToken', () => {
  it('round-trips a payload through sign + verify', () => {
    const payload = { raceId: 'r1', iat: 1 }
    const token = signToken(payload, SECRET)
    expect(verifyToken(token, SECRET, Schema)).toEqual(payload)
  })

  it('returns null when the secret does not match', () => {
    const token = signToken({ raceId: 'r1', iat: 1 }, SECRET)
    expect(verifyToken(token, 'wrong-secret', Schema)).toBeNull()
  })

  it('returns null when the payload was tampered after signing', () => {
    const token = signToken({ raceId: 'r1', iat: 1 }, SECRET)
    const [, sig] = token.split('.')
    const tampered = `${Buffer.from('{"raceId":"hacked","iat":2}', 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')}.${sig}`
    expect(verifyToken(tampered, SECRET, Schema)).toBeNull()
  })

  it('returns null when the signature was tampered', () => {
    const token = signToken({ raceId: 'r1', iat: 1 }, SECRET)
    const [payloadB64] = token.split('.')
    const tampered = `${payloadB64}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
    expect(verifyToken(tampered, SECRET, Schema)).toBeNull()
  })

  it('returns null on a malformed token (no dot, empty halves, garbage)', () => {
    expect(verifyToken('not-a-token', SECRET, Schema)).toBeNull()
    expect(verifyToken('', SECRET, Schema)).toBeNull()
    expect(verifyToken('.', SECRET, Schema)).toBeNull()
    expect(verifyToken('foo.', SECRET, Schema)).toBeNull()
    expect(verifyToken('.bar', SECRET, Schema)).toBeNull()
  })

  it('returns null when the payload fails the schema', () => {
    const token = signToken({ raceId: 'r1', iat: 'not-a-number' }, SECRET)
    expect(verifyToken(token, SECRET, Schema)).toBeNull()
  })

  it('returns the parsed payload as `unknown`-style when no schema is supplied', () => {
    const token = signToken({ anything: ['goes'] }, SECRET)
    const result = verifyToken(token, SECRET)
    expect(result).toEqual({ anything: ['goes'] })
  })
})
