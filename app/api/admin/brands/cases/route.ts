export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'

// The borrowers of one brand, for the brand's detail list on Admin → Brands, with any open
// flags (unknown or duplicated Case IDs typed into the sheet).
export async function GET(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const params = new URL(req.url).searchParams
  // One borrower and their timeline, for the case drawer of a brand matter.
  const caseId = params.get('caseId')
  if (caseId) {
    const { data: bc } = await supabaseAdmin
      .from('brand_cases')
      .select('id, case_ref, status, borrower, letter_url, last_error, served_at, day7_sent_at, day14_sent_at, awaiting_brand_decision_at, billable_at, brands(name, code)')
      .eq('case_id', caseId)
      .maybeSingle()
    if (!bc) return Response.json({ brandCase: null, events: [] })
    const { data: events } = await supabaseAdmin
      .from('brand_case_events')
      .select('id, event_type, detail, actor, created_at')
      .eq('brand_case_id', bc.id)
      .order('created_at', { ascending: true })
    return Response.json({ brandCase: bc, events: events ?? [] })
  }

  const brandId = params.get('brandId')
  if (!brandId) return Response.json({ error: 'Missing brandId or caseId.' }, { status: 400 })

  const [{ data: cases, error }, { data: flags }] = await Promise.all([
    supabaseAdmin
      .from('brand_cases')
      .select('id, case_ref, status, case_id, borrower, missing_items, letter_url, last_error, attempts, served_at, day7_sent_at, day14_sent_at, awaiting_brand_decision_at, created_at, updated_at')
      .eq('brand_id', brandId)
      .order('case_ref', { ascending: true }),
    supabaseAdmin
      .from('brand_change_flags')
      .select('id, kind, case_ref, column_name, old_value, new_value, detected_at')
      .eq('brand_id', brandId)
      .is('resolved_at', null)
      .order('detected_at', { ascending: false }),
  ])
  if (error) return Response.json({ error: 'Failed to load borrowers.' }, { status: 500 })
  return Response.json({ cases: cases ?? [], flags: flags ?? [] })
}

// "Retry" on a borrower whose letter failed to draft 3 times: clears the counter so the next
// sync tries again. Only for borrowers still waiting (status New) — never re-drafts a letter.
export async function POST(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const body = (await req.json().catch(() => ({}))) as { brandCaseId?: string; action?: string }
  if (!body.brandCaseId || body.action !== 'retry') return Response.json({ error: 'Missing brandCaseId or unknown action.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('brand_cases')
    .update({ attempts: 0, last_error: null })
    .eq('id', body.brandCaseId)
    .eq('status', 'new')
    .select('id, case_ref')
  if (error) return Response.json({ error: 'Could not reset the borrower.' }, { status: 500 })
  if (!data?.length) return Response.json({ error: 'Only a borrower still marked New can be retried.' }, { status: 409 })

  await supabaseAdmin.from('brand_case_events').insert({
    brand_case_id: data[0].id,
    case_ref: data[0].case_ref,
    event_type: 'retry_requested',
    actor: authResult.user.email ?? 'staff',
  })
  return Response.json({ ok: true })
}
