export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isAdminEmail } from '@/lib/adminAuth'

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 5 * 60 * 1000

type Action = 'markServed' | 'markFiled' | 'markJudgment'

// Each action's required prior status — without this, the dashboard's status-changing
// buttons were only gated by client-side UI, and the actual database write (a raw
// supabase.update() from the browser) had no server-side check that the case was really
// eligible to move to that stage. RLS only verifies row ownership, not transition validity.
const REQUIRED_PRIOR_STATUS: Record<Action, string> = {
  markServed: 'paid',
  markFiled: 'letter_served',
  markJudgment: 'filed',
}

const NEXT_STATUS: Record<Action, string> = {
  markServed: 'letter_served',
  markFiled: 'filed',
  markJudgment: 'judgment_obtained',
}

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

  const requiredStatus = REQUIRED_PRIOR_STATUS[action]
  if (caseData.status !== requiredStatus) {
    return Response.json(
      { error: `This case must be "${requiredStatus}" before it can move to the next stage (it's currently "${caseData.status}").` },
      { status: 409 },
    )
  }

  const update: Record<string, unknown> = { status: NEXT_STATUS[action] }
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

  return Response.json({ ok: true, status: NEXT_STATUS[action] })
}
