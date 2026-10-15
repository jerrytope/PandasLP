// The saved record of a property matter (add-property-matters.sql). Server-only: uses the
// service-role client. The tools take a MatterStore rather than calling this module directly,
// so their tests run without a database.

import { supabaseAdmin } from '../supabaseAdmin'
import type { MatterEvent, MatterEventKind, MatterStatus, PropertyArea, PropertyMatter } from './types'

export interface MatterStore {
  mergeFacts(caseId: string, facts: Record<string, unknown>): Promise<Record<string, unknown>>
  setArea(caseId: string, area: PropertyArea): Promise<void>
  setStatus(caseId: string, status: MatterStatus): Promise<void>
  logEvent(caseId: string, kind: MatterEventKind, payload?: Record<string, unknown>): Promise<void>
  events(caseId: string, kind?: MatterEventKind): Promise<MatterEvent[]>
}

type MatterRow = {
  case_id: string
  state: string | null
  lagos_area: string | null
  area: PropertyArea | null
  facts: Record<string, unknown> | null
  status: MatterStatus
}

function toMatter(row: MatterRow): PropertyMatter {
  return {
    caseId: row.case_id,
    state: row.state,
    lagosArea: row.lagos_area,
    area: row.area,
    facts: row.facts ?? {},
    status: row.status,
  }
}

function fail(action: string, error: { message: string }): never {
  throw new Error(`Property matter: could not ${action}: ${error.message}`)
}

const COLUMNS = 'case_id, state, lagos_area, area, facts, status'

/** The matter for a case, created (status 'routing', no area) the first time it's asked for. */
export async function getOrCreateMatter(caseId: string): Promise<PropertyMatter> {
  // ignoreDuplicates: two requests at once both "create", and both then read the one row.
  const { error: insertErr } = await supabaseAdmin
    .from('property_matters')
    .upsert({ case_id: caseId }, { onConflict: 'case_id', ignoreDuplicates: true })
  if (insertErr) fail('create the matter', insertErr)
  const { data, error } = await supabaseAdmin.from('property_matters').select(COLUMNS).eq('case_id', caseId).single()
  if (error || !data) fail('load the matter', error ?? { message: 'not found' })
  return toMatter(data as MatterRow)
}

export async function setState(caseId: string, state: string, lagosArea: string | null = null): Promise<void> {
  const { error } = await supabaseAdmin.from('property_matters').update({ state, lagos_area: lagosArea }).eq('case_id', caseId)
  if (error) fail('save the state', error)
}

export async function setArea(caseId: string, area: PropertyArea): Promise<void> {
  const { error } = await supabaseAdmin.from('property_matters').update({ area, status: 'active' }).eq('case_id', caseId)
  if (error) fail('save the area', error)
}

export async function setStatus(caseId: string, status: MatterStatus): Promise<void> {
  const { error } = await supabaseAdmin.from('property_matters').update({ status }).eq('case_id', caseId)
  if (error) fail('save the status', error)
}

/** Merges facts into the matter in one statement and returns all of its facts. */
export async function mergeFacts(caseId: string, facts: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseAdmin.rpc('merge_property_matter_facts', { p_case_id: caseId, p_facts: facts })
  if (error) fail('save the facts', error)
  if (data === null) fail('save the facts', { message: 'no matter for this case' })
  return data as Record<string, unknown>
}

export async function logEvent(caseId: string, kind: MatterEventKind, payload: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabaseAdmin.from('property_matter_events').insert({ case_id: caseId, kind, payload })
  if (error) fail(`log the ${kind} event`, error)
}

/** The matter's events, oldest first, optionally of one kind. */
export async function events(caseId: string, kind?: MatterEventKind): Promise<MatterEvent[]> {
  let query = supabaseAdmin.from('property_matter_events').select('kind, payload, created_at').eq('case_id', caseId)
  if (kind) query = query.eq('kind', kind)
  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) fail('read the events', error)
  return (data ?? []).map((e) => ({ kind: e.kind as MatterEventKind, payload: (e.payload ?? {}) as Record<string, unknown>, createdAt: e.created_at as string }))
}

/**
 * Puts the matter in the lawyer queue (add-property-lawyer-queue.sql): flagged now, with the
 * reason, and not taken yet. A matter already taken and flagged again goes back in the queue.
 */
export async function flagForLawyer(caseId: string, reason: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('property_matters')
    .update({ needs_lawyer_at: new Date().toISOString(), needs_lawyer_reason: reason.slice(0, 2000), lawyer_taken_at: null, lawyer_taken_by: null })
    .eq('case_id', caseId)
  if (error) fail('flag the matter for a lawyer', error)
}

/** Everything the orchestrator needs: the tools' store plus loading the matter and its state. */
export interface MatterRepository extends MatterStore {
  getOrCreateMatter(caseId: string): Promise<PropertyMatter>
  setState(caseId: string, state: string, lagosArea?: string | null): Promise<void>
  flagForLawyer(caseId: string, reason: string): Promise<void>
}

/** The database-backed store used in production. */
export const matterStore: MatterRepository = { getOrCreateMatter, setState, mergeFacts, setArea, setStatus, logEvent, events, flagForLawyer }
