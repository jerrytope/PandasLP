export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { CUSTOM_CLAIM_FEE } from '@/lib/services'
import { verifyPayment, claimPaymentReference, linkPaymentReference, releasePaymentReference } from '@/lib/paystackVerify'

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60 * 1000

// The browser used to send `amountPaid` and the claim was saved as paid on its word alone —
// nothing ever checked a payment happened. Now it sends the checkout's reference, the fee is
// confirmed with Paystack (lib/paystackVerify.ts), and amount_paid is what Paystack reports.
interface CustomClaimBody {
  name?: string
  email?: string
  phone?: string
  description?: string
  /** Paystack reference from the checkout. */
  reference?: string
  /** Stub checkout only (no live Paystack key): what it reported, see lib/paystackVerify.ts. */
  amount?: number
  stub?: boolean
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

  const { name, email, phone, description, reference, amount, stub } = body
  if (!name || !email || !description) {
    return Response.json({ error: 'Missing name, email, or description.' }, { status: 400 })
  }
  if (typeof reference !== 'string' || !reference || reference.length > 200) {
    return Response.json({ error: 'Missing payment reference.' }, { status: 400 })
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

  const verified = await verifyPayment({ reference, expectedAmount: CUSTOM_CLAIM_FEE, clientAmount: amount, stub })
  if (verified.ok === false) {
    return Response.json({ error: verified.error }, { status: verified.status })
  }
  // One payment, one claim — otherwise a single paid reference could file unlimited "paid" claims.
  const claimed = await claimPaymentReference(verified.reference, 'custom_claim', verified.amount, null)
  if (claimed.ok === false) {
    return Response.json({ error: claimed.error }, { status: claimed.status })
  }
  const amountPaid = verified.amount

  const { data, error: dbErr } = await supabaseAdmin
    .from('custom_claims')
    .insert({
      name,
      email,
      phone: phone || null,
      description,
      amount_paid: amountPaid,
    })
    .select('id')
    .single()

  if (dbErr || !data) {
    console.error('Failed to save custom claim:', dbErr)
    // The payment is real — free its reference so retrying the submission isn't refused as reused.
    await releasePaymentReference(verified.reference)
    return Response.json({ error: 'Could not save your claim. Please try again.' }, { status: 500 })
  }
  await linkPaymentReference(verified.reference, data.id)

  let notified = false
  if (isMailerConfigured()) {
    try {
      await sendMail({
        to: GMAIL_USER,
        replyTo: email,
        subject: `New custom claim — ${name}`,
        text: `${name} (${email}${phone ? `, ${phone}` : ''}) submitted a custom claim and paid the ₦${amountPaid.toLocaleString()} routing fee (Paystack ref ${verified.reference}).\n\nDescription:\n${description}\n\nReply to this email to reach them directly.`,
        html: `
          <p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}${phone ? `, ${escapeHtml(phone)}` : ''}) submitted a custom claim and paid the routing fee of <strong>₦${amountPaid.toLocaleString()}</strong> (Paystack ref ${escapeHtml(verified.reference)}).</p>
          <p style="white-space:pre-wrap;">${escapeHtml(description)}</p>
          <p style="color:#8A9B8F;font-size:13px;">Reply to this email to reach them directly — Ref: custom_claims/${data.id}</p>
        `,
      })
      notified = true
    } catch (err) {
      // The claim is already saved — a failed notification email shouldn't fail the request,
      // but it must not vanish silently either. `notified` stays false so the admin view
      // surfaces this as needing attention instead of relying entirely on the email arriving.
      console.error('Custom claim saved but notification email failed:', err)
    }
  } else {
    console.error('Custom claim saved but mailer is not configured — no notification sent for', data.id)
  }

  if (notified) {
    await supabaseAdmin.from('custom_claims').update({ notified: true }).eq('id', data.id)
  }

  return Response.json({ ok: true, id: data.id })
}
