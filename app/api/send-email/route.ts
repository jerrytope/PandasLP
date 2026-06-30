export const runtime = 'nodejs'

import nodemailer from 'nodemailer'
import { getFollowUpEmail, type FollowUpEmailData } from '@/lib/emailTemplates'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const GMAIL_USER = 'pandaslegalpractitioners@gmail.com'

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
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

  let body: { caseId: string; day: 0 | 3 | 7 }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { caseId, day } = body

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

  const emailData: FollowUpEmailData = {
    recipientEmail,
    recipientName: recipientEmail.split('@')[0],
    debtorName: caseData.document_title ?? 'the debtor',
    amount: caseData.amount_paid ?? 0,
    caseId,
    day,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  }

  const { subject, html } = getFollowUpEmail(emailData)

  try {
    await getTransporter().sendMail({
      from: `Pandas LP <${GMAIL_USER}>`,
      to: recipientEmail,
      subject,
      html,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 502 })
  }

  await supabaseAdmin
    .from('cases')
    .update({ [`email_day${day}_sent`]: true })
    .eq('id', caseId)

  return Response.json({ ok: true })
}
