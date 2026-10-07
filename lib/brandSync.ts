// Server-only. The brand sheet sync (phase 2 of plans/). For each active brand it:
//   1. gives every new row a Case ID (BRANDCODE-0001) and marks it New,
//   2. picks up New rows — claiming each in the database first, so no other run can take it,
//   3. checks the borrower's details and documents (Missing Documents if anything's absent),
//   4. drafts the demand letter with the existing lawyer-intake agent (lib/brandLetter.ts),
//   5. rewrites the app's columns in the sheet from the database, the source of truth.
//
// "NEVER TWICE" — how a borrower can't be processed twice even if two runs overlap:
//   - runBrandSync takes a lease (firm_settings.brand_sync_lease_until), so runs don't overlap;
//   - claiming is a conditional UPDATE (status = 'new' → 'checking'): only one caller can win;
//   - the 'letter_drafted' event has a unique index and is inserted BEFORE the letter is saved,
//     so even a run that somehow got past both still cannot save a second letter.
//
// Rows are matched by Case ID every time; a row number is only ever used to write back, and
// only straight after re-reading the sheet (brands sort and delete rows).

import { supabaseAdmin } from './supabaseAdmin'
import { columnLetter, BRAND_CASE_STATUS_LABELS, type BrandCaseStatus } from './brandSheet'
import {
  agentCellsDiffer,
  agentCellsFor,
  brandColumnsSnapshot,
  checkBorrower,
  hasBorrowerData,
  parseSheetValues,
  sheetDateTime,
  snapshotHash,
  type BrandCaseState,
  type SheetRow,
} from './brandRows'
import { draftBrandLetter, type BrandDrafter } from './brandLetter'
import { buildDemandLetterDocxBuffer } from './docxGenerator.js'
import { getBrandWorkspace, type BrandWorkspace } from './google/workspace'
import type { CellWrite } from './google/workspaceTypes'

/** A row stuck in Checking this long belongs to a run that died; it goes back to New. */
const STALE_CLAIM_MS = 30 * 60 * 1000
/** Lease length; comfortably longer than one run (route maxDuration is 300s). */
const LEASE_MS = 10 * 60 * 1000
/** Drafting attempts before a row stops being retried automatically (each one is an AI call). */
export const MAX_DRAFT_ATTEMPTS = 3
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export interface SyncDeps {
  workspace: BrandWorkspace
  draft: BrandDrafter
  now: () => Date
  /** Letters drafted per brand per run; the rest wait for the next run. */
  maxDraftsPerBrand: number
  /** Stop starting new drafts after this time (ms since epoch), so a run ends inside its time limit. */
  deadline: number
}

export interface BrandSyncReport {
  brandId: string
  code: string
  assigned: number
  drafted: number
  missing: number
  failed: number
  flagged: number
  skipped?: string
  error?: string
}

interface BrandRecord {
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
}

interface BrandCaseRecord extends BrandCaseState {
  id: string
  case_ref: string
  case_id: string | null
  snapshot_hash: string | null
  claimed_at: string | null
  attempts: number
  letter_file_id: string | null
  /** The brand's columns as they were when the row was picked up. */
  borrower: Record<string, string> | null
}

const CASE_FIELDS =
  'id, case_ref, status, case_id, snapshot_hash, borrower, claimed_at, attempts, letter_url, letter_file_id, served_at, day7_sent_at, day14_sent_at, updated_at'

export function defaultSyncDeps(now = new Date()): SyncDeps {
  return {
    workspace: getBrandWorkspace(),
    draft: draftBrandLetter,
    now: () => new Date(),
    maxDraftsPerBrand: 5,
    deadline: now.getTime() + 240_000,
  }
}

// ── Small database helpers ────────────────────────────────────────────────

async function logEvent(c: { id: string; case_ref: string }, eventType: string, detail: Record<string, unknown> = {}, actor = 'system') {
  const { error } = await supabaseAdmin.from('brand_case_events').insert({ brand_case_id: c.id, case_ref: c.case_ref, event_type: eventType, detail, actor })
  if (error) console.error(`Failed to log ${eventType} for ${c.case_ref}:`, error.message)
}

