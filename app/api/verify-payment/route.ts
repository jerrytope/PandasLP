export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { getNewOrderAlertEmail } from '@/lib/emailTemplates'
import { buildDemandLetterDocxBuffer } from '@/lib/docxGenerator.js'
import { verifyPayment, claimPaymentReference, releasePaymentReference } from '@/lib/paystackVerify'

const RATE_LIMIT = 15
const RATE_WINDOW_MS = 5 * 60 * 1000

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`verify-payment:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
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

  let body: { caseId?: string; reference?: string; amount?: number; stub?: boolean }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { caseId, reference, amount, stub } = body
  if (!caseId || !reference || typeof amount !== 'number') {
    return Response.json({ error: 'Missing caseId, reference, or amount.' }, { status: 400 })
  }

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
  if (caseData.status === 'paid' || ['letter_served', 'filed', 'judgment_obtained', 'closed'].includes(caseData.status)) {
    // Already processed — most likely a duplicate SDK callback or a retried request.
    // Report success without re-verifying or re-emailing.
    return Response.json({ ok: true, amount: caseData.amount_paid, alreadyPaid: true })
  }

  // Set only by /api/save-document (server-side, from lib/casePricing.ts) — the browser has no
  // write access to this column (see lock-case-columns.sql), so it is safe to check the
  // payment against. No price on record means no saved document to pay for, and 0 means the
  // firm invoices the fee directly; neither may be paid through here. This used to skip the
  // amount check entirely when expected_amount was null, accepting any amount at all.
  const expectedAmount: number | null = caseData.expected_amount ?? null
  if (expectedAmount === null || expectedAmount <= 0) {
    return Response.json({ error: 'There is no confirmed price for this case yet.' }, { status: 409 })
  }

  const verified = await verifyPayment({ reference, expectedAmount, clientAmount: amount, stub })
  if (verified.ok === false) {
    return Response.json({ error: verified.error }, { status: verified.status })
  }
  const verifiedAmount = verified.amount
  const verifiedReference = verified.reference

  // One payment pays for one case. Before this, a single real payment's reference could be
  // replayed against any number of other cases at the same price.
  const claimed = await claimPaymentReference(verifiedReference, 'case', verifiedAmount, caseId)
  if (claimed.ok === false) {
    return Response.json({ error: claimed.error }, { status: claimed.status })
  }

  // Delivery option for small-claims is normally already set on the case row (AgentChat.tsx's
  // saveTurn writes it from the chosen tier at document-finalization time, before payment) —
  // trust that first. The amount-derivation fallback only exists for cases that predate this
  // field; deriving fresh from verifiedAmount here would misclassify a discounted pandas-serves
  // purchase (verifiedAmount < 25000) as self-serve even though that's the tier the client paid for.
  const deliveryOption =
    caseData.agent_id === 'small-claims'
      ? (caseData.delivery_option ?? (verifiedAmount >= 25000 ? 'pandas-serves' : 'self-serve'))
      : null

  const { error: updateErr } = await supabaseAdmin
    .from('cases')
    .update({
      status: 'paid',
      amount_paid: verifiedAmount,
      paid_at: new Date().toISOString(),
      ...(deliveryOption ? { delivery_option: deliveryOption } : {}),
    })
    .eq('id', caseId)

  if (updateErr) {
    // Free the reference so the client's retry with the same payment isn't refused as reused.
    await releasePaymentReference(verifiedReference)
    return Response.json({ error: 'Payment verified but failed to update the case.' }, { status: 500 })
  }

  // Fire-and-forget, staff-facing — the "click here to review" alert that starts the
  // mandatory-review flow (see app/api/update-case-status/route.ts's markReviewed action). A
  // failed send here shouldn't fail a payment that already succeeded; the admin panel's Queue
  // tab is the fallback if this email doesn't land.
  if (isMailerConfigured()) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

    // The unwatermarked, editable copy of the drafted letter, attached straight to this alert
    // — see lib/docxGenerator.js. Before this, the only way to see what a client actually paid
    // for was to open the admin panel and download a read-only PDF; this puts the real document
    // in the reviewer's inbox in a format Word can open and mark up directly. Best-effort: some
    // cases reach "paid" with no document yet (e.g. property law's percentage-fee deeds, invoiced
    // outside the app), so a missing document_body just means no attachment, not a failed alert —
    // and a build failure here must never take the payment-confirmation email down with it. Built
    // BEFORE the email template call below so the alert can honestly say whether it's attached,
    // rather than always claiming one is there.
    let attachments: { filename: string; content: Buffer; contentType?: string }[] | undefined
    if (caseData.document_title && caseData.document_body) {
      try {
        const docxBuffer = await buildDemandLetterDocxBuffer(caseData.document_body)
        attachments = [{
          filename: 'demand-letter-for-review.docx',
          content: docxBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }]
      } catch (err) {
        console.error('Failed to build review DOCX for new-order alert:', err)
      }
    }

    const { subject, html, text } = getNewOrderAlertEmail({
      caseTitle: caseData.document_title ?? 'Untitled case',
      clientEmail: callerData.user.email ?? 'unknown',
      amountPaid: verifiedAmount,
      agentId: caseData.agent_id,
      caseId,
      siteUrl,
      hasEditableDraftAttached: attachments !== undefined,
    })

    sendMail({ to: GMAIL_USER, subject, html, text, attachments }).catch((err) => console.error('Failed to send new-order alert email:', err))
  }

  return Response.json({ ok: true, amount: verifiedAmount, reference: verifiedReference })
}
