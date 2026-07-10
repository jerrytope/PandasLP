export const runtime = 'nodejs'

import { getFollowUpEmail, getPaymentConfirmedEmail, type FollowUpEmailData } from '@/lib/emailTemplates'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'

export async function POST(req: Request) {
  if (!isMailerConfigured()) {
    return Response.json({ error: 'Email not configured — add GMAIL_APP_PASSWORD to .env.local.' }, { status: 503 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return Response.json({ error: 'Missing Authorization header.' }, { status: 401 })
  }
  const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token)
  if (callerErr || !callerData?.user) {
    return Response.json({ error: 'Invalid or expired session.' }, { status: 401 })
  }

  let body: { caseId: string; type?: 'payment_confirmed'; day?: 0 | 3 | 7 }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { caseId, type, day } = body
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single()

  if (caseErr || !caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }

  if (caseData.user_id !== callerData.user.id) {
    return Response.json({ error: 'You do not have access to this case.' }, { status: 403 })
  }

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(caseData.user_id)
  const recipientEmail = userData?.user?.email
  if (!recipientEmail) {
    return Response.json({ error: 'User email not found.' }, { status: 404 })
  }

  const recipientName = recipientEmail.split('@')[0]
  let subject: string
  let html: string
  let text: string

  if (type === 'payment_confirmed') {
    ;({ subject, html, text } = getPaymentConfirmedEmail({
      recipientEmail,
      recipientName,
      caseTitle: caseData.document_title ?? 'Demand Letter',
      amountPaid: caseData.amount_paid ?? 0,
      siteUrl,
    }))
  } else {
    if (day === undefined) {
      return Response.json({ error: 'Missing day for follow-up email.' }, { status: 400 })
    }
    const emailData: FollowUpEmailData = {
      recipientEmail,
      recipientName,
      debtorName: caseData.document_title ?? 'the debtor',
      amount: caseData.amount_paid ?? 0,
      caseId,
      day,
      siteUrl,
    }
    ;({ subject, html, text } = getFollowUpEmail(emailData))
  }

  try {
    await sendMail({
      to: recipientEmail,
      replyTo: GMAIL_USER,
      subject,
      text,
      html,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 502 })
  }

  if (type !== 'payment_confirmed' && day !== undefined) {
    await supabaseAdmin
      .from('cases')
      .update({ [`email_day${day}_sent`]: true })
      .eq('id', caseId)
  }

  return Response.json({ ok: true })
}
