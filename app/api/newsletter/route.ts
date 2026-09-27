export const runtime = 'nodejs'

import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isValidEmail } from '@/lib/invoices'
import { recordConsent } from '@/lib/consentServer'

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60 * 1000

// Footer "Legal tips" sign-up. The subscription IS the consent record: the wording shown next to
// the button (CONSENT_TEXT.newsletter_v1) is stored with the email, time and page.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`newsletter:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  }
  let body: { email?: unknown; pageUrl?: unknown; website?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.website === 'string' && body.website.trim()) return Response.json({ ok: true })
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email || email.length > 200 || !isValidEmail(email)) return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 })

  const result = await recordConsent({
    email,
    version: 'newsletter_v1',
    granted: true,
    source: 'footer_newsletter',
    pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl : null,
    userAgent: req.headers.get('user-agent'),
  })
  if ('error' in result) return Response.json({ error: 'We couldn’t save that. Please try again.' }, { status: 500 })
  return Response.json({ ok: true })
}
