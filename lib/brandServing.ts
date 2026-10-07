// Server-only. Phase 3 of the brand sheets (plans/phase-3-review-serve-reminders.md): what
// happens to a brand borrower after the letter is drafted.
//
//   1. approveBrandLetter: a lawyer approved the letter in the Action Queue (the existing
//      checklist, app/api/update-case-status). It becomes billable, and the FINAL letter
//      replaces the DRAFT in the brand's Letters folder.
//   2. serveBrandCaseByEmail / recordBrandServed: the letter is served on the borrower, by
//      email from here, or by the existing WhatsApp serve followed by "Mark Served".
//   3. sendDueReminders: Day 7 and Day 14 reminders to the borrower, the brand copied. After
//      Day 14 the borrower waits for the brand's decision.
//
// "EXACTLY ONCE" for serving and each reminder: the step is recorded in brand_case_events
// BEFORE the email goes (a unique index allows one per borrower), and the record is removed if
// the email fails, so a later run tries again. Reminders also check that the database hasn't
// already got a date for them and that the sheet's date cell is still empty.

import { supabaseAdmin } from './supabaseAdmin'
import { buildDemandLetterDocxBuffer } from './docxGenerator.js'
import { getBorrowerEmail, RESPONSE_PERIOD_DAYS, type BorrowerEmailKind } from './brandEmails'
import { parseAmount, type SheetRow } from './brandRows'
import { GMAIL_USER, type SendMailOptions } from './mailer'
import {
  CASE_FIELDS,
  claimOnce,
  logEvent,
  refreshSheetRow,
  releaseClaim,
  setStatus,
  type BrandCaseRecord,
  type BrandRecord,
} from './brandStore'
import type { BrandWorkspace } from './google/workspaceTypes'
import { getBrandWorkspace } from './google/workspace'

const DAY_MS = 24 * 60 * 60 * 1000
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
/** Borrower emails go out between 08:00 and 19:59 Lagos time, never in the night. */
const SEND_FROM_HOUR = 8
const SEND_UNTIL_HOUR = 20

export type Mailer = (opts: SendMailOptions) => Promise<unknown>

export type ServeResult = { ok: true; servedAt: string } | { ok: false; status: number; error: string }

async function loadBrandCaseByMatter(caseId: string): Promise<BrandCaseRecord | null> {
  const { data } = await supabaseAdmin.from('brand_cases').select(CASE_FIELDS).eq('case_id', caseId).maybeSingle<BrandCaseRecord>()
  return data ?? null
}

async function loadBrand(brandId: string): Promise<BrandRecord | null> {
  const { data } = await supabaseAdmin.from('brands').select('*').eq('id', brandId).single<BrandRecord>()
  return data ?? null
}

/** Best effort: Google being down must never undo an approval or a serve. The sync catches up. */
async function tryGoogle(c: BrandCaseRecord, what: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`${what} failed for ${c.case_ref}:`, message)
    await supabaseAdmin.from('brand_cases').update({ last_error: `${what}: ${message}` }).eq('id', c.id)
  }
}

/** The Google workspace, or null when Drive isn't set up (approval and serving still work). */
export function brandWorkspaceOrNull(): BrandWorkspace | null {
  try {
    return getBrandWorkspace()
  } catch {
    return null
  }
}

export function lagosHour(d: Date): number {
  return (d.getUTCHours() + 1) % 24 // Lagos is UTC+1 all year (no daylight saving)
}

export function isSendingHours(d: Date): boolean {
  const h = lagosHour(d)
  return h >= SEND_FROM_HOUR && h < SEND_UNTIL_HOUR
}

// ── 1. Lawyer approval ────────────────────────────────────────────────────

/**
 * Called after the lawyer's checklist approval has been saved on the matter. Does nothing for
 * a matter that isn't a brand borrower, or one already approved.
 */
