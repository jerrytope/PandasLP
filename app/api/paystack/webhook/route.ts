export const runtime = 'nodejs'

import { sendCaseEmail } from '@/lib/sendCaseEmail'
import { syncPaidCaseToRegister } from '@/lib/matterRegisterSync'
import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { claimPaymentReference, isValidPaystackSignature, paystackSecret, verifyPaystackTransaction } from '@/lib/paystackVerify'
import { sendPaymentProblemAlert } from '@/lib/paymentAlerts'

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`paystack-webhook:${getClientIp(req)}`, 120, 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const secret = paystackSecret()
  if (!secret) return Response.json({ error: 'Payments are not configured.' }, { status: 503 })

  const rawBody = await req.text()
  if (!isValidPaystackSignature(rawBody, req.headers.get('x-paystack-signature'), secret)) {
    return Response.json({ error: 'Invalid signature.' }, { status: 401 })
  }
  let event: { event?: string; data?: { reference?: unknown } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid event body.' }, { status: 400 })
  }
  if (event.event !== 'charge.success' || typeof event.data?.reference !== 'string' || !event.data.reference) {
    return Response.json({ ok: true, ignored: true })
  }

  const transaction = await verifyPaystackTransaction(event.data.reference, secret)
  if (transaction.ok === false) {
    return Response.json({ error: transaction.error }, { status: transaction.status === 402 ? 200 : 502 })
  }
  if (!transaction.caseId) {
    await sendPaymentProblemAlert({ caseId: null, reference: transaction.reference, amount: transaction.amount, reason: 'Paystack payment has no case attached.', clientEmail: transaction.customerEmail })
    return Response.json({ ok: true, unmatched: true })
  }

  const { data: caseData, error: caseError } = await supabaseAdmin.from('cases').select('*').eq('id', transaction.caseId).maybeSingle()
  if (caseError) return Response.json({ error: 'Could not load the paid case.' }, { status: 500 })
  if (!caseData) {
    await sendPaymentProblemAlert({ caseId: transaction.caseId, reference: transaction.reference, amount: transaction.amount, reason: 'Paystack reported a payment for a case that does not exist.', clientEmail: transaction.customerEmail })
    return Response.json({ ok: true, unmatched: true })
  }

  const { data: priorReference, error: priorReferenceError } = await supabaseAdmin
    .from('payment_references')
    .select('purpose, target_id')
    .eq('reference', transaction.reference)
    .maybeSingle()
  if (priorReferenceError) return Response.json({ error: 'Could not confirm payment reference ownership.' }, { status: 500 })
  if (priorReference) {
    if (priorReference.purpose === 'case' && priorReference.target_id === caseData.id) {
      if (['paid', 'letter_served', 'filed', 'judgment_obtained', 'closed'].includes(caseData.status)) {
        return Response.json({ ok: true, alreadyApplied: true })
      }
      return Response.json({ error: 'Payment is still being applied.' }, { status: 503 })
    }
    await sendPaymentProblemAlert({
      caseId: caseData.id,
      reference: transaction.reference,
      amount: transaction.amount,
      reason: 'This payment reference has already been used for another transaction.',
      clientEmail: transaction.customerEmail,
    })
    return Response.json({ ok: true, refused: true })
  }

  if (['paid', 'letter_served', 'filed', 'judgment_obtained', 'closed'].includes(caseData.status)) {
    await sendPaymentProblemAlert({
      caseId: caseData.id,
      reference: transaction.reference,
      amount: transaction.amount,
      reason: `Paystack reported a new payment for a case already in status "${caseData.status}".`,
      clientEmail: transaction.customerEmail,
    })
    return Response.json({ ok: true, alreadyPaid: true })
  }
  const expectedAmount = caseData.expected_amount
  if (typeof expectedAmount !== 'number' || expectedAmount <= 0 || Math.abs(expectedAmount - transaction.amount) > 1) {
    await sendPaymentProblemAlert({
      caseId: caseData.id,
      reference: transaction.reference,
      amount: transaction.amount,
      reason: `Payment amount does not match the case price (${expectedAmount ?? 'no confirmed price'}).`,
      clientEmail: transaction.customerEmail,
    })
    return Response.json({ ok: true, refused: true })
  }

  const claimed = await claimPaymentReference(transaction.reference, 'case', transaction.amount, caseData.id)
  if (claimed.ok === false) {
    if (claimed.status === 500) return Response.json({ error: claimed.error }, { status: 500 })
    const { data: existingReference, error: referenceError } = await supabaseAdmin.from('payment_references').select('purpose, target_id').eq('reference', transaction.reference).maybeSingle()
    if (referenceError) return Response.json({ error: 'Could not confirm payment reference ownership.' }, { status: 500 })
    if (existingReference?.purpose === 'case' && existingReference.target_id === caseData.id) {
      const { data: currentCase, error: currentCaseError } = await supabaseAdmin.from('cases').select('status').eq('id', caseData.id).maybeSingle()
      if (currentCaseError) return Response.json({ error: 'Could not confirm case payment status.' }, { status: 500 })
      if (currentCase && ['paid', 'letter_served', 'filed', 'judgment_obtained', 'closed'].includes(currentCase.status)) {
        return Response.json({ ok: true, alreadyApplied: true })
      }
      return Response.json({ error: 'Payment is still being applied.' }, { status: 503 })
    }
    await sendPaymentProblemAlert({ caseId: caseData.id, reference: transaction.reference, amount: transaction.amount, reason: 'This payment reference has already been used for another transaction.', clientEmail: transaction.customerEmail })
    return Response.json({ ok: true, refused: true })
  }

  const deliveryOption = caseData.agent_id === 'small-claims'
    ? (caseData.delivery_option ?? (transaction.amount >= 40_000 ? 'pandas-serves' : 'self-serve'))
    : null
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('cases')
    .update({
      status: 'paid',
      amount_paid: transaction.amount,
      paid_at: new Date().toISOString(),
      ...(deliveryOption ? { delivery_option: deliveryOption } : {}),
    })
    .eq('id', caseData.id)
    .eq('status', caseData.status)
    .select('id')
  if (updateError) {
    await supabaseAdmin.from('payment_references').delete().eq('reference', transaction.reference)
    return Response.json({ error: 'Payment verified but could not update the case.' }, { status: 500 })
  }
  if (!updated?.length) {
    await sendPaymentProblemAlert({
      caseId: caseData.id,
      reference: transaction.reference,
      amount: transaction.amount,
      reason: 'The case changed while this payment was being applied; staff must verify whether the payment should be refunded or matched.',
      clientEmail: transaction.customerEmail,
    })
    return Response.json({ ok: true, needsReview: true })
  }

  after(() => syncPaidCaseToRegister(caseData.id).then(() => undefined))

  const emailResult = await sendCaseEmail(caseData.id, { type: 'payment_confirmed' })
  if (emailResult.ok === false) console.error(`Case ${caseData.id} was paid, but confirmation email failed:`, emailResult.error)
  return Response.json({ ok: true })
}
