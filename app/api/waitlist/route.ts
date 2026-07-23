export const runtime = 'nodejs'

import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
  if (typeof email !== 'string' || email.length > 200 || typeof service !== 'string' || service.length > 100) {
    return Response.json({ error: 'Invalid or oversized field.' }, { status: 400 })
  }

  // Persist first — this is the record of truth the admin dashboard reads. A failed
  // notification email shouldn't lose the signup, so this happens before (and
  // independently of) the best-effort email below.
  const { error: dbErr } = await supabaseAdmin.from('waitlist_signups').insert({ service, email })
  if (dbErr) {
    console.error('Failed to save waitlist signup:', dbErr)
    return Response.json({ error: 'Could not save your signup. Please try again.' }, { status: 500 })
  }

  if (isMailerConfigured()) {
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
    } catch (err) {
      // The signup is already saved — a failed notification email shouldn't fail the
      // request, but it must not vanish silently either.
      console.error('Waitlist signup saved but notification email failed:', err)
    }
  } else {
    console.error('Waitlist signup saved but mailer is not configured — no notification sent for', email)
  }

  return Response.json({ ok: true })
}
