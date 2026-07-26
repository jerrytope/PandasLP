export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { getNewOrderAlertEmail } from '@/lib/emailTemplates'

const RATE_LIMIT = 15
const RATE_WINDOW_MS = 5 * 60 * 1000

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const AMOUNT_TOLERANCE_NAIRA = 1 // guard against float/kobo rounding, not a real discount

function isPaystackConfigured() {
  return Boolean(PAYSTACK_SECRET_KEY) && !PAYSTACK_SECRET_KEY.includes('placeholder')
}

// Stub mode (no real PAYSTACK_SECRET_KEY) trusts the client-reported amount entirely — fine
// for local/preview testing, not fine if it's ever live on the real production domain. This
// is a deliberate, explicit opt-in so an accidentally-unset key fails loudly instead of
// silently giving away the service for free. Set ALLOW_STUB_PAYMENTS=true only if you
// genuinely want production running in test mode for a short window.
function stubPaymentsAllowedHere() {
  const isRealProduction = process.env.VERCEL_ENV === 'production'
  if (!isRealProduction) return true
  return process.env.ALLOW_STUB_PAYMENTS === 'true'
}

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

  const expectedAmount: number | null = caseData.expected_amount ?? null

  let verifiedAmount: number
  let verifiedReference: string

  if (!isPaystackConfigured()) {
    // No live Paystack secret key yet — this project is still in test mode
    // (NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is a placeholder too, see lib/paystackHelper.js), so
    // PaymentForm's stub checkout never moved real money. There is nothing to verify against;
    // trust the client-reported amount ONLY because no real gateway is wired up at all. The
    // moment a real PAYSTACK_SECRET_KEY is set, this branch stops being reachable in practice
    // (isPaystackConfigured() becomes true) and every payment is independently verified below.
    if (!stub) {
      return Response.json({ error: 'Payment gateway is not configured.' }, { status: 503 })
    }
    if (!stubPaymentsAllowedHere()) {
      return Response.json(
        { error: 'Payments are not yet configured on this site. Please try again shortly.' },
        { status: 503 },
      )
    }
    verifiedAmount = amount
    verifiedReference = reference
  } else {
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    })
    const verifyData = await verifyRes.json().catch(() => null)

    if (!verifyRes.ok || !verifyData?.status || !verifyData.data) {
      return Response.json({ error: 'Could not verify payment with Paystack.' }, { status: 502 })
    }
    if (verifyData.data.status !== 'success') {
      return Response.json({ error: 'Payment was not successful.' }, { status: 402 })
    }

    verifiedAmount = verifyData.data.amount / 100 // kobo → naira
    verifiedReference = verifyData.data.reference
  }

  if (expectedAmount !== null && Math.abs(verifiedAmount - expectedAmount) > AMOUNT_TOLERANCE_NAIRA) {
    return Response.json(
      { error: `Amount paid (₦${verifiedAmount}) does not match the quoted price (₦${expectedAmount}).` },
      { status: 400 },
    )
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
    return Response.json({ error: 'Payment verified but failed to update the case.' }, { status: 500 })
  }

  // Fire-and-forget, staff-facing — the "click here to review" alert that starts the
  // mandatory-review flow (see app/api/update-case-status/route.ts's markReviewed action). A
  // failed send here shouldn't fail a payment that already succeeded; the admin panel's Queue
  // tab is the fallback if this email doesn't land.
  if (isMailerConfigured()) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { subject, html, text } = getNewOrderAlertEmail({
      caseTitle: caseData.document_title ?? 'Untitled case',
      clientEmail: callerData.user.email ?? 'unknown',
      amountPaid: verifiedAmount,
      agentId: caseData.agent_id,
      caseId,
      siteUrl,
    })
    sendMail({ to: GMAIL_USER, subject, html, text }).catch((err) => console.error('Failed to send new-order alert email:', err))
  }

  return Response.json({ ok: true, amount: verifiedAmount, reference: verifiedReference })
}
