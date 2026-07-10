export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const AMOUNT_TOLERANCE_NAIRA = 1 // guard against float/kobo rounding, not a real discount

function isPaystackConfigured() {
  return Boolean(PAYSTACK_SECRET_KEY) && !PAYSTACK_SECRET_KEY.includes('placeholder')
}

export async function POST(req: Request) {
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

  // Delivery option for small-claims is derived from the verified amount, never trusted
  // from the client — ₦25,000 is the only tier where Pandas LP personally serves the letter.
  const deliveryOption =
    caseData.agent_id === 'small-claims' ? (verifiedAmount >= 25000 ? 'pandas-serves' : 'self-serve') : null

  const { error: updateErr } = await supabaseAdmin
    .from('cases')
    .update({
      status: 'paid',
      amount_paid: verifiedAmount,
      ...(deliveryOption ? { delivery_option: deliveryOption } : {}),
    })
    .eq('id', caseId)

  if (updateErr) {
    return Response.json({ error: 'Payment verified but failed to update the case.' }, { status: 500 })
  }

  return Response.json({ ok: true, amount: verifiedAmount, reference: verifiedReference })
}
