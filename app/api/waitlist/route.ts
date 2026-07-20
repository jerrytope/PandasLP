export const runtime = 'nodejs'

import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60 * 1000

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`waitlist:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  if (!isMailerConfigured()) {
    return Response.json({ error: 'Email not configured.' }, { status: 503 })
  }

  let body: { service: string; email: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { service, email } = body
  if (!email || !service) {
    return Response.json({ error: 'Missing fields.' }, { status: 400 })
  }

  try {
    await sendMail({
      to: GMAIL_USER,
      replyTo: email,
      subject: `Waitlist signup — ${service}`,
      text: `${email} signed up to be notified when ${service} goes live on Pandas LP.`,
      html: `
        <p><strong>${escapeHtml(email)}</strong> signed up to be notified when <strong>${escapeHtml(service)}</strong> goes live on Pandas LP.</p>
        <p style="color:#8A9B8F;font-size:13px;">Sent from the Pandas LP waitlist form.</p>
      `,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 502 })
  }

  return Response.json({ ok: true })
}
