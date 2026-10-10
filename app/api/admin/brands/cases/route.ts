export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { brandWorkspaceOrNull } from '@/lib/brandServing'
import { deliverForBorrower } from '@/lib/brandWebhooks'
import { courtApprovalLink, recordCourtApproval, resolveFlag, setOutcome, type ActionResult, type Outcome } from '@/lib/brandExceptions'

const RATE_WINDOW_MS = 5 * 60 * 1000

function reply(result: ActionResult) {
  return result.ok === false ? Response.json({ error: result.error }, { status: result.status }) : Response.json({ ok: true })
}

// GET ?brandId=…   the borrowers of one brand (Admin → Brands), with any open flags (&test=1: its API test borrowers)
// GET ?caseId=…    one borrower and their timeline, for the case drawer of a brand matter
// GET ?awaiting=1  borrowers past Day 14 waiting for their brand's decision (Action Queue)
// GET ?brandCaseId=…  one borrower's history (Admin → Brands → borrowers), including API and
//                  test borrowers, which have no matter until (or ever) a letter is drafted
export async function GET(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const params = new URL(req.url).searchParams
  const brandCaseId = params.get('brandCaseId')
  if (brandCaseId) {
    const { data: events } = await supabaseAdmin
      .from('brand_case_events')
      .select('id, event_type, detail, actor, created_at')
      .eq('brand_case_id', brandCaseId)
      .order('created_at', { ascending: true })
    return Response.json({ events: events ?? [] })
  }
  const caseId = params.get('caseId')
  if (caseId) {
    const { data: bc } = await supabaseAdmin
      .from('brand_cases')
      .select(
        'id, case_ref, status, borrower, letter_url, last_error, served_at, day7_sent_at, day14_sent_at, awaiting_brand_decision_at, billable_at, billed_invoice_id, court_approved_at, court_approved_by, court_approval_note, court_approval_evidence_path, brands(name, code)',
      )
      .eq('case_id', caseId)
      .maybeSingle()
    if (!bc) return Response.json({ brandCase: null, events: [] })
    const [{ data: events }, evidenceUrl] = await Promise.all([
      supabaseAdmin.from('brand_case_events').select('id, event_type, detail, actor, created_at').eq('brand_case_id', bc.id).order('created_at', { ascending: true }),
      bc.court_approval_evidence_path ? courtApprovalLink(bc.court_approval_evidence_path) : Promise.resolve(null),
    ])
    return Response.json({ brandCase: { ...bc, court_approval_evidence_url: evidenceUrl }, events: events ?? [] })
  }

  if (params.get('awaiting')) {
    const { data, error } = await supabaseAdmin
      .from('brand_cases')
      .select('id, case_ref, case_id, borrower, awaiting_brand_decision_at, brands(name)')
      .eq('status', 'day14_sent')
      .eq('is_test', false)
      .is('court_approved_at', null)
      .order('awaiting_brand_decision_at', { ascending: true })
    if (error) return Response.json({ error: 'Failed to load.' }, { status: 500 })
    return Response.json({ cases: data ?? [] })
  }

  const brandId = params.get('brandId')
  if (!brandId) return Response.json({ error: 'Missing brandId, caseId or awaiting.' }, { status: 400 })

  const [{ data: cases, error }, { data: flags }] = await Promise.all([
    supabaseAdmin
      .from('brand_cases')
      .select('id, case_ref, status, case_id, borrower, missing_items, letter_url, last_error, attempts, served_at, day7_sent_at, day14_sent_at, awaiting_brand_decision_at, court_approved_at, source, external_ref, is_test, created_at, updated_at')
      .eq('brand_id', brandId)
      .eq('is_test', params.get('test') === '1')
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

type Body = {
  action?: 'retry' | 'outcome' | 'court_approval' | 'resolve_flag'
  brandCaseId?: string
  flagId?: string
  outcome?: Outcome
  decision?: 'accept' | 'keep' | 'noted'
  note?: string
  fileBase64?: string
}

// Staff actions on a borrower:
//   retry           a letter that failed to draft 3 times: the next sync tries again (New only)
//   outcome         Paid, Disputed or Closed
//   court_approval  the brand's written go-ahead for court: a note and a PDF/image copy
//   resolve_flag    decide on an edited or missing row
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-brand-cases:${getClientIp(req)}`, 60, RATE_WINDOW_MS)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const actor = authResult.user.email ?? 'staff'

  const body = (await req.json().catch(() => ({}))) as Body
  const note = typeof body.note === 'string' ? body.note : ''

  if (body.action === 'resolve_flag') {
    if (!body.flagId || !body.decision) return Response.json({ error: 'Missing flagId or decision.' }, { status: 400 })
    const result = await resolveFlag(body.flagId, body.decision, note, actor)
    return reply(result)
  }

  if (!body.brandCaseId) return Response.json({ error: 'Missing brandCaseId.' }, { status: 400 })

  if (body.action === 'outcome') {
    if (!body.outcome) return Response.json({ error: 'Missing outcome.' }, { status: 400 })
    const result = await setOutcome(body.brandCaseId, body.outcome, note, actor, brandWorkspaceOrNull())
    if (result.ok) await deliverForBorrower(body.brandCaseId) // an API brand hears straight away
    return reply(result)
  }

  if (body.action === 'court_approval') {
    if (typeof body.fileBase64 !== 'string' || !body.fileBase64) return Response.json({ error: 'Attach a copy of the brand’s written approval.' }, { status: 400 })
    if (body.fileBase64.length > 4_200_000) return Response.json({ error: 'File too large. Maximum size is 3 MB.' }, { status: 413 })
    const result = await recordCourtApproval(body.brandCaseId, note, Buffer.from(body.fileBase64, 'base64'), actor)
    return reply(result)
  }

  if (body.action !== 'retry') return Response.json({ error: 'Unknown action.' }, { status: 400 })
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
    actor,
  })
  return Response.json({ ok: true })
}