export async function approveBrandLetter(caseId: string, reviewer: string, deps: { workspace: BrandWorkspace | null; now: () => Date }) {
  const c = await loadBrandCaseByMatter(caseId)
  if (!c) return
  const at = deps.now().toISOString()
  const { data: won } = await supabaseAdmin
    .from('brand_cases')
    .update({ status: 'lawyer_approved', billable_at: at, last_error: null })
    .eq('id', c.id)
    .eq('status', 'letter_drafted')
    .select('id')
  if (!won?.length) return
  await logEvent(c, 'status_changed', { from: 'letter_drafted', to: 'lawyer_approved' }, reviewer)
  await logEvent(c, 'lawyer_approved', { reviewer, billable: true }, reviewer)
  c.status = 'lawyer_approved'

  const ws = deps.workspace
  if (ws) {
    await tryGoogle(c, 'Saving the final letter to Drive', () => saveFinalLetter(c, ws))
    await tryGoogle(c, 'Updating the sheet', () => refreshSheetRow(c.id, ws))
  }
}

/**
 * Replaces the DRAFT Word letter in the brand's Letters folder with the approved one, in
 * place, so the Letter Link the brand already has keeps working.
 */
export async function saveFinalLetter(c: BrandCaseRecord, ws: BrandWorkspace) {
  const [{ data: matter }, brand] = await Promise.all([
    supabaseAdmin.from('cases').select('document_title, document_body').eq('id', c.case_id!).single(),
    loadBrand(c.brand_id),
  ])
  if (!matter?.document_body || !brand?.letters_folder_id) throw new Error('the letter or the Letters folder is missing')
  const docx = (await buildDemandLetterDocxBuffer(matter.document_body)) as Buffer
  const file = await ws.uploadFile({
    folderId: brand.letters_folder_id,
    name: `${c.case_ref} — ${matter.document_title ?? 'Letter of Demand'} (FINAL, approved by a lawyer).docx`,
    mimeType: DOCX_MIME,
    content: docx,
    existingFileId: c.letter_file_id,
  })
  const at = new Date().toISOString()
  await supabaseAdmin.from('brand_cases').update({ letter_url: file.url, letter_file_id: file.id, final_letter_at: at, last_error: null }).eq('id', c.id)
  await logEvent(c, 'final_letter_saved', { letter_url: file.url })
  c.letter_url = file.url
  c.letter_file_id = file.id
  c.final_letter_at = at
}

// ── 2. Serving ────────────────────────────────────────────────────────────

/** Marks the borrower served (database first, then the sheet). The 'served' claim is already held. */
async function markServedRecords(c: BrandCaseRecord, servedAt: string, actor: string, workspace: BrandWorkspace | null) {
  await setStatus(c, 'served', { served_at: servedAt, last_error: null }, actor)
  c.served_at = servedAt
  if (workspace) await tryGoogle(c, 'Updating the sheet', () => refreshSheetRow(c.id, workspace))
}

/**
 * Serves the approved, stamped letter on the borrower by email, copying the brand, then marks
 * the matter served (the same 14-day deadline as "Mark Served" sets for every other case).
 */
