export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60 * 1000

interface CustomClaimBody {
  name?: string
  email?: string
  phone?: string
  description?: string
  amountPaid?: number
}

// This is user-submitted content going into an HTML email — escape it before interpolating,
// same as any other HTML injection boundary.
function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`custom-claim:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  let body: CustomClaimBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { name, email, phone, description, amountPaid } = body
  if (!name || !email || !description) {
    return Response.json({ error: 'Missing name, email, or description.' }, { status: 400 })
  }
  // Generous caps — real submissions are never close to these; only rejects
  // pathological/abuse payloads.
  if (
    typeof name !== 'string' || name.length > 200 ||
    typeof email !== 'string' || email.length > 200 ||
    (phone !== undefined && (typeof phone !== 'string' || phone.length > 30)) ||
    typeof description !== 'string' || description.length > 5000
  ) {
    return Response.json({ error: 'Invalid or oversized field.' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabaseAdmin
    .from('custom_claims')
    .insert({
      name,
      email,
      phone: phone || null,
      description,
      amount_paid: amountPaid ?? 0,
    })
    .select('id')
    .single()

  if (dbErr || !data) {
    console.error('Failed to save custom claim:', dbErr)
    return Response.json({ error: 'Could not save your claim. Please try again.' }, { status: 500 })
  }

  if (isMailerConfigured()) {
    try {
      await sendMail({
        to: GMAIL_USER,
        replyTo: email,
        subject: `New custom claim — ${name}`,
        text: `${name} (${email}${phone ? `, ${phone}` : ''}) submitted a custom claim and paid the ₦${(amountPaid ?? 0).toLocaleString()} routing fee.\n\nDescription:\n${description}\n\nReply to this email to reach them directly.`,
        html: `
          <p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}${phone ? `, ${escapeHtml(phone)}` : ''}) submitted a custom claim and paid the routing fee of <strong>₦${(amountPaid ?? 0).toLocaleString()}</strong>.</p>
          <p style="white-space:pre-wrap;">${escapeHtml(description)}</p>
          <p style="color:#8A9B8F;font-size:13px;">Reply to this email to reach them directly — Ref: custom_claims/${data.id}</p>
        `,
      })
    } catch (err) {
      // The claim is already saved — a failed notification email shouldn't fail the request,
      // but it must not vanish silently either.
      console.error('Custom claim saved but notification email failed:', err)
    }
  } else {
    console.error('Custom claim saved but mailer is not configured — no notification sent for', data.id)
  }

  return Response.json({ ok: true, id: data.id })
}
