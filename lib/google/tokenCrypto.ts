// Server-only. The Google refresh token gives full access to the firm's Drive, so it is never
// stored in plain text: AES-256-GCM with GOOGLE_TOKEN_ENCRYPTION_KEY (32 random bytes, as 64
// hex characters). The same key signs the OAuth `state` value so the callback can tell a real
// round trip it started from a forged one.

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto'

function getKey(): Buffer {
  const hex = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? ''
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 random bytes).')
  }
  return Buffer.from(hex, 'hex')
}

/** Returns "iv.authTag.ciphertext", each base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString('base64url')).join('.')
}

export function decryptSecret(encoded: string): string {
  const [iv, tag, ciphertext] = encoded.split('.').map((p) => Buffer.from(p, 'base64url'))
  if (!iv || !tag || !ciphertext) throw new Error('Malformed encrypted value.')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

const STATE_TTL_MS = 10 * 60 * 1000

/** A short-lived, signed value naming who started the Google connection. */
export function signState(staffEmail: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ e: staffEmail, x: now + STATE_TTL_MS, n: randomBytes(8).toString('hex') })).toString('base64url')
  const sig = createHmac('sha256', getKey()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** The staff email inside a valid, unexpired state value — or null if forged, altered or stale. */
export function verifyState(state: string, now = Date.now()): string | null {
  const [payload, sig] = state.split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', getKey()).update(payload).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof e !== 'string' || typeof x !== 'number' || x < now) return null
    return e
  } catch {
    return null
  }
}