export async function serveBrandCaseByEmail(
  caseId: string,
  actor: string,
  deps: { mail: Mailer; now: () => Date; workspace: BrandWorkspace | null; loadServedPdf: (caseId: string) => Promise<Buffer | null> },
): Promise<ServeResult> {
  const { data: matter } = await supabaseAdmin.from('cases').select('id, status, brand_id, reviewed_at, document_title').eq('id', caseId).single()
  if (!matter?.brand_id) return { ok: false, status: 404, error: 'This isn’t a brand borrower’s matter.' }
  if (!matter.reviewed_at) return { ok: false, status: 409, error: 'A lawyer must approve the letter before it is served.' }
  const c = await loadBrandCaseByMatter(caseId)
  if (!c) return { ok: false, status: 404, error: 'Borrower record not found.' }
  if (c.status !== 'lawyer_approved') return { ok: false, status: 409, error: `Only an approved letter can be served (this borrower is “${c.status}”).` }
  const brand = await loadBrand(c.brand_id)
  if (!brand) return { ok: false, status: 404, error: 'Brand not found.' }

  const to = c.borrower?.Email?.trim()
  if (!to) return { ok: false, status: 409, error: 'The borrower has no email address in the sheet.' }
  const pdf = await deps.loadServedPdf(caseId)
  if (!pdf) return { ok: false, status: 409, error: 'Attach the stamped letter (step 2) before serving it.' }

  const servedAt = deps.now().toISOString()
  const claim = await claimOnce(c, 'served', { method: 'email', to }, actor)
  if (claim.ok === false) {
    return claim.already
      ? { ok: false, status: 409, error: 'This letter has already been served.' }
      : { ok: false, status: 500, error: `Could not record the service: ${claim.error}` }
  }

  const email = getBorrowerEmail({
    kind: 'service',
    borrowerName: c.borrower?.['Borrower Full Name'] || 'Sir/Madam',
    brandName: brand.name,
    caseRef: c.case_ref,
    amountOutstanding: parseAmount(c.borrower?.['Amount Outstanding'] ?? ''),
    servedAt,
  })
  try {
    await deps.mail({
      to,
      cc: brand.contact_emails,
      replyTo: GMAIL_USER,
      ...email,
      attachments: [{ filename: `${c.case_ref} letter of demand.pdf`, content: pdf, contentType: 'application/pdf' }],
    })
  } catch (err) {
    await releaseClaim(claim.eventId)
    const message = err instanceof Error ? err.message : String(err)
    await logEvent(c, 'serve_failed', { method: 'email', error: message }, actor)
    return { ok: false, status: 502, error: `The email could not be sent, so the letter has NOT been served: ${message}` }
  }

  // The email has gone: from here on, record it even if something else fails.
  const deadline = new Date(new Date(servedAt).getTime() + RESPONSE_PERIOD_DAYS * DAY_MS).toISOString()
  const { error: caseErr } = await supabaseAdmin.from('cases').update({ status: 'letter_served', deadline_at: deadline }).eq('id', caseId)
  if (caseErr) console.error(`Served ${c.case_ref} by email but could not update the matter:`, caseErr.message)
  await supabaseAdmin.from('case_status_history').insert({ case_id: caseId, from_status: matter.status, to_status: 'letter_served', changed_by: actor })
  await markServedRecords(c, servedAt, actor, deps.workspace)
  return { ok: true, servedAt }
}

/**
 * "Mark Served" on a brand borrower's matter (after serving by WhatsApp or by hand). The
 * matter itself has already been moved to letter_served by app/api/update-case-status.
 */
export async function recordBrandServed(caseId: string, actor: string, deps: { now: () => Date; workspace: BrandWorkspace | null }) {
  const c = await loadBrandCaseByMatter(caseId)
  if (!c || c.status !== 'lawyer_approved') return
  const claim = await claimOnce(c, 'served', { method: 'marked_by_staff' }, actor)
  if (claim.ok === false) return
  await markServedRecords(c, deps.now().toISOString(), actor, deps.workspace)
}

// ── 3. Reminders ──────────────────────────────────────────────────────────

export interface ReminderReport {
  sent: number
  failed: number
  skipped: string[]
}

type ReminderStep = { kind: Exclude<BorrowerEmailKind, 'service'>; event: 'day7_reminder' | 'day14_reminder'; days: number; from: 'served' | 'day7_sent'; to: 'day7_sent' | 'day14_sent'; column: 'Day 7 Date' | 'Day 14 Date' }

const STEPS: ReminderStep[] = [
  { kind: 'day7', event: 'day7_reminder', days: 7, from: 'served', to: 'day7_sent', column: 'Day 7 Date' },
  { kind: 'day14', event: 'day14_reminder', days: 14, from: 'day7_sent', to: 'day14_sent', column: 'Day 14 Date' },
]

/** Which reminder (if any) is due for a borrower right now. Pure, so it is unit-tested. */
export function dueReminder(c: Pick<BrandCaseRecord, 'status' | 'served_at' | 'day7_sent_at' | 'day14_sent_at'>, now: Date): ReminderStep | null {
  if (!c.served_at) return null
  const elapsed = now.getTime() - new Date(c.served_at).getTime()
  for (const step of STEPS) {
    const alreadySent = step.kind === 'day7' ? c.day7_sent_at : c.day14_sent_at
    if (c.status === step.from && !alreadySent && elapsed >= step.days * DAY_MS) return step
  }
  return null
}

/**
 * Sends every reminder that is due for one brand. `rows` is the sheet as just re-read, by
 * Case ID (a row missing from the sheet doesn't stop a reminder: the database is the truth).
 */
