export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { LEAD_STATUSES } from '@/lib/debtCheck'

const COLUMNS = 'id, created_at, name, phone, email, answers, amount_naira, verdict, next_step, note, source, source_detail, status, staff_notes, contacted_at, updated_by, notified'

// GET: the most recent leads from the free debt check, newest first.
export async function GET(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const { data, error } = await supabaseAdmin.from('debt_checks').select(COLUMNS).order('created_at', { ascending: false }).limit(500)
  if (error) return Response.json({ error: `Could not load leads. (${error.message})` }, { status: 500 })
  return Response.json({ leads: (data || []).map((l) => ({ ...l, amount_naira: Number(l.amount_naira) })) })
}

// PATCH { id, status?, staffNotes? }: move a lead along and keep notes on the call.
export async function PATCH(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  let body: { id?: string; status?: string; staffNotes?: string | null }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.id) return Response.json({ error: 'Missing id.' }, { status: 400 })

  const update: Record<string, unknown> = { updated_by: authResult.user.email ?? 'unknown' }
  if (body.status !== undefined) {
    if (!(LEAD_STATUSES as readonly string[]).includes(body.status)) return Response.json({ error: 'Unknown status.' }, { status: 400 })
    update.status = body.status
    if (body.status !== 'new') update.contacted_at = new Date().toISOString()
  }
  if (body.staffNotes !== undefined) update.staff_notes = body.staffNotes?.trim().slice(0, 4000) || null

  const { data: existing } = await supabaseAdmin.from('debt_checks').select('contacted_at').eq('id', body.id).maybeSingle()
  if (!existing) return Response.json({ error: 'Lead not found.' }, { status: 404 })
  // Keep the first contact time; later status changes shouldn't overwrite it.
  if (existing.contacted_at) delete update.contacted_at

  const { data, error } = await supabaseAdmin.from('debt_checks').update(update).eq('id', body.id).select(COLUMNS).single()
  if (error || !data) return Response.json({ error: `Could not save. ${error ? `(${error.message})` : ''}` }, { status: 500 })
  return Response.json({ ok: true, lead: { ...data, amount_naira: Number(data.amount_naira) } })
}
