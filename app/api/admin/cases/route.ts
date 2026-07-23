export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 5 * 60 * 1000

export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-cases:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get('status')
  const agentFilter = url.searchParams.get('agentId')
  const emailFilter = url.searchParams.get('email')?.trim().toLowerCase()

  let query = supabaseAdmin.from('cases').select('*').order('created_at', { ascending: false })
  if (statusFilter) query = query.eq('status', statusFilter)
  if (agentFilter) query = query.eq('agent_id', agentFilter)

  const { data: cases, error: casesErr } = await query
  if (casesErr) {
    return Response.json({ error: 'Failed to load cases.' }, { status: 500 })
  }

  // cases.user_id is an auth.users id, not an email — resolve emails for just the users
  // actually present in this page of cases, in parallel, rather than either N+1 sequential
  // lookups or a listUsers() scan (which silently truncates past 1000 total auth users).
  const uniqueUserIds = [...new Set((cases ?? []).map((c) => c.user_id))]
  const emailById = new Map<string, string>()
  const userLookups = await Promise.all(
    uniqueUserIds.map((id) => supabaseAdmin.auth.admin.getUserById(id)),
  )
  for (const { data } of userLookups) {
    if (data?.user) emailById.set(data.user.id, data.user.email ?? '')
  }

  let enriched = (cases ?? []).map((c) => ({ ...c, userEmail: emailById.get(c.user_id) ?? '' }))

  if (emailFilter) {
    enriched = enriched.filter((c) => c.userEmail.toLowerCase().includes(emailFilter))
  }

  return Response.json({ cases: enriched, total: enriched.length })
}
