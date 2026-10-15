export const runtime = 'nodejs'

import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { actOnMatter, LAWYER_ACTIONS, listLawyerQueue, type LawyerAction } from '@/lib/property/lawyerQueue'

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 5 * 60 * 1000

function limited(req: Request): Response | null {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-property-matters:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  return allowed
    ? null
    : Response.json({ error: 'Too many requests — please wait a moment before trying again.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
}

// GET   property matters that need a lawyer and haven't been taken (Admin → Action Queue)
export async function GET(req: Request) {
  const tooMany = limited(req)
  if (tooMany) return tooMany
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  try {
    return Response.json({ matters: await listLawyerQueue() })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to load.' }, { status: 500 })
  }
}

// POST  { caseId, action: 'take' | 'return_to_agent' | 'close' }
export async function POST(req: Request) {
  const tooMany = limited(req)
  if (tooMany) return tooMany
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { caseId?: unknown; action?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.caseId !== 'string' || !LAWYER_ACTIONS.includes(body.action as LawyerAction)) {
    return Response.json({ error: `Send caseId and an action: ${LAWYER_ACTIONS.join(', ')}.` }, { status: 400 })
  }
  const result = await actOnMatter(body.caseId, body.action as LawyerAction, authResult.user.email ?? 'staff')
  return result.ok === false ? Response.json({ error: result.error }, { status: result.status }) : Response.json({ ok: true })
}
