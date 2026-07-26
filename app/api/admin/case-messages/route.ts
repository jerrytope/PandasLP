export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 5 * 60 * 1000

// Lets staff read the interview transcript for a case that hasn't produced a document yet
// (still "draft" — mid-interview, abandoned, or otherwise never reached document_ready).
// There's nothing to show via the existing "View Letter" (document_body is null at this
// stage), but the conversation itself is still useful context for a sales follow-up call.
export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-case-messages:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const url = new URL(req.url)
  const caseId = url.searchParams.get('caseId')
  if (!caseId) {
    return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('role, content, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: 'Failed to load messages.' }, { status: 500 })
  }

  return Response.json({ messages: data ?? [] })
}
