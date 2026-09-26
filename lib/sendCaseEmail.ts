import { getFollowUpEmail, getPaymentConfirmedEmail, getRecoveryConfirmedEmail, getResolutionEmail, getReviewedDocumentEmail, getNegotiationReplyEmail, getNegotiationAdviceEmail, type FollowUpEmailData } from './emailTemplates'
import { supabaseAdmin } from './supabaseAdmin'
import { isMailerConfigured, sendMail, GMAIL_USER } from './mailer'
import { buildTextDocumentBuffer } from './pdfGenerator.js'
import { TERMS_OF_USE_TITLE, TERMS_OF_USE_TEXT } from './legalDocs'
import { buildRecoveryOffers } from './recoveryOffers'

export type SendCaseEmailOptions =
  | { type: 'payment_confirmed' }
  | { type: 'follow_up'; day: 0 | 7 | 14 }
  | { type: 'resolution' }
  | { type: 'reviewed_document' }
  | { type: 'recovery_confirmed'; recoveryId: string }
  | { type: 'negotiation_reply'; negotiationId: string }
  | { type: 'negotiation_advice'; negotiationId: string }

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

  // A lawyer-intake case (see app/admin/page.tsx's Custom Claims tab) is owned by the staff
  // member who ran the session, not the actual client — the client never has a Supabase
  // account for auth.admin.getUserById to resolve at all. client_email, captured directly
  // from the agent conversation (see lib/agentChatParsing.ts's extractClientEmail), is the
  // real recipient for those cases and always takes priority when it's set.
  let recipientEmail = caseData.client_email as string | null
  if (!recipientEmail) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(caseData.user_id)
    recipientEmail = userData?.user?.email ?? null
  }
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
    // Terms of Use is sent alongside every reviewed document — same letterhead PDF renderer,
    // content transcribed from app/terms/page.tsx (see lib/legalDocs.ts's own header comment
    // for the sync caveat), with a signature block appended so the client has something
    // physically signable, not just something to read.
    const termsBuffer = buildTextDocumentBuffer(TERMS_OF_USE_TITLE, TERMS_OF_USE_TEXT, { watermark: false })
    attachments = [
      { filename: 'demand-letter.pdf', content: pdfBuffer, contentType: 'application/pdf' },
      { filename: 'pandas-lp-terms-of-use.pdf', content: termsBuffer, contentType: 'application/pdf' },
    ]
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
  } else if (options.type === 'recovery_confirmed') {
    // The amounts and the shortfall reason are read back from the recovery row rather than
    // passed in by the caller, so what the client is told is exactly what was recorded and
    // evidenced. There is no path where this email can state a figure the firm did not confirm.
    const { data: recovery, error: recoveryErr } = await supabaseAdmin
      .from('recoveries')
      .select('amount_recovered, is_full, shortfall_reason')
      .eq('id', options.recoveryId)
      .eq('case_id', caseId)
      .single()

    if (recoveryErr || !recovery) {
      return { ok: false, error: 'Recovery record not found.', status: 404 }
    }

    ;({ subject, html, text } = getRecoveryConfirmedEmail({
      recipientName,
      caseTitle: caseData.document_title ?? 'your case',
      amountRecovered: recovery.amount_recovered,
      isFull: recovery.is_full,
      shortfallReason: recovery.shortfall_reason ?? undefined,
      siteUrl,
      // Same rule as the resolution email: unset means no review ask at all rather than a
      // link to a Google profile that does not exist. getRecoveryConfirmedEmail additionally
      // suppresses it on a partial recovery.
      reviewUrl: process.env.GOOGLE_REVIEW_URL || undefined,
      // Only agents that are actually live, with hand-written copy. See lib/recoveryOffers.ts.
      offers: buildRecoveryOffers(siteUrl, caseData.agent_id),
    }))
  } else if (options.type === 'negotiation_advice') {
    const { data: round, error: roundErr } = await supabaseAdmin
      .from('case_negotiations')
      .select('id, party, advice_note')
      .eq('id', options.negotiationId)
      .eq('case_id', caseId)
      .single()
    if (roundErr || !round || round.party !== 'debtor_counsel' || !round.advice_note?.trim()) {
      return { ok: false, error: 'No saved advice note to send for this response.', status: 404 }
    }
    ;({ subject, html, text } = getNegotiationAdviceEmail({
      recipientName,
      caseTitle: caseData.document_title ?? 'your case',
      adviceNote: round.advice_note,
    }))
  } else if (options.type === 'negotiation_reply') {
    // Read back from the actual logged row, same reasoning as recovery_confirmed above —
    // the client is told exactly what was recorded, never a figure or summary the caller
    // happened to pass in.
    const { data: round, error: roundErr } = await supabaseAdmin
      .from('case_negotiations')
      .select('summary, attachment_path, party')
      .eq('id', options.negotiationId)
      .eq('case_id', caseId)
      .single()

    if (roundErr || !round || round.party !== 'pandas_lp') {
      return { ok: false, error: 'Negotiation reply not found.', status: 404 }
    }

    ;({ subject, html, text } = getNegotiationReplyEmail({
      recipientName,
      caseTitle: caseData.document_title ?? 'your case',
      replySummary: round.summary,
      siteUrl,
    }))

    if (round.attachment_path) {
      const { data: replyBlob } = await supabaseAdmin.storage.from('case-documents').download(round.attachment_path)
      if (replyBlob) {
        attachments = [{
          filename: 'reply-to-counter-offer.pdf',
          content: Buffer.from(await replyBlob.arrayBuffer()),
          contentType: 'application/pdf',
        }]
      }
    }
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
  } else if (options.type === 'recovery_confirmed') {
    // Stamped only after sendMail resolves, so the admin UI's "client notified" state means
    // the message actually left, not that we intended to send one.
    await supabaseAdmin
      .from('recoveries')
      .update({ client_notified_at: new Date().toISOString() })
      .eq('id', options.recoveryId)
  }

  return { ok: true }
}
