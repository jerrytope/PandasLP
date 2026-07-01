export const runtime = 'nodejs'

import nodemailer from 'nodemailer'
import { getFollowUpEmail, getPaymentConfirmedEmail, type FollowUpEmailData } from '@/lib/emailTemplates'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const GMAIL_USER = 'pandaslegalpractitioners@gmail.com'

function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function POST(req: Request) {
  const appPassword = process.env.GMAIL_APP_PASSWORD
  if (!appPassword || appPassword === 'REPLACE_WITH_GOOGLE_APP_PASSWORD') {
    return Response.json({ error: 'Email not configured — add GMAIL_APP_PASSWORD to .env.local.' }, { status: 503 })
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
    await getTransporter().sendMail({
      from: `Pandas LP <${GMAIL_USER}>`,
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
