// Server-only. The brand sheet sync (phase 2 of plans/). For each active brand it:
//   1. gives every new row a Case ID (BRANDCODE-0001) and marks it New,
//   2. picks up New rows — claiming each in the database first, so no other run can take it,
//   3. checks the borrower's details and documents (Missing Documents if anything's absent),
//   4. drafts the demand letter with the existing lawyer-intake agent (lib/brandLetter.ts),
//   5. sends the borrower reminders that are due (Day 7, Day 14: lib/brandServing.ts),
//   6. rewrites the app's columns in the sheet from the database, the source of truth.
//
// API brands (phase 5, lib/brandApi.ts) skip the sheet: their borrowers arrive already checked
// and stored in the database, and step 4 claims them from there. Everything after drafting is
// shared. API borrowers sent with a TEST key are never drafted here (no AI call, no cost).
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
import { columnLetter, BRAND_CASE_STATUS_LABELS, type BrandSheetHeader } from './brandSheet'
import {
  agentCellsDiffer,
  agentCellsFor,
  brandColumnsSnapshot,
  checkBorrower,
  hasBorrowerData,
  parseSheetValues,
  sheetDateTime,
  snapshotHash,
  type SheetRow,
} from './brandRows'
import { draftBrandLetter, type BrandDrafter } from './brandLetter'
import { buildDemandLetterDocxBuffer } from './docxGenerator.js'
import { getBrandWorkspace, type BrandWorkspace } from './google/workspace'
import type { CellWrite } from './google/workspaceTypes'
import { CASE_FIELDS, logEvent, setStatus, writeAgentCells, type BrandCaseRecord, type BrandRecord } from './brandStore'
import { retryFinalLetters, sendDueReminders, type Mailer } from './brandServing'
import { checkRowChanges } from './brandExceptions'
import { isMailerConfigured, sendMail } from './mailer'
import { toSheetRow } from './brandApiInput'

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
  /** Letters drafted per brand per run from the sheet; the rest wait for the next run. */
  maxDraftsPerBrand: number
  /** The same for API borrowers (100 to 150 a month, often in bursts). Defaults to 20. */
  maxApiDraftsPerBrand?: number
  /** Stop starting new drafts after this time (ms since epoch), so a run ends inside its time limit. */
  deadline: number
  /** Sends the borrower reminders (lib/brandServing.ts). */
  mail: Mailer
}

export interface BrandSyncReport {
  brandId: string
  code: string
  assigned: number
  drafted: number
  reminded: number
  missing: number
  failed: number
  flagged: number
  skipped?: string
  error?: string
}

