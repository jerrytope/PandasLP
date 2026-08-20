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

  // "paid_plus" isn't a real status — it's the post-launch default view (staff want real,
  // transacted customers by default, not every abandoned/incomplete interview), so it expands
  // to every stage from first payment onward rather than matching a single column value.
  const PAID_PLUS_STATUSES = ['paid', 'letter_served', 'filed', 'judgment_obtained', 'closed']

  let query = supabaseAdmin.from('cases').select('*').order('created_at', { ascending: false })
  if (statusFilter === 'paid_plus') query = query.in('status', PAID_PLUS_STATUSES)
  else if (statusFilter) query = query.eq('status', statusFilter)
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

export async function DELETE(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-cases-delete:${getClientIp(req)}`, 20, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const url = new URL(req.url)
  const caseId = url.searchParams.get('caseId')?.trim()
  if (!caseId) {
    return Response.json({ error: 'Missing caseId query parameter.' }, { status: 400 })
  }

  // Verify the case exists before attempting delete so we can return a meaningful 404.
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .single()

  if (fetchErr || !existing) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }

  // Hard-delete — ON DELETE CASCADE on messages.case_id and case_status_history.case_id
  // means related rows are automatically removed by Postgres. No orphan risk.
  const { error: deleteErr } = await supabaseAdmin
    .from('cases')
    .delete()
    .eq('id', caseId)

  if (deleteErr) {
    return Response.json({ error: 'Failed to delete case.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
