// The lawyer queue (add-property-lawyer-queue.sql) for Admin → Action Queue: property matters
// flagged as needing a lawyer and not yet taken, and what staff can do with one. Server-only.

import { supabaseAdmin } from '../supabaseAdmin'

export interface LawyerQueueRow {
  caseId: string
  area: string | null
  state: string | null
  status: string
  reason: string | null
  flaggedAt: string
  documentTitle: string | null
  clientEmail: string | null
}

/**
 * What staff can do with a flagged matter. All three take it out of the queue.
 *   take             a lawyer has it; the client still sees "a lawyer is handling this matter"
 *   return_to_agent  the client can carry on with the agent (status back to active)
 *   close            the matter is finished (status closed)
 */
export type LawyerAction = 'take' | 'return_to_agent' | 'close'
export const LAWYER_ACTIONS: LawyerAction[] = ['take', 'return_to_agent', 'close']

export async function listLawyerQueue(): Promise<LawyerQueueRow[]> {
  const { data, error } = await supabaseAdmin
    .from('property_matters')
    .select('case_id, area, state, status, needs_lawyer_reason, needs_lawyer_at, cases(document_title, client_email)')
    .not('needs_lawyer_at', 'is', null)
    .is('lawyer_taken_at', null)
    .order('needs_lawyer_at', { ascending: true })
  if (error) throw new Error(`Lawyer queue: ${error.message}`)
  type Row = {
    case_id: string; area: string | null; state: string | null; status: string; needs_lawyer_reason: string | null; needs_lawyer_at: string
    cases: { document_title: string | null; client_email: string | null } | { document_title: string | null; client_email: string | null }[] | null
  }
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const c = Array.isArray(r.cases) ? r.cases[0] : r.cases
    return {
      caseId: r.case_id,
      area: r.area,
      state: r.state,
      status: r.status,
      reason: r.needs_lawyer_reason,
      flaggedAt: r.needs_lawyer_at,
      documentTitle: c?.document_title ?? null,
      clientEmail: c?.client_email ?? null,
    }
  })
}

export async function actOnMatter(caseId: string, action: LawyerAction, by: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: matter, error: readErr } = await supabaseAdmin.from('property_matters').select('case_id, status').eq('case_id', caseId).maybeSingle()
  if (readErr) return { ok: false, status: 500, error: 'Could not load the matter.' }
  if (!matter) return { ok: false, status: 404, error: 'No property matter for that case.' }

  const update: Record<string, unknown> = { lawyer_taken_at: new Date().toISOString(), lawyer_taken_by: by }
  if (action === 'return_to_agent') update.status = 'active'
  if (action === 'close') update.status = 'closed'
  const { error } = await supabaseAdmin.from('property_matters').update(update).eq('case_id', caseId)
  if (error) return { ok: false, status: 500, error: 'Could not update the matter.' }
  await supabaseAdmin.from('property_matter_events').insert({ case_id: caseId, kind: 'lawyer_taken', payload: { by, action, previousStatus: matter.status } })
  return { ok: true }
}