export function defaultSyncDeps(now = new Date()): SyncDeps {
  return {
    workspace: getBrandWorkspace(),
    draft: draftBrandLetter,
    now: () => new Date(),
    maxDraftsPerBrand: 5,
    maxApiDraftsPerBrand: 20,
    deadline: now.getTime() + 240_000,
    mail: async (opts) => {
      if (!isMailerConfigured()) throw new Error('Email is not set up (GMAIL_APP_PASSWORD).')
      return sendMail(opts)
    },
  }
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

// ── One brand ─────────────────────────────────────────────────────────────

export async function syncBrand(brandId: string, deps: SyncDeps, opts: { apiOnly?: boolean } = {}): Promise<BrandSyncReport> {
  const { data: brand } = await supabaseAdmin.from('brands').select('*').eq('id', brandId).single<BrandRecord>()
  const report: BrandSyncReport = { brandId, code: brand?.code ?? '?', assigned: 0, drafted: 0, reminded: 0, missing: 0, failed: 0, flagged: 0 }
  if (!brand) return { ...report, skipped: 'Brand not found.' }
  if (!brand.active) return { ...report, skipped: 'Inactive.' }
  const hasSheet = Boolean(brand.setup_completed_at && brand.sheet_id && brand.sheet_tab_id !== null)
  const channel = brand.intake_channel ?? 'sheet'
  const usesApi = channel !== 'sheet'
  // The sheet is read for sheet borrowers, and to keep any sheet the brand has up to date.
  // An API-only pass (between the hourly sheet runs) leaves the sheet alone.
  const useSheet = hasSheet && !opts.apiOnly
  if (!hasSheet && !usesApi) return { ...report, skipped: 'Google setup not finished.' }
  if (opts.apiOnly && !usesApi) return { ...report, skipped: 'No API borrowers.' }

  const ws = deps.workspace
  const notes: string[] = []
  try {
    const { data: caseRows, error: casesErr } = await supabaseAdmin.from('brand_cases').select(CASE_FIELDS).eq('brand_id', brand.id)
    if (casesErr) throw new Error(`Could not load borrowers: ${casesErr.message}`)
    const cases = new Map<string, BrandCaseRecord>((caseRows ?? []).map((c) => [c.case_ref, c as BrandCaseRecord]))

    const rowsByRef = new Map<string, SheetRow[]>()
    /** The one sheet row for a borrower, or null if missing or duplicated. */
    const rowFor = (ref: string) => (rowsByRef.get(ref)?.length === 1 ? rowsByRef.get(ref)![0] : null)

    /** Check one claimed borrower and draft its letter, recording what happened in the report. */
    const checkAndDraft = async (c: BrandCaseRecord, row: SheetRow) => {
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

    if (useSheet) {
      // ── Read the sheet ──
      const parsed = parseSheetValues(await ws.readSheet(brand.sheet_id!, brand.sheet_tab_id!))
      if (parsed.ok === false) throw new Error(parsed.error)
      const rows = parsed.rows

      for (const r of rows) {
        const ref = r.values['Case ID']
        if (ref) rowsByRef.set(ref, [...(rowsByRef.get(ref) ?? []), r])
      }
      for (const [ref, refRows] of rowsByRef) {
        if (refRows.length > 1 && (await flagOnce(brand.id, 'duplicate_case_id', ref, { brand_case_id: cases.get(ref)?.id, new_value: `rows ${refRows.map((r) => r.rowNumber).join(', ')}` }))) report.flagged++
        else if (!cases.has(ref) && (await flagOnce(brand.id, 'unknown_case_id', ref, { new_value: `row ${refRows[0].rowNumber}` }))) report.flagged++
      }

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
        const fresh = parseSheetValues(await ws.readSheet(brand.sheet_id!, brand.sheet_tab_id!))
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
          await ws.writeCells(brand.sheet_id!, brand.sheet_tab_id!, writes)
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

      // ── 1b. Rows the brand changed after we started on them, and rows that have gone ──
      // Flagged for staff, never reprocessed (lib/brandExceptions.ts). Sheet borrowers only: an
      // API borrower has no row, so it must never be flagged "row missing".
      const changes = await checkRowChanges(brand, [...cases.values()].filter((c) => c.source !== 'api'), rowsByRef, deps)
      report.flagged += changes.flagged
    }

    // ── 2. Recover claims left by a run that died (sheet and API borrowers alike) ──
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

    if (useSheet) {
      // ── 3. Missing Documents rows the brand has since corrected go back to New ──
      // Corrected = a brand column changed, or the Notes changed (that's where a brand answers
      // the lawyer's questions; Notes are deliberately left out of the snapshot hash). API
      // borrowers are corrected by resubmitting instead (lib/brandApi.ts).
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
      const candidates = [...cases.values()].filter((c) => c.source !== 'api' && c.status === 'new' && c.attempts < MAX_DRAFT_ATTEMPTS && rowFor(c.case_ref))
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
      for (const c of claimed) await checkAndDraft(c, rowFor(c.case_ref)!)
    }

    // ── 4b and 5b. API borrowers: claimed straight from the database ──
    // They were checked when they arrived (lib/brandApi.ts) and are checked again here, the same
    // way as a sheet row. Test-key borrowers are never drafted: no AI call, no cost.
    if (usesApi) {
      const apiCandidates = [...cases.values()].filter(
        (c) => c.source === 'api' && !c.is_test && c.status === 'new' && c.attempts < MAX_DRAFT_ATTEMPTS && c.borrower,
      )
      for (const c of apiCandidates.slice(0, deps.maxApiDraftsPerBrand ?? 20)) {
        const { data: won } = await supabaseAdmin
          .from('brand_cases')
          .update({ status: 'checking', claimed_at: deps.now().toISOString() })
          .eq('id', c.id)
          .eq('status', 'new')
          .select(CASE_FIELDS)
          .single()
        if (!won) continue // another run, or a resubmission, got there first
        await logEvent(c, 'status_changed', { from: 'new', to: 'checking' })
        Object.assign(c, won)
        await checkAndDraft(c, toSheetRow(c.borrower as Record<BrandSheetHeader, string>))
      }
    }

    // ── 6. Approved letters whose FINAL copy didn't reach Drive; borrower reminders ──
    const { data: activeRows } = await supabaseAdmin
      .from('brand_cases')
      .select(CASE_FIELDS)
      .eq('brand_id', brand.id)
      .eq('is_test', false) // test borrowers are never emailed (lib/brandTestMode.ts moves them on)
      .in('status', ['lawyer_approved', 'served', 'day7_sent'])
    const active = (activeRows ?? []) as BrandCaseRecord[]
    await retryFinalLetters(active, ws)
    if (active.some((c) => c.served_at)) {
      // The sheet's Day 7 / Day 14 cells are a second "already sent?" check for sheet borrowers.
      // API borrowers have no row, so for them the database check alone applies.
      const single = new Map<string, SheetRow>()
      if (useSheet) {
        const now = parseSheetValues(await ws.readSheet(brand.sheet_id!, brand.sheet_tab_id!))
        if (now.ok === false) throw new Error(now.error)
        const counts = new Map<string, number>()
        for (const r of now.rows) if (r.values['Case ID']) counts.set(r.values['Case ID'], (counts.get(r.values['Case ID']) ?? 0) + 1)
        for (const r of now.rows) if (counts.get(r.values['Case ID']) === 1) single.set(r.values['Case ID'], r)
      }
      const reminders = await sendDueReminders(brand, active, single, deps)
      report.reminded += reminders.sent
      report.failed += reminders.failed
    }

    // ── 7. The sheet's app columns ← the database ──
    if (useSheet) {
      const { data: latest } = await supabaseAdmin.from('brand_cases').select(CASE_FIELDS).eq('brand_id', brand.id)
      const fresh = parseSheetValues(await ws.readSheet(brand.sheet_id!, brand.sheet_tab_id!))
      if (fresh.ok === false) throw new Error(fresh.error)
      const freshByRef = new Map<string, SheetRow[]>()
      for (const r of fresh.rows) if (r.values['Case ID']) freshByRef.set(r.values['Case ID'], [...(freshByRef.get(r.values['Case ID']) ?? []), r])
      const drifted = ((latest ?? []) as BrandCaseRecord[]).filter((c) => {
        const r = freshByRef.get(c.case_ref)
        return r?.length === 1 && agentCellsDiffer(r[0], agentCellsFor(c))
      })
      await writeAgentCells(ws, brand, drifted)
    }

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
  const isApi = c.source === 'api'
  const checked = checkBorrower(row, { documentsStored: isApi })
  const missing = checked.ok === false ? [...checked.missing] : []
  if (checked.ok === true) {
    if (isApi) {
      // Stored with us when they arrived (lib/brandApi.ts), already checked to be PDFs or images.
      const { count } = await supabaseAdmin.from('brand_case_documents').select('id', { count: 'exact', head: true }).eq('brand_case_id', c.id)
      if (!count) missing.push('Documents (send at least one: the loan agreement or statement)')
    } else {
      const doc = await deps.workspace.checkDocument(checked.borrower.documentsFileId)
      if (doc.ok === false) missing.push(`Documents Link (${doc.reason})`)
    }
  }
  if (missing.length > 0 || checked.ok === false) {
    await setStatus(c, 'missing_documents', { missing_items: missing, claimed_at: null, last_error: null })
    await logEvent(c, 'missing_documents', { missing })
    return 'missing'
  }
  const borrower = checked.borrower

  // Letters name the client "of [address]"; without one every letter would come back with an
  // outstanding question. Wait (without spending an attempt) until the admin adds it.
  // (API borrowers don't need the Letters folder: their letter is pulled through the API.)
  if (!brand.address || !brand.owner_user_id || (!isApi && !brand.letters_folder_id)) {
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
        source: isApi ? 'brand-api' : 'brand-sheet',
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

    // Sheet brands get a DRAFT Word copy in their Letters folder. API brands don't use Drive:
    // their letter is in the matter, and they pull it through the API once approved (phase 5B).
    let file: { id: string; url: string } | null = null
    if (!isApi && brand.letters_folder_id) {
      const docx = (await buildDemandLetterDocxBuffer(body)) as Buffer
      file = await deps.workspace.uploadFile({
        folderId: brand.letters_folder_id,
        name: `${c.case_ref} — ${result.doc.title} (DRAFT, awaiting lawyer review).docx`,
        mimeType: DOCX_MIME,
        content: docx,
      })
    }

    await setStatus(c, 'letter_drafted', {
      case_id: matter.id,
      letter_url: file?.url ?? null,
      letter_file_id: file?.id ?? null,
      missing_items: [],
      claimed_at: null,
      last_error: null,
    })
    await supabaseAdmin.from('brand_case_events').update({ detail: { title: result.doc.title, case_id: matter.id, letter_url: file?.url ?? null } }).eq('id', gate.id)
    c.letter_url = file?.url ?? null
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
  const sheetsDue = opts.force || !settings?.brand_sync_last_run_at || started.getTime() - new Date(settings.brand_sync_last_run_at).getTime() >= intervalMs - 60_000
  // Between sheet runs, a tick still drafts API borrowers that are waiting: a brand sending by
  // API shouldn't wait up to an hour for the next sheet run (plans/phase-5-api-intake.md).
  let apiOnly = false
  if (!sheetsDue) {
    const { count } = await supabaseAdmin
      .from('brand_cases')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'api')
      .eq('is_test', false)
      .eq('status', 'new')
    if (!count) return { ran: false, reason: 'Not due yet.', reports: [] }
    apiOnly = true
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
    // Brands with a finished Google set-up, plus API brands (which may have no sheet at all).
    let query = supabaseAdmin.from('brands').select('id').eq('active', true).or('setup_completed_at.not.is.null,intake_channel.neq.sheet')
    if (apiOnly) query = query.neq('intake_channel', 'sheet')
    if (opts.brandId) query = query.eq('id', opts.brandId)
    const { data: brands } = await query.order('created_at', { ascending: true })
    const reports: BrandSyncReport[] = []
    for (const b of brands ?? []) reports.push(await syncBrand(b.id, deps, { apiOnly }))
    return { ran: true, reports }
  } finally {
    // An API-only pass doesn't count as the scheduled sheet run, so the sheet schedule is unchanged.
    await supabaseAdmin
      .from('firm_settings')
      .update({ brand_sync_lease_until: null, ...(apiOnly ? {} : { brand_sync_last_run_at: new Date().toISOString() }) })
      .eq('id', 1)
  }
}
