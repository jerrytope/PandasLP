export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { lagosToday } from '@/lib/negotiationStatus'

const WINDOW_DAYS = 7

// Open negotiation follow-ups across every case, soonest first: anything overdue, due today,
// or due within the next week. Feeds the "Negotiation follow-ups" section of the admin queue
// (app/admin/components/NegotiationFollowUps.tsx). Test cases are left out, like the rest of
// the queue.
export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-negotiations-due:${getClientIp(req)}`, 60, 5 * 60 * 1000)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const today = lagosToday()
  const horizon = new Date(`${today}T00:00:00Z`)
  horizon.setUTCDate(horizon.getUTCDate() + WINDOW_DAYS)

  const { data, error } = await supabaseAdmin
    .from('case_negotiations')
    .select('id, case_id, party, status, next_action, next_action_due, occurred_at, cases!inner(document_title, case_number, is_test)')
    .not('next_action', 'is', null)
    .is('next_action_done_at', null)
    .not('next_action_due', 'is', null)
    .lte('next_action_due', horizon.toISOString().slice(0, 10))
    .eq('cases.is_test', false)
    .order('next_action_due', { ascending: true })

  if (error) {
    console.error('Failed to load negotiation follow-ups:', error)
    return Response.json({ error: `Could not load negotiation follow-ups. (${error.message})` }, { status: 500 })
  }

  const items = (data || []).map((r) => {
    const c = (Array.isArray(r.cases) ? r.cases[0] : r.cases) as { document_title: string | null; case_number: number | null } | null
    return {
      id: r.id,
      caseId: r.case_id,
      caseTitle: c?.document_title ?? null,
      caseNumber: c?.case_number ?? null,
      status: r.status,
      nextAction: r.next_action,
      nextActionDue: r.next_action_due,
      overdue: r.next_action_due < today,
      dueToday: r.next_action_due === today,
    }
  })

  return Response.json({ today, items })
}
