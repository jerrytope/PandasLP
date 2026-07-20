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

  // cases.user_id is an auth.users id, not an email — resolve emails in one batched call
  // rather than N+1 lookups. listUsers() is paginated; 1000/page comfortably covers this
  // project's expected scale. If that ever stops being true, switch to per-id
  // getUserById() lookups for just the user_ids actually present in `cases`.
  const { data: usersPage, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (usersErr) {
    return Response.json({ error: 'Failed to resolve client emails.' }, { status: 500 })
  }
  const emailById = new Map<string, string>()
  for (const u of usersPage.users) {
    emailById.set(u.id, u.email ?? '')
  }

  let enriched = (cases ?? []).map((c) => ({ ...c, userEmail: emailById.get(c.user_id) ?? '' }))

  if (emailFilter) {
    enriched = enriched.filter((c) => c.userEmail.toLowerCase().includes(emailFilter))
  }

  return Response.json({ cases: enriched, total: enriched.length })
}
