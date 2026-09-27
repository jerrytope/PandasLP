// Server-only consent helpers: writing to the append-only consent_records table, and signed
// unsubscribe links. Never import this into a client component.

import { createHmac, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CONSENT_META, CONSENT_TEXT, normaliseEmail, type ConsentPurpose, type ConsentChannel, type ConsentVersion } from '@/lib/consent'

export interface RecordConsentInput {
  email?: string | null
  phone?: string | null
  // A shown wording (the normal case), or a manual entry by staff with its own purpose.
  version?: ConsentVersion
  purpose?: ConsentPurpose
  channels?: ConsentChannel[]
  granted: boolean
  source: string
  sourceId?: string | null
  recordedBy?: string | null
  note?: string | null
  pageUrl?: string | null
  userAgent?: string | null
}

export async function recordConsent(input: RecordConsentInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normaliseEmail(input.email)
  const phone = input.phone?.trim() || null
  if (!email && !phone) return { ok: false, error: 'An email or phone number is needed to record consent.' }
  const meta = input.version ? CONSENT_META[input.version] : null
  const purpose = meta?.purpose ?? input.purpose
  if (!purpose) return { ok: false, error: 'Missing consent purpose.' }
  const wording = input.version
    ? CONSENT_TEXT[input.version]
    : input.granted
      ? 'Consent given directly to staff (see note).'
      : 'Consent withdrawn.'
  const { error } = await supabaseAdmin.from('consent_records').insert({
    email,
    phone,
    purpose,
    granted: input.granted,
    channels: input.channels ?? meta?.channels ?? ['email', 'whatsapp', 'sms', 'phone'],
    wording,
    wording_version: input.version ?? (input.granted ? 'staff_recorded' : 'withdrawal'),
    source: input.source,
    source_id: input.sourceId ?? null,
    recorded_by: input.recordedBy ?? null,
    note: input.note?.trim().slice(0, 1000) || null,
    page_url: input.pageUrl?.slice(0, 300) || null,
    user_agent: input.userAgent?.slice(0, 300) || null,
  })
  if (error) {
    console.error('Failed to record consent:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

function unsubscribeSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error('No secret configured for unsubscribe links.')
  return s
}

// Identifier is "e:<email>" or "p:<234…>". The token proves the link came from us, so nobody
// can unsubscribe someone else by guessing a URL.
export function unsubscribeToken(identifier: string): string {
  return createHmac('sha256', unsubscribeSecret()).update(`unsubscribe:${identifier}`).digest('base64url').slice(0, 32)
}

export function verifyUnsubscribeToken(identifier: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(identifier))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export function unsubscribeUrl(who: { email?: string | null; phone?: string | null }): string | null {
  const email = normaliseEmail(who.email)
  const id = email ? `e:${email}` : who.phone ? `p:${who.phone}` : null
  if (!id) return null
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'
  return `${site}/unsubscribe?id=${encodeURIComponent(id)}&t=${unsubscribeToken(id)}`
}
