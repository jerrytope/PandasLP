// The private link in the filing-pack e-mail that lets a client upload their signed forms
// without signing in. The link carries the case id and an expiry, signed with a key derived
// from the server's service-role secret, so it cannot be forged or pointed at another case.
// It only allows adding files to that one case; it never shows anything from it.

import { createHmac, timingSafeEqual } from 'crypto'

export const UPLOAD_LINK_DAYS = 30

function key(secret = process.env.SUPABASE_SERVICE_ROLE_KEY): Buffer {
  if (!secret) throw new Error('Upload links need SUPABASE_SERVICE_ROLE_KEY on the server.')
  return createHmac('sha256', secret).update('pandaslp-upload-link-v1').digest()
}

function sign(payload: string, secret?: string): string {
  return createHmac('sha256', key(secret)).update(payload).digest('base64url').slice(0, 32)
}

export function makeUploadToken(caseId: string, opts: { now?: number; days?: number; secret?: string } = {}): string {
  const exp = Math.floor((opts.now ?? Date.now()) / 1000) + (opts.days ?? UPLOAD_LINK_DAYS) * 86_400
  const payload = `${caseId}.${exp}`
  return `${payload}.${sign(payload, opts.secret)}`
}

export function readUploadToken(token: string | null | undefined, opts: { now?: number; secret?: string } = {}): { caseId: string; exp: number } | null {
  if (!token || token.length > 200) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [caseId, expText, sig] = parts
  if (!/^[0-9a-f-]{36}$/i.test(caseId) || !/^\d+$/.test(expText)) return null
  const expected = Buffer.from(sign(`${caseId}.${expText}`, opts.secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  const exp = Number(expText)
  if (exp * 1000 < (opts.now ?? Date.now())) return null
  return { caseId, exp }
}

export function uploadLinkUrl(siteUrl: string, caseId: string): string {
  return `${siteUrl.replace(/\/$/, '')}/upload?t=${encodeURIComponent(makeUploadToken(caseId))}`
}
