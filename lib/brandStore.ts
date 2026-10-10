// Server-only. The small database and sheet helpers shared by the sync (lib/brandSync.ts) and
// by approval, serving and reminders (lib/brandServing.ts): the audit log, status changes, and
// writing a borrower's app-owned cells back to the brand's sheet.

import { supabaseAdmin } from './supabaseAdmin'
import { columnLetter, type BrandCaseStatus } from './brandSheet'
import { agentCellsFor, parseSheetValues, type BrandCaseState } from './brandRows'
import type { BrandWorkspace, CellWrite } from './google/workspaceTypes'

export interface BrandRecord {
  id: string
  code: string
  name: string
  address: string | null
  contact_emails: string[]
  per_letter_fee_kobo: number
  sheet_id: string | null
  sheet_tab_id: number | null
  letters_folder_id: string | null
  setup_completed_at: string | null
  owner_user_id: string | null
  active: boolean
  /** 'sheet' (Google Sheet), 'api' (lib/brandApi.ts) or 'both'. */
  intake_channel: 'sheet' | 'api' | 'both'
}

export interface BrandCaseRecord extends BrandCaseState {
  id: string
  brand_id: string
  case_ref: string
  case_id: string | null
  snapshot_hash: string | null
  claimed_at: string | null
  attempts: number
  letter_file_id: string | null
  final_letter_at: string | null
  awaiting_brand_decision_at: string | null
  court_approved_at: string | null
  row_missing_since: string | null
  /** The Notes cell as last seen (the brand may keep updating Notes; each change is logged). */
  last_notes: string | null
  /** The brand's columns as they were when the row was picked up. */
  borrower: Record<string, string> | null
  /** Where the borrower came from: a sheet row, or the API (lib/brandApi.ts). */
  source: 'sheet' | 'api'
  /** API borrowers: the brand's own loan ID. */
  external_ref: string | null
  /** Sent with a test API key: never drafted with the AI, served, emailed or billed. */
  is_test: boolean
}

export const CASE_FIELDS =
  'id, brand_id, case_ref, status, case_id, snapshot_hash, borrower, claimed_at, attempts, letter_url, letter_file_id, final_letter_at, served_at, day7_sent_at, day14_sent_at, awaiting_brand_decision_at, court_approved_at, row_missing_since, last_notes, source, external_ref, is_test, updated_at'

export async function logEvent(c: { id: string; case_ref: string }, eventType: string, detail: Record<string, unknown> = {}, actor = 'system') {
  const { error } = await supabaseAdmin.from('brand_case_events').insert({ brand_case_id: c.id, case_ref: c.case_ref, event_type: eventType, detail, actor })
  if (error) console.error(`Failed to log ${eventType} for ${c.case_ref}:`, error.message)
}

/**
 * Records a one-time step (letter_drafted, served, day7_reminder, day14_reminder) BEFORE doing
 * it. The database lets each be recorded once per borrower, so a second caller gets
 * 'already' and must not do the work. Returns the event's id, to remove it if the work fails.
 */
export async function claimOnce(
  c: { id: string; case_ref: string },
  eventType: 'letter_drafted' | 'served' | 'day7_reminder' | 'day14_reminder',
  detail: Record<string, unknown>,
  actor = 'system',
): Promise<{ ok: true; eventId: string } | { ok: false; already: boolean; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from('brand_case_events')
    .insert({ brand_case_id: c.id, case_ref: c.case_ref, event_type: eventType, detail, actor })
    .select('id')
    .single()
  if (data) return { ok: true, eventId: data.id }
  if (error?.code === '23505') return { ok: false, already: true }
  return { ok: false, already: false, error: error?.message ?? 'unknown error' }
}

export async function releaseClaim(eventId: string) {
  await supabaseAdmin.from('brand_case_events').delete().eq('id', eventId)
}

export async function setStatus(c: BrandCaseRecord, status: BrandCaseStatus, extra: Record<string, unknown> = {}, actor = 'system') {
  const { error } = await supabaseAdmin.from('brand_cases').update({ status, ...extra }).eq('id', c.id)
  if (error) throw new Error(`Could not update ${c.case_ref}: ${error.message}`)
  await logEvent(c, 'status_changed', { from: c.status, to: status }, actor)
  c.status = status
}

/** Re-read the sheet and map Case ID → row number, ignoring Case IDs that appear twice. */
export async function locateRows(ws: BrandWorkspace, brand: BrandRecord): Promise<Map<string, number>> {
  const parsed = parseSheetValues(await ws.readSheet(brand.sheet_id!, brand.sheet_tab_id!))
  if (parsed.ok === false) throw new Error(parsed.error)
  const seen = new Map<string, number[]>()
  for (const r of parsed.rows) {
    const ref = r.values['Case ID']
    if (ref) seen.set(ref, [...(seen.get(ref) ?? []), r.rowNumber])
  }
  return new Map([...seen].filter(([, rows]) => rows.length === 1).map(([ref, rows]) => [ref, rows[0]]))
}

/** Writes each borrower's app-owned cells, finding their rows by Case ID straight before writing. */
export async function writeAgentCells(ws: BrandWorkspace, brand: BrandRecord, cases: (BrandCaseState & { case_ref: string })[]) {
  if (cases.length === 0) return
  const rowOf = await locateRows(ws, brand)
  const writes: CellWrite[] = []
  for (const c of cases) {
    const row = rowOf.get(c.case_ref)
    if (!row) continue
    for (const [header, value] of Object.entries(agentCellsFor(c))) {
      writes.push({ row, column: columnLetter(header as keyof ReturnType<typeof agentCellsFor>), value })
    }
  }
  await ws.writeCells(brand.sheet_id!, brand.sheet_tab_id!, writes)
}

/**
 * Brings one borrower's row in the sheet up to date with the database, straight away (after an
 * approval or a serve). Best effort: if Google is down, the next sync rewrites it anyway.
 */
export async function refreshSheetRow(brandCaseId: string, ws: BrandWorkspace): Promise<void> {
  const { data: c } = await supabaseAdmin.from('brand_cases').select(CASE_FIELDS).eq('id', brandCaseId).single<BrandCaseRecord>()
  if (!c) return
  const { data: brand } = await supabaseAdmin.from('brands').select('*').eq('id', c.brand_id).single<BrandRecord>()
  if (!brand?.sheet_id || brand.sheet_tab_id === null) return
  await writeAgentCells(ws, brand, [c])
}
