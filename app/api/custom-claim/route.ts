export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'

interface CustomClaimBody {
  name?: string
  email?: string
  phone?: string
  description?: string
  amountPaid?: number
}

export async function POST(req: Request) {
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
          <p><strong>${name}</strong> (${email}${phone ? `, ${phone}` : ''}) submitted a custom claim and paid the routing fee of <strong>₦${(amountPaid ?? 0).toLocaleString()}</strong>.</p>
          <p style="white-space:pre-wrap;">${description}</p>
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
