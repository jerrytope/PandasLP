export const runtime = 'nodejs'

import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { recordConsent, verifyUnsubscribeToken } from '@/lib/consentServer'

// POST { id: "e:<email>" | "p:<234…>", t: token } from the /unsubscribe page. Records a
// marketing withdrawal. A button press (not the link itself) triggers it, so email scanners
// that open links can't unsubscribe people by accident.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`unsubscribe:${getClientIp(req)}`, 10, 10 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  let body: { id?: unknown; t?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  const t = typeof body.t === 'string' ? body.t : ''
  if (!/^(e:.+@.+|p:234\d{10})$/.test(id) || id.length > 210 || !verifyUnsubscribeToken(id, t)) {
    return Response.json({ error: 'This unsubscribe link is not valid. Please email pandaslegalpractitioners@gmail.com and we will remove you.' }, { status: 400 })
  }
  const result = await recordConsent({
    email: id.startsWith('e:') ? id.slice(2) : null,
    phone: id.startsWith('p:') ? id.slice(2) : null,
    purpose: 'marketing',
    granted: false,
    source: 'unsubscribe_link',
    userAgent: req.headers.get('user-agent'),
  })
  if ('error' in result) return Response.json({ error: 'We couldn’t save that. Please try again.' }, { status: 500 })
  return Response.json({ ok: true })
}