/** One open flag per (brand, case, kind) — a problem isn't re-flagged on every run. */
async function flagOnce(brandId: string, kind: string, caseRef: string, detail: { brand_case_id?: string; new_value?: string }) {
  const { data: open } = await supabaseAdmin
    .from('brand_change_flags')
    .select('id')
    .eq('brand_id', brandId)
    .eq('kind', kind)
    .eq('case_ref', caseRef)
    .is('resolved_at', null)
    .limit(1)
  if (open?.length) return false
  await supabaseAdmin.from('brand_change_flags').insert({ brand_id: brandId, kind, case_ref: caseRef, ...detail })
  return true
}

async function setStatus(c: BrandCaseRecord, status: BrandCaseStatus, extra: Record<string, unknown> = {}) {
  const { error } = await supabaseAdmin.from('brand_cases').update({ status, ...extra }).eq('id', c.id)
  if (error) throw new Error(`Could not update ${c.case_ref}: ${error.message}`)
  await logEvent(c, 'status_changed', { from: c.status, to: status })
  c.status = status
}

/** Re-read the sheet and map Case ID → row number, ignoring Case IDs that appear twice. */
async function locateRows(ws: BrandWorkspace, brand: BrandRecord): Promise<Map<string, number>> {
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
async function writeAgentCells(ws: BrandWorkspace, brand: BrandRecord, cases: BrandCaseRecord[]) {
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

// ── One brand ─────────────────────────────────────────────────────────────

export async function syncBrand(brandId: string, deps: SyncDeps): Promise<BrandSyncReport> {
  const { data: brand } = await supabaseAdmin.from('brands').select('*').eq('id', brandId).single<BrandRecord>()
  const report: BrandSyncReport = { brandId, code: brand?.code ?? '?', assigned: 0, drafted: 0, missing: 0, failed: 0, flagged: 0 }
  if (!brand) return { ...report, skipped: 'Brand not found.' }
  if (!brand.active) return { ...report, skipped: 'Inactive.' }
  if (!brand.setup_completed_at || !brand.sheet_id || brand.sheet_tab_id === null) return { ...report, skipped: 'Google setup not finished.' }

  const ws = deps.workspace
  const notes: string[] = []
  try {
    // ── Read the sheet and the database ──
    const parsed = parseSheetValues(await ws.readSheet(brand.sheet_id, brand.sheet_tab_id))
    if (parsed.ok === false) throw new Error(parsed.error)
    const rows = parsed.rows

    const { data: caseRows, error: casesErr } = await supabaseAdmin.from('brand_cases').select(CASE_FIELDS).eq('brand_id', brand.id)
    if (casesErr) throw new Error(`Could not load borrowers: ${casesErr.message}`)
    const cases = new Map<string, BrandCaseRecord>((caseRows ?? []).map((c) => [c.case_ref, c as BrandCaseRecord]))

    const rowsByRef = new Map<string, SheetRow[]>()
    for (const r of rows) {
      const ref = r.values['Case ID']
      if (ref) rowsByRef.set(ref, [...(rowsByRef.get(ref) ?? []), r])
    }
    for (const [ref, refRows] of rowsByRef) {
      if (refRows.length > 1 && (await flagOnce(brand.id, 'duplicate_case_id', ref, { brand_case_id: cases.get(ref)?.id, new_value: `rows ${refRows.map((r) => r.rowNumber).join(', ')}` }))) report.flagged++
      else if (!cases.has(ref) && (await flagOnce(brand.id, 'unknown_case_id', ref, { new_value: `row ${refRows[0].rowNumber}` }))) report.flagged++
    }
    /** The one sheet row for a borrower, or null if missing or duplicated. */
    const rowFor = (ref: string) => (rowsByRef.get(ref)?.length === 1 ? rowsByRef.get(ref)![0] : null)

    // ── 1. Case IDs for new rows ──
    const newRows = rows.filter((r) => !r.values['Case ID'] && hasBorrowerData(r))
    if (newRows.length > 0) {
      const created: { row: SheetRow; c: BrandCaseRecord }[] = []
      for (const row of newRows) {
        const { data: ref, error: refErr } = await supabaseAdmin.rpc('allocate_brand_case_ref', { p_brand_id: brand.id })
        if (refErr || typeof ref !== 'string') throw new Error(`Could not allocate a Case ID: ${refErr?.message}`)
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from('brand_cases')
          .insert({ brand_id: brand.id, case_ref: ref, status: 'new' })
          .select(CASE_FIELDS)
          .single()
        if (insErr || !inserted) throw new Error(`Could not save ${ref}: ${insErr?.message}`)
        created.push({ row, c: inserted as BrandCaseRecord })
      }

      // Write the IDs — but only into rows that are still the same borrower, still without an
      // ID, after re-reading the sheet. A row that moved or changed gets its new case removed
      // (nothing has happened to it yet) and is picked up fresh next run.
      const fresh = parseSheetValues(await ws.readSheet(brand.sheet_id, brand.sheet_tab_id))
      if (fresh.ok === false) throw new Error(fresh.error)
      const stillThere = (row: SheetRow) => {
        const now = fresh.rows.find((r) => r.rowNumber === row.rowNumber)
        return Boolean(now && !now.values['Case ID'] && now.values['Borrower Full Name'] === row.values['Borrower Full Name'] && now.values['Phone Number'] === row.values['Phone Number'])
      }
      const keep = created.filter(({ row }) => stillThere(row))
      const drop = created.filter(({ row }) => !stillThere(row))
      if (drop.length) await supabaseAdmin.from('brand_cases').delete().in('id', drop.map(({ c }) => c.id))

      const stamp = deps.now().toISOString()
      const writes: CellWrite[] = keep.flatMap(({ row, c }) => [
        { row: row.rowNumber, column: columnLetter('Case ID'), value: c.case_ref },
        { row: row.rowNumber, column: columnLetter('Status'), value: BRAND_CASE_STATUS_LABELS.new },
        { row: row.rowNumber, column: columnLetter('Last Updated'), value: sheetDateTime(stamp) },
      ])
      try {
        await ws.writeCells(brand.sheet_id, brand.sheet_tab_id, writes)
      } catch (err) {
        // The sheet never got the IDs, so the cases must not exist either — otherwise the same
        // rows would get a second Case ID next run.
        await supabaseAdmin.from('brand_cases').delete().in('id', keep.map(({ c }) => c.id))
        throw err
      }
      for (const { row, c } of keep) {
        await logEvent(c, 'case_created', { row: row.rowNumber, borrower: row.values['Borrower Full Name'] })
        row.values['Case ID'] = c.case_ref
        cases.set(c.case_ref, c)
        rowsByRef.set(c.case_ref, [row])
        report.assigned++
      }
    }

    // ── 2. Recover claims left by a run that died ──
    const staleBefore = new Date(deps.now().getTime() - STALE_CLAIM_MS).toISOString()
    for (const c of cases.values()) {
      if (c.status === 'checking' && c.claimed_at && c.claimed_at < staleBefore) {
        const { data: reset } = await supabaseAdmin
          .from('brand_cases')
          .update({ status: 'new', claimed_at: null })
          .eq('id', c.id)
          .eq('status', 'checking')
          .lt('claimed_at', staleBefore)
          .select('id')
        if (reset?.length) {
          await logEvent(c, 'stale_claim_reset', { claimed_at: c.claimed_at })
          c.status = 'new'
          c.claimed_at = null
        }
      }
    }

    // ── 3. Missing Documents rows the brand has since corrected go back to New ──
    // Corrected = a brand column changed, or the Notes changed (that's where a brand answers
    // the lawyer's questions; Notes are deliberately left out of the snapshot hash).
    for (const c of cases.values()) {
      const row = rowFor(c.case_ref)
      if (c.status !== 'missing_documents' || !row) continue
      const notesChanged = (c.borrower?.Notes ?? '') !== row.values.Notes
      if (snapshotHash(row) === c.snapshot_hash && !notesChanged) continue
      const { data: reopened } = await supabaseAdmin
        .from('brand_cases')
        .update({ status: 'new', missing_items: [] })
        .eq('id', c.id)
        .eq('status', 'missing_documents')
        .select('id')
      if (reopened?.length) {
        await logEvent(c, 'resubmitted', { previous_status: 'missing_documents', notes_changed: notesChanged })
        c.status = 'new'
      }
    }

    // ── 4. Claim New rows ──
    const candidates = [...cases.values()].filter((c) => c.status === 'new' && c.attempts < MAX_DRAFT_ATTEMPTS && rowFor(c.case_ref))
    const claimed: BrandCaseRecord[] = []
    for (const c of candidates.slice(0, deps.maxDraftsPerBrand)) {
      const row = rowFor(c.case_ref)!
      const claimedAt = deps.now().toISOString()
      const { data: won } = await supabaseAdmin
        .from('brand_cases')
        .update({ status: 'checking', claimed_at: claimedAt, borrower: brandColumnsSnapshot(row), snapshot_hash: snapshotHash(row) })
        .eq('id', c.id)
        .eq('status', 'new')
        .select(CASE_FIELDS)
        .single()
      if (!won) continue // another run claimed it first — leave it alone
      await logEvent(c, 'status_changed', { from: 'new', to: 'checking' })
      Object.assign(c, won)
      claimed.push(c)
    }
    await writeAgentCells(ws, brand, claimed)

    // ── 5. Check and draft each claimed row ──
    for (const c of claimed) {
      const row = rowFor(c.case_ref)!
      try {
        const outcome = await processClaimed(c, row, brand, deps)
        if (outcome === 'drafted') report.drafted++
        else if (outcome === 'missing') report.missing++
        else if (outcome === 'waiting') notes.push(`${c.case_ref} waiting: add the brand’s address (Edit brand) so letters can be drafted.`)
        else report.failed++
      } catch (err) {
        report.failed++
        const message = err instanceof Error ? err.message : String(err)
        await supabaseAdmin.from('brand_cases').update({ status: 'new', claimed_at: null, last_error: message }).eq('id', c.id)
        await logEvent(c, 'draft_failed', { error: message })
        c.status = 'new'
      }
    }

    // ── 6. The sheet's app columns ← the database ──
    const { data: latest } = await supabaseAdmin.from('brand_cases').select(CASE_FIELDS).eq('brand_id', brand.id)
    const fresh = parseSheetValues(await ws.readSheet(brand.sheet_id, brand.sheet_tab_id))
    if (fresh.ok === false) throw new Error(fresh.error)
    const freshByRef = new Map<string, SheetRow[]>()
    for (const r of fresh.rows) if (r.values['Case ID']) freshByRef.set(r.values['Case ID'], [...(freshByRef.get(r.values['Case ID']) ?? []), r])
    const drifted = ((latest ?? []) as BrandCaseRecord[]).filter((c) => {
      const r = freshByRef.get(c.case_ref)
      return r?.length === 1 && agentCellsDiffer(r[0], agentCellsFor(c))
    })
    await writeAgentCells(ws, brand, drifted)

    await supabaseAdmin
      .from('brands')
      .update({ last_synced_at: deps.now().toISOString(), last_sync_error: notes.length ? notes.join(' ') : null })
      .eq('id', brand.id)
    return report
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Brand sync failed for ${brand.code}:`, message)
    await supabaseAdmin.from('brands').update({ last_synced_at: deps.now().toISOString(), last_sync_error: `Sync: ${message}` }).eq('id', brand.id)
    return { ...report, error: message }
  }
}

/**
 * Check one claimed borrower and, if complete, draft their letter. Returns what happened.
 * Every path leaves the borrower out of Checking (or throws, and the caller puts it back to New).
 */
async function processClaimed(
  c: BrandCaseRecord,
  row: SheetRow,
  brand: BrandRecord,
  deps: SyncDeps,
): Promise<'drafted' | 'missing' | 'waiting' | 'failed'> {
  const checked = checkBorrower(row)
  const missing = checked.ok === false ? [...checked.missing] : []
  if (checked.ok === true) {
    const doc = await deps.workspace.checkDocument(checked.borrower.documentsFileId)
    if (doc.ok === false) missing.push(`Documents Link (${doc.reason})`)
  }
  if (missing.length > 0 || checked.ok === false) {
    await setStatus(c, 'missing_documents', { missing_items: missing, claimed_at: null, last_error: null })
    await logEvent(c, 'missing_documents', { missing })
    return 'missing'
  }
  const borrower = checked.borrower

  // Letters name the client "of [address]"; without one every letter would come back with an
  // outstanding question. Wait (without spending an attempt) until the admin adds it.
  if (!brand.address || !brand.owner_user_id || !brand.letters_folder_id) {
    await supabaseAdmin.from('brand_cases').update({ status: 'new', claimed_at: null }).eq('id', c.id)
    c.status = 'new'
    return 'waiting'
  }
  if (Date.now() > deps.deadline) {
    await supabaseAdmin.from('brand_cases').update({ status: 'new', claimed_at: null }).eq('id', c.id)
    c.status = 'new'
    return 'waiting'
  }

  await supabaseAdmin.from('brand_cases').update({ attempts: c.attempts + 1 }).eq('id', c.id)
  c.attempts += 1
  const result = await deps.draft({
    brand: { name: brand.name, address: brand.address, contactEmail: brand.contact_emails[0] },
    borrower,
    caseRef: c.case_ref,
    caseId: c.case_id,
  })

  if (result.ok === false && result.kind === 'needs_info') {
    const items = result.questions.map((q) => `Lawyer’s question: ${q}`)
    await setStatus(c, 'missing_documents', { missing_items: items, claimed_at: null, last_error: null })
    await logEvent(c, 'missing_documents', { missing: items, source: 'agent' })
    return 'missing'
  }
  if (result.ok === false) {
    await supabaseAdmin.from('brand_cases').update({ status: 'new', claimed_at: null, last_error: result.kind === 'error' ? result.error : 'Unknown' }).eq('id', c.id)
    await logEvent(c, 'draft_failed', { error: result.kind === 'error' ? result.error : 'Unknown', attempt: c.attempts })
    c.status = 'new'
    return 'failed'
  }

  // THE once-only gate. If this insert fails on the unique index, a letter already exists.
  const { data: gate, error: gateErr } = await supabaseAdmin
    .from('brand_case_events')
    .insert({ brand_case_id: c.id, case_ref: c.case_ref, event_type: 'letter_drafted', detail: { title: result.doc.title }, actor: 'system' })
    .select('id')
    .single()
  if (gateErr || !gate) {
    if (gateErr?.code === '23505') {
      await supabaseAdmin.from('brand_cases').update({ claimed_at: null }).eq('id', c.id)
      return 'failed'
    }
    throw new Error(`Could not record the letter: ${gateErr?.message}`)
  }

  let matterId: string | null = null
  try {
    // The matter: an ordinary `cases` row, so the existing lawyer review (Action Queue) and
    // serving flows work on it unchanged. Brands are billed monthly, not per case.
    const { data: matter, error: matterErr } = await supabaseAdmin
      .from('cases')
      .insert({
        user_id: brand.owner_user_id,
        agent_id: 'small-claims',
        brand_id: brand.id,
        status: 'draft',
        source: 'brand-sheet',
        source_detail: c.case_ref,
        client_email: brand.contact_emails[0],
        recipient_phone: borrower.phone,
        delivery_option: 'pandas-serves',
      })
      .select('id, case_number, created_at')
      .single()
    if (matterErr || !matter) throw new Error(`Could not create the matter: ${matterErr?.message}`)
    matterId = matter.id

    const year = new Date(matter.created_at).getFullYear()
    const ourRef = `PLP/${year}/${String(matter.case_number).padStart(6, '0')} (${c.case_ref})`
    const body = result.doc.body.split('{{REF_NUMBER}}').join(ourRef)
    const { error: docErr } = await supabaseAdmin
      .from('cases')
      .update({
        document_title: result.doc.title,
        document_body: body,
        status: 'document_ready',
        expected_amount: Math.round(brand.per_letter_fee_kobo / 100),
      })
      .eq('id', matter.id)
    if (docErr) throw new Error(`Could not save the letter: ${docErr.message}`)

    const docx = (await buildDemandLetterDocxBuffer(body)) as Buffer
    const file = await deps.workspace.uploadFile({
      folderId: brand.letters_folder_id,
      name: `${c.case_ref} — ${result.doc.title} (DRAFT, awaiting lawyer review).docx`,
      mimeType: DOCX_MIME,
      content: docx,
    })

    await setStatus(c, 'letter_drafted', {
      case_id: matter.id,
      letter_url: file.url,
      letter_file_id: file.id,
      missing_items: [],
      claimed_at: null,
      last_error: null,
    })
    await supabaseAdmin.from('brand_case_events').update({ detail: { title: result.doc.title, case_id: matter.id, letter_url: file.url } }).eq('id', gate.id)
    c.letter_url = file.url
    return 'drafted'
  } catch (err) {
    // Undo so a later run can try again cleanly: no half-made matter, and the gate re-opened.
    if (matterId) await supabaseAdmin.from('cases').delete().eq('id', matterId)
    await supabaseAdmin.from('brand_case_events').delete().eq('id', gate.id)
    throw err
  }
}

// ── All brands ────────────────────────────────────────────────────────────

export interface SyncRunResult {
  ran: boolean
  reason?: string
  reports: BrandSyncReport[]
}

/**
 * The scheduled entry point (cron) and "Sync now". Takes the run lease so two runs never
 * overlap. Without `force`, does nothing until the configured interval has passed.
 */
export async function runBrandSync(opts: { force?: boolean; brandId?: string; deps?: SyncDeps } = {}): Promise<SyncRunResult> {
  const started = new Date()
  const { data: settings } = await supabaseAdmin
    .from('firm_settings')
    .select('brand_sync_interval_minutes, brand_sync_last_run_at')
    .eq('id', 1)
    .single()
  const intervalMs = (settings?.brand_sync_interval_minutes ?? 60) * 60_000
  // A minute of slack so an hourly cron firing at :00 isn't skipped for being a few seconds early.
  if (!opts.force && settings?.brand_sync_last_run_at && started.getTime() - new Date(settings.brand_sync_last_run_at).getTime() < intervalMs - 60_000) {
    return { ran: false, reason: 'Not due yet.', reports: [] }
  }

  const { data: lease } = await supabaseAdmin
    .from('firm_settings')
    .update({ brand_sync_lease_until: new Date(started.getTime() + LEASE_MS).toISOString() })
    .eq('id', 1)
    .or(`brand_sync_lease_until.is.null,brand_sync_lease_until.lt.${started.toISOString()}`)
    .select('id')
  if (!lease?.length) return { ran: false, reason: 'Another sync is already running.', reports: [] }

  try {
    const deps = opts.deps ?? defaultSyncDeps(started)
    let query = supabaseAdmin.from('brands').select('id').eq('active', true).not('setup_completed_at', 'is', null)
    if (opts.brandId) query = query.eq('id', opts.brandId)
    const { data: brands } = await query.order('created_at', { ascending: true })
    const reports: BrandSyncReport[] = []
    for (const b of brands ?? []) reports.push(await syncBrand(b.id, deps))
    return { ran: true, reports }
  } finally {
    await supabaseAdmin
      .from('firm_settings')
      .update({ brand_sync_lease_until: null, brand_sync_last_run_at: new Date().toISOString() })
      .eq('id', 1)
  }
}
