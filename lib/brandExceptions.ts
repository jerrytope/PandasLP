// Server-only. Phase 4 of the brand sheets (plans/phase-4-exceptions-and-billing.md): the
// cases that need a human.
//
//   - checkRowChanges (run by the sync): a brand edited a row we'd already started on, or a
//     row disappeared. Never reprocessed: flagged for staff, and the brand is asked (once per
//     change) to use Notes. Notes changes are allowed and logged.
//   - resolveFlag: staff accept the brand's new value (it becomes the record, e.g. a corrected
//     email the reminders then use) or keep the original, with a note.
//   - setOutcome: Paid, Disputed or Closed. Reminders stop for all three.
//   - recordCourtApproval / courtFilingAllowed: nothing goes to court without the brand's
//     written approval, recorded with a note and a copy of the approval.

import { supabaseAdmin } from './supabaseAdmin'
import { BRAND_COLUMNS, type BrandCaseStatus } from './brandSheet'
import { snapshotHash, type SheetRow } from './brandRows'
import { getBrandEditNoticeEmail, type BrandEditNotice } from './brandEmails'
import { GMAIL_USER } from './mailer'
import { CASE_FIELDS, logEvent, refreshSheetRow, type BrandCaseRecord, type BrandRecord } from './brandStore'
import type { Mailer } from './brandServing'
import type { BrandWorkspace } from './google/workspaceTypes'

/** A row is locked from here on: its letter is (being) based on the details as they were. */
const LOCKED: BrandCaseStatus[] = ['letter_drafted', 'lawyer_approved', 'served', 'day7_sent', 'day14_sent', 'paid', 'disputed', 'closed']
const TRACKED = BRAND_COLUMNS.filter((c) => c !== 'Notes')

export interface RowChangeReport {
  flagged: number
  notesLogged: number
  brandEmailed: boolean
}

/**
 * Compares each locked borrower's row with what was recorded when it was picked up, and notices
 * rows that have gone. `rowsByRef` is every row by Case ID (more than one = duplicated, which
 * the sync flags separately).
 */
export async function checkRowChanges(
  brand: BrandRecord,
  cases: BrandCaseRecord[],
  rowsByRef: Map<string, SheetRow[]>,
  deps: { mail: Mailer; now: () => Date },
): Promise<RowChangeReport> {
  const report: RowChangeReport = { flagged: 0, notesLogged: 0, brandEmailed: false }
  const newEdits: BrandEditNotice[] = []
  const now = deps.now().toISOString()

  for (const c of cases) {
    const rows = rowsByRef.get(c.case_ref) ?? []

    // ── Row gone from the sheet. The record stays; a human decides. ──
    if (rows.length === 0) {
      if (!c.row_missing_since) {
        await supabaseAdmin.from('brand_cases').update({ row_missing_since: now }).eq('id', c.id)
        await supabaseAdmin.from('brand_change_flags').insert({ brand_id: brand.id, brand_case_id: c.id, case_ref: c.case_ref, kind: 'row_missing' })
        await logEvent(c, 'row_missing', {})
        c.row_missing_since = now
        report.flagged++
      }
      continue
    }
    if (c.row_missing_since) {
      // It's back (the brand undid a delete): close the flag ourselves.
      await supabaseAdmin.from('brand_cases').update({ row_missing_since: null }).eq('id', c.id)
      await supabaseAdmin
        .from('brand_change_flags')
        .update({ resolved_at: now, resolved_by: 'system', resolution: 'row_back', note: 'The row is back in the sheet.' })
        .eq('brand_case_id', c.id)
        .eq('kind', 'row_missing')
        .is('resolved_at', null)
      await logEvent(c, 'row_back', {})
      c.row_missing_since = null
    }
    if (rows.length > 1 || !LOCKED.includes(c.status) || !c.borrower) continue
    const row = rows[0]

    // ── Notes: allowed to change, logged each time. ──
    const lastNotes = c.last_notes ?? c.borrower.Notes ?? ''
    if (row.values.Notes !== lastNotes) {
      await supabaseAdmin.from('brand_cases').update({ last_notes: row.values.Notes }).eq('id', c.id)
      await logEvent(c, 'notes_updated', { from: lastNotes, to: row.values.Notes })
      c.last_notes = row.values.Notes
      report.notesLogged++
    }

    // ── The brand's other columns: never reprocessed, flagged once per new value. ──
    for (const column of TRACKED) {
      const oldValue = c.borrower[column] ?? ''
      const newValue = row.values[column]
      if (newValue === oldValue) continue
      // Any earlier flag for this exact value, open or decided, means it's been raised already.
      const { data: seen } = await supabaseAdmin
        .from('brand_change_flags')
        .select('id')
        .eq('brand_case_id', c.id)
        .eq('kind', 'edited_after_processing')
        .eq('column_name', column)
        .eq('new_value', newValue)
        .limit(1)
      if (seen?.length) continue
      await supabaseAdmin.from('brand_change_flags').insert({
        brand_id: brand.id,
        brand_case_id: c.id,
        case_ref: c.case_ref,
        kind: 'edited_after_processing',
        column_name: column,
        old_value: oldValue,
        new_value: newValue,
      })
      await logEvent(c, 'edited_after_processing', { column, from: oldValue, to: newValue })
      newEdits.push({ caseRef: c.case_ref, column, oldValue, newValue })
      report.flagged++
    }
  }

  if (newEdits.length > 0) {
    try {
      await deps.mail({ to: brand.contact_emails.join(', '), replyTo: GMAIL_USER, ...getBrandEditNoticeEmail(brand.name, newEdits) })
      report.brandEmailed = true
    } catch (err) {
      // The flags are what matter; the courtesy email failing must not stop the sync.
      console.error(`Could not email ${brand.code} about edited rows:`, err)
    }
  }
  return report
}

