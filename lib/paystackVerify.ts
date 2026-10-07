// Server-side payment checks shared by every route that takes money: /api/verify-payment
// (cases) and /api/custom-claim (the custom-claim routing fee). Server-only: reads
// PAYSTACK_SECRET_KEY and writes with the service-role key.
//
// Two rules every paid flow must follow:
//   1. Never trust the browser's word that a payment happened or how much it was for. The
//      checkout's success callback proves nothing — anyone can call the API with a made-up
//      reference. verifyPayment() asks Paystack itself.
//   2. A payment pays for ONE thing. Without claimPaymentReference(), one real ₦25,000
//      payment's reference could be replayed to mark any number of ₦25,000 cases paid.

import { isProduction } from './appEnv'
import { supabaseAdmin } from './supabaseAdmin'

const AMOUNT_TOLERANCE_NAIRA = 1 // guard against float/kobo rounding, not a real discount

export type PaymentPurpose = 'case' | 'custom_claim'

export type VerifiedPayment =
  | { ok: true; amount: number; reference: string }
  | { ok: false; status: number; error: string }

export function isPaystackConfigured(): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY
  return Boolean(key) && !key.includes('placeholder')
}

// Stub mode (no real PAYSTACK_SECRET_KEY) trusts the client-reported amount entirely — fine
// for local/preview testing, not fine if it's ever live on the real production domain. This
// is a deliberate, explicit opt-in so an accidentally-unset key fails loudly instead of
// silently giving away the service for free. Set ALLOW_STUB_PAYMENTS=true only if you
// genuinely want production running in test mode for a short window.
export function stubPaymentsAllowedHere(): boolean {
  if (!isProduction()) return true
  return process.env.ALLOW_STUB_PAYMENTS === 'true'
}

/**
 * Confirm a payment of `expectedAmount` naira happened, by asking Paystack.
 *
 * `clientAmount` and `stub` are what the browser reported; they are only used in stub mode,
 * when there is no real gateway to ask (see stubPaymentsAllowedHere).
 */
export async function verifyPayment(opts: {
  reference: string
  expectedAmount: number
  clientAmount?: number
  stub?: boolean
}): Promise<VerifiedPayment> {
  let amount: number
  let reference: string

  if (!isPaystackConfigured()) {
    // No live Paystack secret key — PaymentForm's stub checkout never moved real money, so
    // there is nothing to verify against. The moment a real key is set, this branch stops
    // being reachable and every payment is independently verified below.
    if (!opts.stub) {
      return { ok: false, status: 503, error: 'Payment gateway is not configured.' }
    }
    if (!stubPaymentsAllowedHere()) {
      return { ok: false, status: 503, error: 'Payments are not yet configured on this site. Please try again shortly.' }
    }
    if (typeof opts.clientAmount !== 'number') {
      return { ok: false, status: 400, error: 'Missing amount.' }
    }
    amount = opts.clientAmount
    reference = opts.reference
  } else {
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(opts.reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    }).catch(() => null)
    const verifyData = verifyRes ? await verifyRes.json().catch(() => null) : null

    if (!verifyRes?.ok || !verifyData?.status || !verifyData.data) {
      return { ok: false, status: 502, error: 'Could not verify payment with Paystack.' }
    }
    if (verifyData.data.status !== 'success') {
      return { ok: false, status: 402, error: 'Payment was not successful.' }
    }
    if (verifyData.data.currency && verifyData.data.currency !== 'NGN') {
      return { ok: false, status: 400, error: 'Payment was not made in naira.' }
    }
    amount = verifyData.data.amount / 100 // kobo → naira
    reference = verifyData.data.reference
  }

  if (Math.abs(amount - opts.expectedAmount) > AMOUNT_TOLERANCE_NAIRA) {
    return {
      ok: false,
      status: 400,
      error: `Amount paid (₦${amount}) does not match the quoted price (₦${opts.expectedAmount}).`,
    }
  }
  return { ok: true, amount, reference }
}

/**
 * Record that `reference` has paid for something. Returns false if it was already used —
 * by anything, in any flow — in which case the caller must NOT grant what was paid for.
 * The primary key on payment_references.reference is what makes this race-safe.
 */
export async function claimPaymentReference(
  reference: string,
  purpose: PaymentPurpose,
  amount: number,
  targetId: string | null,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { error } = await supabaseAdmin
    .from('payment_references')
    .insert({ reference, purpose, amount, target_id: targetId })
  if (!error) return { ok: true }
  if (error.code === '23505') {
    return { ok: false, status: 409, error: 'This payment has already been used.' }
  }
  console.error('Failed to record payment reference:', error)
  return { ok: false, status: 500, error: 'Could not record the payment. Please contact support.' }
}

/** Point a claimed reference at what it ended up paying for (e.g. the new claim's id). */
export async function linkPaymentReference(reference: string, targetId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('payment_references').update({ target_id: targetId }).eq('reference', reference)
  if (error) console.error('Failed to link payment reference:', error)
}

/** Undo a claim when the thing it was paying for could not be saved, so the client can retry. */
export async function releasePaymentReference(reference: string): Promise<void> {
  const { error } = await supabaseAdmin.from('payment_references').delete().eq('reference', reference)
  if (error) console.error('Failed to release payment reference:', error)
}
