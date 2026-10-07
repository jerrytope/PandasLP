export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isAdminEmail } from '@/lib/adminAuth'
import { getAgent } from '@/lib/agents'
import { resolveCasePrice } from '@/lib/casePricing'

// Saves a drafted document to its case and fixes the price the client will be asked to pay.
// AgentChat used to write document_title/document_body/status/expected_amount straight from
// the browser, and /api/verify-payment then trusted expected_amount — so a client could set
// their own price. The browser can no longer write those columns at all (lock-case-columns.sql);
// this route is the only way a document reaches a case before payment, and the price it stores
// comes from lib/casePricing.ts, never from the request as-is.

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 5 * 60 * 1000
const MAX_TITLE_LENGTH = 300
const MAX_BODY_LENGTH = 100_000

// A document can only be (re)drafted before payment. After that the paid-for text is what a
// lawyer reviews and releases, so it must not change underneath them.
const EDITABLE_STATUSES = new Set(['draft', 'document_ready'])

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`save-document:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
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

  let body: { caseId?: string; title?: string; body?: string; price?: number }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { caseId, title, body: docBody, price } = body
  if (!caseId || typeof title !== 'string' || typeof docBody !== 'string') {
    return Response.json({ error: 'Missing caseId, title, or body.' }, { status: 400 })
  }
  if (!title.trim() || !docBody.trim() || title.length > MAX_TITLE_LENGTH || docBody.length > MAX_BODY_LENGTH) {
    return Response.json({ error: 'Invalid or oversized document.' }, { status: 400 })
  }
  if (price !== undefined && typeof price !== 'number') {
    return Response.json({ error: 'Invalid price.' }, { status: 400 })
  }

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('id, user_id, agent_id, status, judgment_amount')
    .eq('id', caseId)
    .single()

  if (caseErr || !caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }
  if (caseData.user_id !== callerData.user.id && !isAdminEmail(callerData.user.email)) {
    return Response.json({ error: 'You do not have access to this case.' }, { status: 403 })
  }
  if (!EDITABLE_STATUSES.has(caseData.status)) {
    return Response.json({ error: 'This document has already been paid for and can no longer be changed.' }, { status: 409 })
  }

  const agent = getAgent(caseData.agent_id)
  if (!agent) {
    return Response.json({ error: 'Unknown agent for this case.' }, { status: 400 })
  }

  const priced = resolveCasePrice(agent.id, price, caseData.judgment_amount ?? null)
  if (priced.ok === false) {
    console.error(`Rejected document price for case ${caseId} (${agent.id}): claimed ${price}`)
    return Response.json({ error: `${priced.error} A Pandas LP lawyer will confirm the fee.` }, { status: 422 })
  }

  // Provisional — /api/update-case-status recalculates this from the real "served" date once
  // staff mark the letter served. 14 days matches the response period stated in the letter
  // itself (see lib/agents.ts) and Form SCA 1's actual demand-letter requirement.
  const deadline = agent.id === 'small-claims' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('cases')
    .update({
      document_title: title,
      document_body: docBody,
      status: 'document_ready',
      expected_amount: priced.amount,
      // Recorded now, before payment, so /api/verify-payment can trust it instead of
      // re-deriving from the paid amount.
      ...(priced.deliveryOption ? { delivery_option: priced.deliveryOption } : {}),
      ...(deadline ? { deadline_at: deadline } : {}),
    })
    .eq('id', caseId)
    // Re-checked in the write itself so a payment landing between the read above and this
    // update can't have its document swapped out.
    .in('status', [...EDITABLE_STATUSES])
    .select('id')

  if (updateErr) {
    console.error('Failed to save document to case:', updateErr)
    return Response.json({ error: 'Could not save the document.' }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return Response.json({ error: 'This document has already been paid for and can no longer be changed.' }, { status: 409 })
  }

  return Response.json({ ok: true, expectedAmount: priced.amount, deliveryOption: priced.deliveryOption })
}