export type ActionResult = { ok: true } | { ok: false; status: number; error: string }

/**
 * Staff decide on a flag. For an edited row: 'accept' makes the brand's new value the record
 * (the next sync stops seeing a difference); 'keep' keeps the original, and the same new value
 * is never flagged again. A missing row is just noted.
 */
export async function resolveFlag(flagId: string, decision: 'accept' | 'keep' | 'noted', note: string, actor: string): Promise<ActionResult> {
  if (note.trim().length < 3) return { ok: false, status: 400, error: 'Add a short note saying what was decided.' }
  const { data: flag } = await supabaseAdmin.from('brand_change_flags').select('*').eq('id', flagId).single()
  if (!flag) return { ok: false, status: 404, error: 'Flag not found.' }
  if (flag.resolved_at) return { ok: false, status: 409, error: 'This has already been resolved.' }
  if (decision !== 'noted' && flag.kind !== 'edited_after_processing') return { ok: false, status: 400, error: 'Only an edited row can be accepted or kept.' }

  const resolution = decision === 'accept' ? 'accepted' : decision === 'keep' ? 'kept_original' : 'noted'
  const { data: won } = await supabaseAdmin
    .from('brand_change_flags')
    .update({ resolved_at: new Date().toISOString(), resolved_by: actor, resolution, note: note.trim() })
    .eq('id', flagId)
    .is('resolved_at', null)
    .select('id')
  if (!won?.length) return { ok: false, status: 409, error: 'This has already been resolved.' }

  if (flag.brand_case_id) {
    const { data: c } = await supabaseAdmin.from('brand_cases').select(CASE_FIELDS).eq('id', flag.brand_case_id).single<BrandCaseRecord>()
    if (c && decision === 'accept' && c.borrower && flag.column_name) {
      const borrower = { ...c.borrower, [flag.column_name]: flag.new_value ?? '' }
      const hash = snapshotHash({ rowNumber: 0, values: borrower as SheetRow['values'], raw: {} })
      await supabaseAdmin.from('brand_cases').update({ borrower, snapshot_hash: hash }).eq('id', c.id)
    }
    if (c) await logEvent(c, 'flag_resolved', { kind: flag.kind, column: flag.column_name, decision: resolution, note: note.trim() }, actor)
  }
  return { ok: true }
}

export type Outcome = 'paid' | 'disputed' | 'closed'

const OUTCOME_FROM: Record<Outcome, BrandCaseStatus[]> = {
  paid: ['letter_drafted', 'lawyer_approved', 'served', 'day7_sent', 'day14_sent', 'disputed'],
  disputed: ['served', 'day7_sent', 'day14_sent'],
  closed: ['new', 'missing_documents', 'letter_drafted', 'lawyer_approved', 'served', 'day7_sent', 'day14_sent', 'paid', 'disputed'],
}

