export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { sendCaseEmail } from '@/lib/sendCaseEmail'

// Shared Gmail account has a real daily send cap — this endpoint is the only thing standing
// between one authenticated user looping it and every user's transactional email breaking.
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 10 * 60 * 1000

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`send-email:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
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

  let body: { caseId: string; type?: 'payment_confirmed'; day?: 0 | 7 | 14 }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { caseId, type, day } = body

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('user_id')
    .eq('id', caseId)
    .single()

  if (caseErr || !caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }
  if (caseData.user_id !== callerData.user.id) {
    return Response.json({ error: 'You do not have access to this case.' }, { status: 403 })
  }

  if (type !== 'payment_confirmed' && day === undefined) {
    return Response.json({ error: 'Missing day for follow-up email.' }, { status: 400 })
  }

  const result = await sendCaseEmail(
    caseId,
    type === 'payment_confirmed' ? { type: 'payment_confirmed' } : { type: 'follow_up', day: day! },
  )

  if (result.ok === false) {
    console.error('sendCaseEmail failed:', result.error)
    return Response.json({ error: 'Could not send the email. Please try again.' }, { status: result.status })
  }

  return Response.json({ ok: true })
}
