export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAiManager } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { getAgent } from '@/lib/agents'

// Real client conversations, so the lead lawyer can see how an agent actually drafted.
// GET ?agentId=  → the latest cases for that agent (brand matters and test cases left out)
// GET ?caseId=   → one case: the conversation, the drafted document, and for a property matter
//                  its area, state and saved facts.

const RATE_LIMIT = 120
const RATE_WINDOW_MS = 5 * 60 * 1000
const PAGE = 50

export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`manageai-convos:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) return Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const auth = await requireAiManager(req)
  if (auth instanceof Response) return auth

  const url = new URL(req.url)
  const caseId = url.searchParams.get('caseId')
  const agentId = url.searchParams.get('agentId')

  if (caseId) {
    const [{ data: c, error: caseErr }, { data: messages, error: msgErr }, { data: matter }] = await Promise.all([
      supabaseAdmin.from('cases').select('id, case_number, agent_id, status, document_title, document_body, created_at').eq('id', caseId).maybeSingle(),
      supabaseAdmin.from('messages').select('role, content, created_at').eq('case_id', caseId).order('created_at', { ascending: true }),
      supabaseAdmin.from('property_matters').select('area, state, lagos_area, facts, status').eq('case_id', caseId).maybeSingle(),
    ])
    if (caseErr || msgErr) return Response.json({ error: 'Could not load the conversation.' }, { status: 500 })
    if (!c) return Response.json({ error: 'Case not found.' }, { status: 404 })
    return Response.json({ case: c, messages: messages ?? [], matter: matter ?? null })
  }

  if (!agentId || !getAgent(agentId)) return Response.json({ error: 'Unknown agent.' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('cases')
    .select('id, case_number, status, document_title, created_at')
    .eq('agent_id', agentId)
    .is('brand_id', null)
    .or('is_test.is.null,is_test.eq.false')
    .order('created_at', { ascending: false })
    .limit(PAGE)
  if (error) return Response.json({ error: 'Could not load the conversations.' }, { status: 500 })

  // The property area of each case, where the rebuilt agent recorded one.
  const ids = (data ?? []).map((c) => c.id)
  const areas = new Map<string, string | null>()
  if (agentId === 'recovery-of-premises' && ids.length) {
    const { data: matters } = await supabaseAdmin.from('property_matters').select('case_id, area').in('case_id', ids)
    for (const m of matters ?? []) areas.set(m.case_id, m.area)
  }
  return Response.json({ cases: (data ?? []).map((c) => ({ ...c, area: areas.get(c.id) ?? null })) })
}