/** Paid, Disputed or Closed. Logged, written to the sheet; reminders stop. */
export async function setOutcome(brandCaseId: string, outcome: Outcome, note: string, actor: string, workspace: BrandWorkspace | null): Promise<ActionResult> {
  if (!(outcome in OUTCOME_FROM)) return { ok: false, status: 400, error: 'Unknown outcome.' }
  const { data: c } = await supabaseAdmin.from('brand_cases').select(CASE_FIELDS).eq('id', brandCaseId).single<BrandCaseRecord>()
  if (!c) return { ok: false, status: 404, error: 'Borrower not found.' }
  if (!OUTCOME_FROM[outcome].includes(c.status)) {
    return { ok: false, status: 409, error: `A borrower who is “${c.status}” can’t be marked ${outcome}.` }
  }
  const { data: won } = await supabaseAdmin
    .from('brand_cases')
    .update({ status: outcome, last_error: null })
    .eq('id', c.id)
    .in('status', OUTCOME_FROM[outcome])
    .select('id')
  if (!won?.length) return { ok: false, status: 409, error: 'The borrower changed while you were looking. Reload and try again.' }
  await logEvent(c, 'status_changed', { from: c.status, to: outcome }, actor)
  await logEvent(c, 'outcome', { outcome, note: note.trim() || null }, actor)
  if (workspace) {
    try {
      await refreshSheetRow(c.id, workspace)
    } catch (err) {
      console.error(`Sheet update after outcome failed for ${c.case_ref}:`, err) // the next sync catches up
    }
  }
  return { ok: true }
}

// ── Court approval ────────────────────────────────────────────────────────

// Sent base64 in a JSON body, about 4/3 of the file's size. Serverless hosts cap request
// bodies (AWS Lambda at 6 MB), so 3 MB of file (about 4 MB of body) fits anywhere.
export const EVIDENCE_MAX_BYTES = 3 * 1024 * 1024
// Private, and (unlike case-documents, PDF only) takes images too.
const EVIDENCE_BUCKET = 'case-evidence'
const COURT_FROM: BrandCaseStatus[] = ['served', 'day7_sent', 'day14_sent', 'disputed']

/** What a file really is, from its first bytes (never the browser's say-so). */
export function sniffEvidence(buf: Buffer): { ext: string; contentType: string } | null {
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return { ext: 'pdf', contentType: 'application/pdf' }
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', contentType: 'image/png' }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' }
  return null
}

/**
 * The brand's written go-ahead for court: a note and a copy of their email or letter (PDF or
 * image). Until this exists, the matter can't be marked filed (courtFilingAllowed).
 */
export async function recordCourtApproval(brandCaseId: string, note: string, file: Buffer, actor: string): Promise<ActionResult> {
  if (note.trim().length < 5) return { ok: false, status: 400, error: 'Say who approved it and when (e.g. “Email from Ade, Head of Recoveries, 3 Nov”).' }
  if (file.length === 0) return { ok: false, status: 400, error: 'Attach a copy of the brand’s written approval.' }
  if (file.length > EVIDENCE_MAX_BYTES) return { ok: false, status: 413, error: 'File too large. Maximum size is 3 MB.' }
  const kind = sniffEvidence(file)
  if (!kind) return { ok: false, status: 400, error: 'The approval must be a PDF or an image (PNG or JPG). Save the email as a PDF.' }

  const { data: c } = await supabaseAdmin.from('brand_cases').select(CASE_FIELDS).eq('id', brandCaseId).single<BrandCaseRecord>()
  if (!c) return { ok: false, status: 404, error: 'Borrower not found.' }
  if (c.court_approved_at) return { ok: false, status: 409, error: 'The brand’s approval is already recorded.' }
  if (!COURT_FROM.includes(c.status)) return { ok: false, status: 409, error: 'Court approval can only be recorded once the letter has been served and the borrower hasn’t paid.' }

  const path = `brand-court-approvals/${c.id}/${Date.now()}.${kind.ext}`
  const { error: upErr } = await supabaseAdmin.storage.from(EVIDENCE_BUCKET).upload(path, file, { contentType: kind.contentType })
  if (upErr) return { ok: false, status: 500, error: `Could not store the approval. (${upErr.message})` }

  const { data: won } = await supabaseAdmin
    .from('brand_cases')
    .update({ court_approved_at: new Date().toISOString(), court_approved_by: actor, court_approval_note: note.trim(), court_approval_evidence_path: path })
    .eq('id', c.id)
    .is('court_approved_at', null)
    .select('id')
  if (!won?.length) {
    await supabaseAdmin.storage.from(EVIDENCE_BUCKET).remove([path])
    return { ok: false, status: 409, error: 'The brand’s approval is already recorded.' }
  }
  await logEvent(c, 'court_approved', { note: note.trim(), evidence: path }, actor)
  return { ok: true }
}

/** Filing in court: always allowed for an ordinary case; a brand borrower needs the brand's approval. */
export async function courtFilingAllowed(caseId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('brand_cases').select('court_approved_at').eq('case_id', caseId).maybeSingle()
  return !data || Boolean(data.court_approved_at)
}

/** A short-lived link to the stored approval, for staff to open. */
export async function courtApprovalLink(path: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 10 * 60)
  return data?.signedUrl ?? null
}