export async function sendDueReminders(
  brand: BrandRecord,
  cases: BrandCaseRecord[],
  rows: Map<string, SheetRow>,
  deps: { mail: Mailer; now: () => Date },
): Promise<ReminderReport> {
  const report: ReminderReport = { sent: 0, failed: 0, skipped: [] }
  const now = deps.now()
  if (!isSendingHours(now)) return report

  for (const c of cases) {
    const step = dueReminder(c, now)
    if (!step) continue
    const to = c.borrower?.Email?.trim()
    if (!to) {
      report.skipped.push(`${c.case_ref}: no borrower email`)
      continue
    }
    const unconfirmed = `The ${step.kind === 'day7' ? 'Day 7' : 'Day 14'} reminder may already have been sent, so it won't be sent automatically. Check the firm's Sent mail.`

    // Belt and braces: the app is the only writer of this cell, so a date here means the
    // reminder went and the database didn't hear about it. Recording the step (unconfirmed)
    // blocks it for good: the sync puts the sheet back in line with the database, so the
    // date in the cell wouldn't still be there on the next run to stop it.
    const cell = rows.get(c.case_ref)?.values[step.column]
    if (cell) {
      report.skipped.push(`${c.case_ref}: ${step.column} already filled in the sheet`)
      await claimOnce(c, step.event, { to, unconfirmed: true, reason: `${step.column} already showed "${cell}" in the sheet` }, 'system')
      await supabaseAdmin.from('brand_cases').update({ last_error: unconfirmed }).eq('id', c.id)
      continue
    }

    const claim = await claimOnce(c, step.event, { to }, 'system')
    if (claim.ok === false) {
      if (claim.already) {
        // Recorded but never confirmed: a run stopped between recording and sending, or the
        // sheet showed a date the database didn't have.
        report.skipped.push(`${c.case_ref}: ${step.kind} reminder recorded earlier but not confirmed`)
        await supabaseAdmin.from('brand_cases').update({ last_error: unconfirmed }).eq('id', c.id)
      } else {
        report.failed++
      }
      continue
    }

    const email = getBorrowerEmail({
      kind: step.kind,
      borrowerName: c.borrower?.['Borrower Full Name'] || 'Sir/Madam',
      brandName: brand.name,
      caseRef: c.case_ref,
      amountOutstanding: parseAmount(c.borrower?.['Amount Outstanding'] ?? ''),
      servedAt: c.served_at!,
    })
    try {
      await deps.mail({ to, cc: brand.contact_emails, replyTo: GMAIL_USER, ...email })
    } catch (err) {
      await releaseClaim(claim.eventId)
      const message = err instanceof Error ? err.message : String(err)
      await supabaseAdmin.from('brand_cases').update({ last_error: `${step.kind === 'day7' ? 'Day 7' : 'Day 14'} reminder failed, will retry: ${message}` }).eq('id', c.id)
      await logEvent(c, 'reminder_failed', { kind: step.kind, error: message })
      report.failed++
      continue
    }

    const sentAt = now.toISOString()
    const extra: Record<string, unknown> =
      step.kind === 'day7' ? { day7_sent_at: sentAt, last_error: null } : { day14_sent_at: sentAt, awaiting_brand_decision_at: sentAt, last_error: null }
    await setStatus(c, step.to, extra)
    Object.assign(c, extra)
    if (step.kind === 'day14') await logEvent(c, 'awaiting_brand_decision', {})
    report.sent++
  }
  return report
}

/** The approved letters whose FINAL copy never reached Drive (Google was down at approval). */
export async function retryFinalLetters(cases: BrandCaseRecord[], ws: BrandWorkspace) {
  for (const c of cases) {
    if (c.case_id && !c.final_letter_at && ['lawyer_approved', 'served', 'day7_sent', 'day14_sent'].includes(c.status)) {
      await tryGoogle(c, 'Saving the final letter to Drive', () => saveFinalLetter(c, ws))
    }
  }
}

/** The stamped PDF staff attached in the review (step 2), the document actually served. */
export async function loadServedPdf(caseId: string): Promise<Buffer | null> {
  const { data } = await supabaseAdmin.storage.from('case-documents').download(`reviewed/${caseId}.pdf`)
  return data ? Buffer.from(await data.arrayBuffer()) : null
}
