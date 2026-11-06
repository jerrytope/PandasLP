export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 5 * 60 * 1000

// The court filing for one case (Court filing tab in the case drawer): GET loads it with its
// documents; POST saves facts, dates and outcomes, or a document the practitioner edited.
// See add-court-filings.sql and lib/courtFiling.ts.

const DATE_FIELDS = ['demand_served_at', 'filed_at', 'summons_issued_at', 'first_hearing_at', 'served_at', 'defence_received_at', 'settled_at', 'judgment_at', 'enforcement_started_at'] as const
const TEXT_FIELDS = ['state', 'registry', 'demand_service_proof', 'claim_number', 'service_outcome', 'defence_type', 'defence_summary', 'hearing_notes', 'judgment_outcome', 'notes'] as const
const INT_FIELDS = ['filing_fee', 'judgment_sum'] as const

function missingTable(err: { code?: string; message?: string } | null) {
  return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /court_filing/.test(err.message ?? '') && /does not exist|schema cache/.test(err.message ?? ''))
}
const SETUP_MSG = 'The court filing tables are not set up yet. Run add-court-filings.sql in the Supabase SQL editor.'

export async function GET(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const caseId = new URL(req.url).searchParams.get('caseId')
  if (!caseId) return Response.json({ error: 'Missing caseId.' }, { status: 400 })

  const { data: filing, error } = await supabaseAdmin.from('court_filings').select('*').eq('case_id', caseId).maybeSingle()
  if (error) {
    if (missingTable(error)) return Response.json({ error: SETUP_MSG, setupNeeded: true }, { status: 503 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  let documents: unknown[] = []
  if (filing) {
    const { data } = await supabaseAdmin.from('court_filing_documents').select('*').eq('filing_id', filing.id).order('created_at', { ascending: false })
    documents = data ?? []
  }
  // Earliest evidence the demand letter was served, to pre-fill step 1.
  const { data: svc } = await supabaseAdmin.from('service_records').select('channel, status, dispatched_at, acknowledged_at').eq('case_id', caseId).order('dispatched_at', { ascending: true })
  return Response.json({ filing, documents, serviceRecords: svc ?? [] })
}

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-court-filing:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) return Response.json({ error: 'Too many requests — please wait a moment.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const by = authResult.user.email || 'unknown'

  let body: { caseId?: string; patch?: Record<string, unknown>; document?: { kind?: string; title?: string; body?: string } }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { caseId } = body
  if (!caseId) return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  if ('state' in (body.patch ?? {}) && !['lagos', 'delta'].includes(String(body.patch?.state))) {
    return Response.json({ error: 'Court filing is currently supported only in Lagos and Delta.' }, { status: 400 })
  }

  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from('cases')
    .select('agent_id, brand_id')
    .eq('id', caseId)
    .maybeSingle()
  if (caseError) return Response.json({ error: 'Could not load the case.' }, { status: 500 })
  if (!caseRow) return Response.json({ error: 'Case not found.' }, { status: 404 })
  if (caseRow.agent_id !== 'small-claims' || caseRow.brand_id) {
    return Response.json({ error: 'Court filing is available only for Small Claims matters.' }, { status: 409 })
  }

  // Make sure the filing row exists.
  let { data: filing, error } = await supabaseAdmin.from('court_filings').select('*').eq('case_id', caseId).maybeSingle()
  if (error) {
    if (missingTable(error)) return Response.json({ error: SETUP_MSG, setupNeeded: true }, { status: 503 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!filing) {
    const ins = await supabaseAdmin.from('court_filings').insert({ case_id: caseId, updated_by: by }).select('*').single()
    if (ins.error) return Response.json({ error: ins.error.message }, { status: 500 })
    filing = ins.data
  }

  if (body.patch) {
    const p = body.patch
    const update: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: by }
    for (const k of DATE_FIELDS) if (k in p) {
      const v = p[k]
      if (v === null || v === '') update[k] = null
      else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) update[k] = v
      else return Response.json({ error: `${k} must be a date (YYYY-MM-DD).` }, { status: 400 })
    }
    for (const k of TEXT_FIELDS) if (k in p) update[k] = p[k] === '' ? null : typeof p[k] === 'string' ? (p[k] as string).trim() : null
    for (const k of INT_FIELDS) if (k in p) {
      const n = p[k] === '' || p[k] === null ? null : Math.round(Number(p[k]))
      if (n !== null && (!Number.isFinite(n) || n < 0)) return Response.json({ error: `${k} must be a positive number.` }, { status: 400 })
      update[k] = n
    }
    if ('facts' in p && p.facts && typeof p.facts === 'object') update.facts = p.facts
    const { data, error: upErr } = await supabaseAdmin.from('court_filings').update(update).eq('id', filing.id).select('*').single()
    if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
    filing = data
  }

  if (body.document) {
    const { kind, title, body: text } = body.document
    if (!kind || !title || !text?.trim()) return Response.json({ error: 'A document needs a kind, title and text.' }, { status: 400 })
    const { error: dErr } = await supabaseAdmin.from('court_filing_documents').insert({ filing_id: filing.id, kind, title, body: text, ai_generated: false, created_by: by })
    if (dErr) return Response.json({ error: dErr.message }, { status: 500 })
  }

  const { data: documents } = await supabaseAdmin.from('court_filing_documents').select('*').eq('filing_id', filing.id).order('created_at', { ascending: false })
  return Response.json({ filing, documents: documents ?? [] })
}
