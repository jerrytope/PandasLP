export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isAdminEmail } from '@/lib/adminAuth'
import { sendCaseEmail } from '@/lib/sendCaseEmail'

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 5 * 60 * 1000

type Action = 'markReviewed' | 'sendReviewedDocument' | 'markServed' | 'markFiled' | 'markJudgment' | 'markClosed'

// Each action's required prior status — without this, the dashboard's status-changing
// buttons were only gated by client-side UI, and the actual database write (a raw
// supabase.update() from the browser) had no server-side check that the case was really
// eligible to move to that stage. RLS only verifies row ownership, not transition validity.
const REQUIRED_PRIOR_STATUS: Record<Action, string> = {
  markReviewed: 'paid',
  sendReviewedDocument: 'paid',
  markServed: 'paid',
  markFiled: 'letter_served',
  markJudgment: 'filed',
  markClosed: 'judgment_obtained',
}

// markReviewed/sendReviewedDocument don't move status forward — a case is still "paid",
// just now also reviewed and/or sent (see reviewed_at/reviewed_by/reviewed_document_sent_at
// below). They're flags, not stages.
const NEXT_STATUS: Record<Action, string> = {
  markReviewed: 'paid',
  sendReviewedDocument: 'paid',
  markServed: 'letter_served',
  markFiled: 'filed',
  markJudgment: 'judgment_obtained',
  markClosed: 'closed',
}

// Terminal stages that should trigger the "your case is resolved" email — see
// lib/emailTemplates.ts's getResolutionEmail. resolution_email_sent guards against firing
// twice for a case that passes through judgment_obtained and later gets closed.
const RESOLUTION_STAGES = new Set(['judgment_obtained', 'closed'])

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`update-case-status:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
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

  let body: { caseId?: string; action?: Action }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { caseId, action } = body
  if (!caseId || !action || !(action in REQUIRED_PRIOR_STATUS)) {
    return Response.json({ error: 'Missing or invalid caseId/action.' }, { status: 400 })
  }

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single()

  if (caseErr || !caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }
  if (caseData.user_id !== callerData.user.id && !isAdminEmail(callerData.user.email)) {
    return Response.json({ error: 'You do not have access to this case.' }, { status: 403 })
  }
  // markReviewed certifies that a licensed member of staff reviewed the document, and
  // sendReviewedDocument is staff choosing when to actually release it — the case owner
  // doing either would defeat the entire point of the gate, so both are admin-only
  // regardless of ownership, unlike every other action above.
  if ((action === 'markReviewed' || action === 'sendReviewedDocument') && !isAdminEmail(callerData.user.email)) {
    return Response.json({ error: 'Only a member of staff can do this.' }, { status: 403 })
  }

  const requiredStatus = REQUIRED_PRIOR_STATUS[action]
  if (caseData.status !== requiredStatus) {
    return Response.json(
      { error: `This case must be "${requiredStatus}" before it can move to the next stage (it's currently "${caseData.status}").` },
      { status: 409 },
    )
  }
  // Can't send what hasn't been reviewed yet.
  if (action === 'sendReviewedDocument' && !caseData.reviewed_at) {
    return Response.json({ error: 'This document must be reviewed before it can be sent.' }, { status: 409 })
  }
  // Nobody — client or staff — can mark a case served before a lawyer has actually reviewed
  // the document. This is the real substantive gate; skipping it would let an unreviewed
  // letter go out just because the status machinery allowed the click.
  if (action === 'markServed' && !caseData.reviewed_at) {
    return Response.json({ error: 'This document must be reviewed before it can be marked served.' }, { status: 409 })
  }

  const update: Record<string, unknown> = { status: NEXT_STATUS[action] }
  if (action === 'markReviewed') {
    update.reviewed_at = new Date().toISOString()
    update.reviewed_by = callerData.user.email
  }
  // sendReviewedDocument does NOT set reviewed_document_sent_at here — that only happens
  // further down, after sendCaseEmail actually confirms success. Setting it here would
  // record a successful send even if the email fails.
  if (action === 'markServed') {
    // 14 days — the response period Form SCA 1 (Lagos Small Claims Court Practice
    // Directions) prescribes for a letter of demand, not the 7-day figure that appears
    // elsewhere in the same practice direction for a *later* stage (defence filing after
    // a summons is served). See lib/agents.ts's demand letter templates for the same period.
    update.deadline_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  }

  const { error: updateErr } = await supabaseAdmin.from('cases').update(update).eq('id', caseId)
  if (updateErr) {
    return Response.json({ error: 'Failed to update case status.' }, { status: 500 })
  }

  const nextStatus = NEXT_STATUS[action]

  // Audit trail — fire-and-forget, same reasoning as the emails below: a failed log write
  // must never fail or roll back a status change that already succeeded. Skipped for
  // markReviewed/sendReviewedDocument since status doesn't actually change (paid -> paid
  // would just be noise); the timestamp columns on the case row are already the accurate
  // record of those events.
  if (action !== 'markReviewed' && action !== 'sendReviewedDocument') {
    supabaseAdmin
      .from('case_status_history')
      .insert({ case_id: caseId, from_status: caseData.status, to_status: nextStatus, changed_by: callerData.user.email })
      .then(({ error }) => {
        if (error) console.error('Failed to write case_status_history:', error)
      })
  }

  if (action === 'sendReviewedDocument') {
    // Awaited, not fire-and-forget, unlike the other emails in this route — sending IS the
    // point of this specific action, so staff should see a real error if it fails rather
    // than a false "success" while nothing actually went out. reviewed_document_sent_at is
    // only written once the send is confirmed — see the comment above the `update` object.
    const result = await sendCaseEmail(caseId, { type: 'reviewed_document' })
    if (result.ok === false) {
      return Response.json({ error: result.error }, { status: result.status })
    }
    await supabaseAdmin.from('cases').update({ reviewed_document_sent_at: new Date().toISOString() }).eq('id', caseId)
  }

  if (RESOLUTION_STAGES.has(nextStatus) && !caseData.resolution_email_sent) {
    // Fire-and-forget — same pattern as the confirmation emails elsewhere in this codebase
    // (AgentChat.tsx's handlePaymentDone). A failed send shouldn't roll back a status change
    // that already succeeded.
    sendCaseEmail(caseId, { type: 'resolution' }).catch((err) => console.error('Failed to send resolution email:', err))
  }

  return Response.json({ ok: true, status: nextStatus })
}
