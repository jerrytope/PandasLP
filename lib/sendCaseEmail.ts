import { getFollowUpEmail, getPaymentConfirmedEmail, type FollowUpEmailData } from './emailTemplates'
import { supabaseAdmin } from './supabaseAdmin'
import { isMailerConfigured, sendMail, GMAIL_USER } from './mailer'

export type SendCaseEmailOptions = { type: 'payment_confirmed' } | { type: 'follow_up'; day: 0 | 7 | 14 }

export type SendCaseEmailResult = { ok: true } | { ok: false; error: string; status: number }

// Shared by app/api/send-email/route.ts (session-triggered: payment confirmation, the Day 0
// "mark served" send) and app/api/cron/follow-ups/route.ts (system-triggered: Day 7/Day 14).
// Callers are responsible for their own auth/rate-limiting — this only knows how to
// actually build and send the right email for a given case.
export async function sendCaseEmail(caseId: string, options: SendCaseEmailOptions): Promise<SendCaseEmailResult> {
  if (!isMailerConfigured()) {
    return { ok: false, error: 'Email not configured — add GMAIL_APP_PASSWORD to .env.local.', status: 503 }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single()

  if (caseErr || !caseData) {
    return { ok: false, error: 'Case not found.', status: 404 }
  }

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(caseData.user_id)
  const recipientEmail = userData?.user?.email
  if (!recipientEmail) {
    return { ok: false, error: 'User email not found.', status: 404 }
  }

  const recipientName = recipientEmail.split('@')[0]
  let subject: string
  let html: string
  let text: string

  if (options.type === 'payment_confirmed') {
    ;({ subject, html, text } = getPaymentConfirmedEmail({
      recipientEmail,
      recipientName,
      caseTitle: caseData.document_title ?? 'Demand Letter',
      amountPaid: caseData.amount_paid ?? 0,
      siteUrl,
    }))
  } else {
    const emailData: FollowUpEmailData = {
      recipientEmail,
      recipientName,
      debtorName: caseData.document_title ?? 'the debtor',
      amount: caseData.amount_paid ?? 0,
      caseId,
      agentId: caseData.agent_id,
      day: options.day,
      siteUrl,
    }
    ;({ subject, html, text } = getFollowUpEmail(emailData))
  }

  try {
    await sendMail({ to: recipientEmail, replyTo: GMAIL_USER, subject, text, html })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message, status: 502 }
  }

  if (options.type === 'follow_up') {
    await supabaseAdmin
      .from('cases')
      .update({ [`email_day${options.day}_sent`]: true })
      .eq('id', caseId)
  }

  return { ok: true }
}
