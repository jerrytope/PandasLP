import { getFollowUpEmail, getPaymentConfirmedEmail, getResolutionEmail, getReviewedDocumentEmail, type FollowUpEmailData } from './emailTemplates'
import { supabaseAdmin } from './supabaseAdmin'
import { isMailerConfigured, sendMail, GMAIL_USER } from './mailer'
import { buildTextDocumentBuffer } from './pdfGenerator.js'

export type SendCaseEmailOptions =
  | { type: 'payment_confirmed' }
  | { type: 'follow_up'; day: 0 | 7 | 14 }
  | { type: 'resolution' }
  | { type: 'reviewed_document' }

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
  let attachments: { filename: string; content: Buffer; contentType?: string }[] | undefined

  if (options.type === 'reviewed_document') {
    if (!caseData.document_title || !caseData.document_body) {
      return { ok: false, error: 'This case has no document to send yet.', status: 400 }
    }
    if (!caseData.reviewed_by) {
      // Guards against calling this before markReviewed has actually run — the whole point
      // of this email is that a named person has reviewed the document first.
      return { ok: false, error: 'This case has not been marked reviewed yet.', status: 409 }
    }
    ;({ subject, html, text } = getReviewedDocumentEmail({
      recipientName,
      caseTitle: caseData.document_title,
      reviewedBy: caseData.reviewed_by,
      deliveryOption: caseData.delivery_option,
      siteUrl,
    }))
    // A staff-uploaded, reviewed-and-stamped PDF takes priority over the auto-generated one
    // if a member of staff has uploaded one for this case (see
    // app/api/admin/upload-reviewed-document/route.ts) — that's the actual signed/stamped
    // document, not just the same text re-rendered. Falls back to generating one from
    // document_body when no stamped version has been uploaded.
    const stampedPath = `reviewed/${caseId}.pdf`
    const { data: stampedBlob } = await supabaseAdmin.storage.from('case-documents').download(stampedPath)
    const pdfBuffer = stampedBlob
      ? Buffer.from(await stampedBlob.arrayBuffer())
      : buildTextDocumentBuffer(caseData.document_title, caseData.document_body, { watermark: false })
    attachments = [{ filename: 'demand-letter.pdf', content: pdfBuffer, contentType: 'application/pdf' }]
  } else if (options.type === 'payment_confirmed') {
    ;({ subject, html, text } = getPaymentConfirmedEmail({
      recipientEmail,
      recipientName,
      caseTitle: caseData.document_title ?? 'Demand Letter',
      amountPaid: caseData.amount_paid ?? 0,
      siteUrl,
    }))
  } else if (options.type === 'follow_up') {
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
  } else {
    ;({ subject, html, text } = getResolutionEmail({
      recipientName,
      caseTitle: caseData.document_title ?? 'your case',
      siteUrl,
      // No Google Business Profile exists yet — GOOGLE_REVIEW_URL is unset, so the email
      // omits the review ask entirely rather than link to a page that doesn't exist.
      reviewUrl: process.env.GOOGLE_REVIEW_URL || undefined,
    }))
  }

  try {
    await sendMail({ to: recipientEmail, replyTo: GMAIL_USER, subject, text, html, attachments })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message, status: 502 }
  }

  if (options.type === 'follow_up') {
    await supabaseAdmin
      .from('cases')
      .update({ [`email_day${options.day}_sent`]: true })
      .eq('id', caseId)
  } else if (options.type === 'resolution') {
    await supabaseAdmin
      .from('cases')
      .update({ resolution_email_sent: true })
      .eq('id', caseId)
  }

  return { ok: true }
}
