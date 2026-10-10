// Server-only. The brand API, phase 5A of plans/phase-5-api-intake.md: a brand sends borrowers
// as JSON instead of typing them into a Google Sheet. After a borrower arrives, everything is the
// same as for a sheet row: the sync (lib/brandSync.ts) drafts the letter, a lawyer approves it,
// it is served, reminded and billed.
//
// "NEVER TWICE": the brand's own loan ID is unique per brand and mode (a database index). A
// second submission of the same loan returns the existing case: it never creates a second one,
// so it can never lead to a second letter. A borrower can still be corrected by resubmitting
// while nothing has been done with it yet (Missing Documents, or New and not yet picked up).

import { lookup } from 'dns/promises'
import { createHash } from 'crypto'
import { supabaseAdmin } from './supabaseAdmin'
import { checkRateLimit } from './rateLimit'
import { checkBorrower, snapshotHash } from './brandRows'
import { BRAND_COLUMNS, isValidCaseRef, type BrandCaseStatus } from './brandSheet'
import { flagEdits, sniffEvidence } from './brandExceptions'
import { buildTextDocumentBuffer } from './pdfGenerator.js'
import { advanceTestBorrower, sampleLetterPdf } from './brandTestMode'
import { deliverForBorrower, type DeliverDeps } from './brandWebhooks'
import { CASE_FIELDS, logEvent, type BrandCaseRecord } from './brandStore'
import {
  decodeInlineDocument,
  documentUrlProblem,
  hashApiKey,
  isPrivateAddress,
  MAX_DOCUMENT_BYTES,
  parseBorrowerInput,
  readApiKey,
  toSheetRow,
  type ApiKeyMode,
  type DocumentInput,
} from './brandApiInput'

const DOCUMENT_BUCKET = 'case-evidence' // private; takes PDFs and images (case-documents is PDF only)
const KEY_RATE_LIMIT = 60 // requests per minute per key
const FETCH_TIMEOUT_MS = 10_000

export interface ApiContext {
  brand: { id: string; code: string; name: string; active: boolean; intake_channel: string }
  keyId: string
  mode: ApiKeyMode
  isTest: boolean
}

/** The API's error shape: `{ error: { code, message } }`. */
export function apiError(status: number, code: string, message: string, headers?: Record<string, string>) {
  return Response.json({ error: { code, message } }, { status, headers })
}

/** Who is calling: the brand behind the key, or an error Response. Also rate-limits per key. */
export async function authenticate(req: Request): Promise<ApiContext | Response> {
  const parsed = readApiKey(req.headers.get('authorization'))
  if (!parsed) return apiError(401, 'unauthorized', 'Send your API key as "Authorization: Bearer plp_…".')

  const { data: key } = await supabaseAdmin
    .from('brand_api_keys')
    .select('id, brand_id, mode, revoked_at, brands(id, code, name, active, intake_channel)')
    .eq('key_hash', hashApiKey(parsed.key))
    .maybeSingle()
  const brand = (Array.isArray(key?.brands) ? key?.brands[0] : key?.brands) as ApiContext['brand'] | undefined
  if (!key || key.revoked_at || !brand) return apiError(401, 'unauthorized', 'This API key is not valid. It may have been revoked.')
  if (!brand.active) return apiError(403, 'brand_inactive', 'This account is not active. Contact Pandas LP.')
  if (brand.intake_channel === 'sheet') return apiError(403, 'api_not_enabled', 'API access is not switched on for this account. Contact Pandas LP.')

  const { allowed, retryAfterSeconds } = checkRateLimit(`brand-api:${key.id}`, KEY_RATE_LIMIT, 60_000)
  if (!allowed) return apiError(429, 'rate_limited', 'Too many requests. Slow down and retry shortly.', { 'retry-after': String(retryAfterSeconds) })

  void supabaseAdmin.from('brand_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).then(() => {})
  return { brand, keyId: key.id, mode: key.mode as ApiKeyMode, isTest: key.mode === 'test' }
}

/** One row in the access log. Never blocks or fails the request. */
export function logRequest(ctx: ApiContext | null, req: Request, status: number, detail: Record<string, unknown>, ip: string) {
  void supabaseAdmin
    .from('brand_api_requests')
    .insert({
      brand_id: ctx?.brand.id ?? null,
      key_id: ctx?.keyId ?? null,
      mode: ctx?.mode ?? null,
      method: req.method,
      path: new URL(req.url).pathname,
      status,
      detail,
      ip,
    })
    .then(({ error }) => {
      if (error) console.error('Failed to log API request:', error.message)
    })
}

// ── Documents ─────────────────────────────────────────────────────────────

export interface LoadedDocument {
  filename: string
  content: Buffer
  ext: string
  contentType: string
  origin: 'inline' | 'url'
  sourceUrl: string | null
}

export type DocumentFetcher = (url: string, maxBytes: number) => Promise<Buffer>

/**
 * Fetches a document link once, refusing private addresses (checked after the name is looked
 * up, so a public-looking name can't point inside a network), redirects, slow servers, and
 * anything over the size cap, which is enforced while downloading.
 */
export const fetchDocument: DocumentFetcher = async (url, maxBytes) => {
  const problem = documentUrlProblem(url)
  if (problem) throw new Error(problem)
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '')
  const addresses = await lookup(host, { all: true })
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('points to a private address')

  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok || !res.body) throw new Error(`could not be downloaded (HTTP ${res.status})`)
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new Error('is larger than 1 MB')

  const chunks: Uint8Array[] = []
  let total = 0
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error('is larger than 1 MB')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/** Decodes or fetches every document, checking each file's real type and the 1 MB total. */
export async function loadDocuments(inputs: DocumentInput[], fetcher: DocumentFetcher): Promise<{ files: LoadedDocument[]; problems: string[] }> {
  const files: LoadedDocument[] = []
  const problems: string[] = []
  let total = 0
  for (const [i, d] of inputs.entries()) {
    const label = `Document ${i + 1} (${d.filename})`
    let content: Buffer | null
    try {
      content = d.kind === 'inline' ? decodeInlineDocument(d.base64) : await fetcher(d.url, MAX_DOCUMENT_BYTES - total)
    } catch (err) {
      problems.push(`${label}: the link ${err instanceof Error ? err.message : 'could not be downloaded'}`)
      continue
    }
    if (!content || content.length === 0) {
      problems.push(`${label}: not valid base64`)
      continue
    }
    total += content.length
    if (total > MAX_DOCUMENT_BYTES) {
      problems.push('Documents: more than 1 MB in total for this borrower')
      break
    }
    const kind = sniffEvidence(content)
    if (!kind) {
      problems.push(`${label}: must be a PDF, JPG or PNG`)
      continue
    }
    files.push({ filename: d.filename, content, ext: kind.ext, contentType: kind.contentType, origin: d.kind, sourceUrl: d.kind === 'url' ? d.url : null })
  }
  return { files, problems }
}

async function storeDocuments(brandCaseId: string, files: LoadedDocument[]): Promise<void> {
  const stored: string[] = []
  try {
    for (const [i, f] of files.entries()) {
      const base = f.filename.replace(/\.[A-Za-z0-9]{1,5}$/, '')
      const path = `brand-documents/${brandCaseId}/${Date.now()}-${i + 1}-${base}.${f.ext}`
      const { error } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).upload(path, f.content, { contentType: f.contentType })
      if (error) throw new Error(error.message)
      stored.push(path)
      const { error: rowErr } = await supabaseAdmin.from('brand_case_documents').insert({
        brand_case_id: brandCaseId,
        storage_path: path,
        filename: `${base}.${f.ext}`,
        content_type: f.contentType,
        size_bytes: f.content.length,
        content_sha256: sha256(f.content),
        origin: f.origin,
        source_url: f.sourceUrl,
      })
      if (rowErr) throw new Error(rowErr.message)
    }
  } catch (err) {
    if (stored.length) await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove(stored)
    await supabaseAdmin.from('brand_case_documents').delete().in('storage_path', stored.length ? stored : ['-'])
    throw err
  }
}

/** Removes a borrower's stored documents (when a resubmission replaces them). */
const sha256 = (content: Buffer) => createHash('sha256').update(content).digest('hex')

/** True when the files sent are exactly the ones already stored (same contents, any order). */
async function sameDocuments(brandCaseId: string, files: LoadedDocument[]): Promise<boolean> {
  const { data } = await supabaseAdmin.from('brand_case_documents').select('content_sha256').eq('brand_case_id', brandCaseId)
  const stored = (data ?? []).map((d) => d.content_sha256 as string).sort()
  const sent = files.map((f) => sha256(f.content)).sort()
  return stored.length === sent.length && stored.every((h, i) => h === sent[i])
}

async function removeDocuments(brandCaseId: string): Promise<void> {
  const { data } = await supabaseAdmin.from('brand_case_documents').select('id, storage_path').eq('brand_case_id', brandCaseId)
  if (!data?.length) return
  await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove(data.map((d) => d.storage_path))
  await supabaseAdmin.from('brand_case_documents').delete().in('id', data.map((d) => d.id))
}

// ── Submitting a borrower ─────────────────────────────────────────────────

export interface SubmitResult {
  loan_id: string | null
  case_id?: string
  status?: BrandCaseStatus
  missing?: string[]
  /** This loan was already submitted: the existing case is returned. */
  duplicate?: boolean
  /** An earlier submission that hadn't been worked on yet was corrected by this one. */
  updated?: boolean
  /** Fields changed after we started on the borrower: not applied, flagged for staff. */
  flagged?: string[]
  note?: string
  error?: string
}

/** Statuses in which a resubmission may still correct the borrower (nothing done with it yet). */
const CORRECTABLE: BrandCaseStatus[] = ['new', 'missing_documents']

type ApiCase = BrandCaseRecord & { missing_items: string[] }
const API_CASE_FIELDS = `${CASE_FIELDS}, missing_items`

function summary(c: ApiCase, extra: Partial<SubmitResult> = {}): SubmitResult {
  return {
    loan_id: c.external_ref,
    case_id: c.case_ref,
    status: c.status,
    ...(c.status === 'missing_documents' ? { missing: c.missing_items } : {}),
    ...extra,
  }
}

export async function submitBorrower(ctx: ApiContext, raw: unknown, deps: { fetcher: DocumentFetcher } = { fetcher: fetchDocument }): Promise<SubmitResult> {
  const parsed = parseBorrowerInput(raw)
  if (parsed.ok === false) return { loan_id: parsed.loanId, error: parsed.errors.join(' ') }
  const { loanId, values, documents } = parsed.input

  const { files, problems } = await loadDocuments(documents, deps.fetcher)
  const checked = checkBorrower(toSheetRow(values), { documentsStored: true })
  const missing = [...(checked.ok === false ? checked.missing : []), ...problems]

  const findExisting = async () =>
    (
      await supabaseAdmin
        .from('brand_cases')
        .select(API_CASE_FIELDS)
        .eq('brand_id', ctx.brand.id)
        .eq('is_test', ctx.isTest)
        .eq('external_ref', loanId)
        .maybeSingle<ApiCase>()
    ).data

  const existing = await findExisting()
  const snapshot = Object.fromEntries(BRAND_COLUMNS.map((c) => [c, values[c]]))
  const hash = snapshotHash(toSheetRow(values))

  if (existing) {
    // Empty notes in a resubmission leave the notes alone (they may have been added with POST /notes).
    const currentNotes = existing.last_notes ?? existing.borrower?.Notes ?? ''
    const notes = values.Notes || currentNotes
    const changed =
      existing.snapshot_hash !== hash ||
      notes !== currentNotes ||
      (files.length > 0 && !(await sameDocuments(existing.id, files)))
    if (!changed) return summary(existing, { duplicate: true })
    if (!CORRECTABLE.includes(existing.status) || existing.claimed_at) return resubmittedAfterProcessing(ctx, existing, values)
    return correctBorrower(ctx, existing, { snapshot: { ...snapshot, Notes: notes }, hash, files, missing, notes })
  }

  // A new borrower. Documents are required: a letter of demand must rest on the loan papers.
  if (files.length === 0 && problems.length === 0) missing.push('Documents (send at least one: the loan agreement or statement)')
  const status: BrandCaseStatus = missing.length ? 'missing_documents' : 'new'

  const { data: ref, error: refErr } = await supabaseAdmin.rpc('allocate_brand_case_ref', { p_brand_id: ctx.brand.id })
  if (refErr || typeof ref !== 'string') return { loan_id: loanId, error: 'Could not create the case. Please retry.' }
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('brand_cases')
    .insert({
      brand_id: ctx.brand.id,
      case_ref: ref,
      status,
      source: 'api',
      external_ref: loanId,
      is_test: ctx.isTest,
      borrower: snapshot,
      snapshot_hash: hash,
      last_notes: values.Notes,
      missing_items: missing,
    })
    .select(API_CASE_FIELDS)
    .single<ApiCase>()
  if (insErr?.code === '23505') {
    // The same loan arrived twice at the same moment; the other request created it.
    const winner = await findExisting()
    return winner ? summary(winner, { duplicate: true }) : { loan_id: loanId, error: 'Could not create the case. Please retry.' }
  }
  if (insErr || !inserted) return { loan_id: loanId, error: 'Could not create the case. Please retry.' }

  try {
    await storeDocuments(inserted.id, files)
  } catch (err) {
    // Nothing has happened to this borrower yet, so remove it and let the brand retry cleanly.
    console.error(`Storing documents for ${ref} failed:`, err)
    await supabaseAdmin.from('brand_cases').delete().eq('id', inserted.id)
    return { loan_id: loanId, error: 'Could not store the documents. Please retry.' }
  }

  await logEvent(inserted, 'case_created', { source: 'api', loan_id: loanId, test: ctx.isTest, documents: files.length })
  if (missing.length) await logEvent(inserted, 'missing_documents', { missing })
  return summary(inserted)
}

/**
 * The same loan sent again with different details after we started on it. Like a sheet edit:
 * never reprocessed (the letter rests on the details as they were). Each changed field is
 * flagged for staff, who accept or keep it; a changed note is logged.
 */
async function resubmittedAfterProcessing(ctx: ApiContext, existing: ApiCase, values: Record<string, string>): Promise<SubmitResult> {
  const flagged = await flagEdits(ctx.brand.id, existing, values)
  const lastNotes = existing.last_notes ?? existing.borrower?.Notes ?? ''
  if (values.Notes && values.Notes !== lastNotes) {
    await supabaseAdmin.from('brand_cases').update({ last_notes: values.Notes }).eq('id', existing.id)
    await logEvent(existing, 'notes_updated', { from: lastNotes, to: values.Notes, source: 'api' })
  }
  return summary(existing, {
    duplicate: true,
    ...(flagged.length ? { flagged: flagged.map((f) => f.column) } : {}),
    note: flagged.length
      ? 'This loan is already being worked on, so the changed details were not applied. Our staff have been told and will decide whether to use them. Send other updates as a note.'
      : 'This loan is already being worked on, so the changes in this submission were not applied. Send updates as a note.',
  })
}

/** A resubmission of a borrower nothing has been done with yet: the new details replace the old. */
async function correctBorrower(
  ctx: ApiContext,
  existing: ApiCase,
  next: { snapshot: Record<string, string>; hash: string; files: LoadedDocument[]; missing: string[]; notes: string },
): Promise<SubmitResult> {
  const missing = [...next.missing]
  if (next.files.length === 0) {
    const { count } = await supabaseAdmin.from('brand_case_documents').select('id', { count: 'exact', head: true }).eq('brand_case_id', existing.id)
    if (!count && !missing.some((m) => m.startsWith('Document'))) missing.push('Documents (send at least one: the loan agreement or statement)')
  }
  const status: BrandCaseStatus = missing.length ? 'missing_documents' : 'new'

  // Only wins if the sync hasn't picked the borrower up in the meantime.
  const { data: won } = await supabaseAdmin
    .from('brand_cases')
    .update({ borrower: next.snapshot, snapshot_hash: next.hash, last_notes: next.notes, missing_items: missing, status, last_error: null })
    .eq('id', existing.id)
    .in('status', CORRECTABLE)
    .is('claimed_at', null)
    .select(API_CASE_FIELDS)
    .maybeSingle<ApiCase>()
  if (!won) {
    return summary(existing, { duplicate: true, note: 'This loan has just been picked up for drafting, so the changes were not applied. Send updates as a note.' })
  }
  if (next.files.length) {
    await removeDocuments(existing.id)
    try {
      await storeDocuments(existing.id, next.files)
    } catch (err) {
      console.error(`Replacing documents for ${existing.case_ref} failed:`, err)
      await supabaseAdmin.from('brand_cases').update({ status: 'missing_documents', missing_items: ['Documents (could not be stored: please resend)'] }).eq('id', existing.id)
      return summary({ ...won, status: 'missing_documents', missing_items: ['Documents (could not be stored: please resend)'] }, { updated: true })
    }
  }
  await logEvent(existing, 'resubmitted', { source: 'api', previous_status: existing.status, missing, test: ctx.isTest })
  return summary(won, { updated: true })
}

// ── Reading a borrower ────────────────────────────────────────────────────

const LETTER_STATUSES: BrandCaseStatus[] = ['lawyer_approved', 'served', 'day7_sent', 'day14_sent', 'paid', 'disputed', 'closed']

/** A borrower of this brand and mode, by our Case ID (e.g. MONIE-0004) or the brand's own loan ID. */
async function findCase<T>(ctx: ApiContext, id: string, fields: string): Promise<T | null> {
  let q = supabaseAdmin.from('brand_cases').select(fields).eq('brand_id', ctx.brand.id).eq('is_test', ctx.isTest)
  q = isValidCaseRef(id) && id.startsWith(`${ctx.brand.code}-`) ? q.eq('case_ref', id) : q.eq('external_ref', id)
  const { data } = await q.maybeSingle<T>()
  return data ?? null
}

/** One borrower's status and dates. */
export async function getBorrower(ctx: ApiContext, id: string) {
  const c = await findCase<Record<string, string | string[] | null>>(
    ctx,
    id,
    'case_ref, external_ref, status, missing_items, billable_at, served_at, day7_sent_at, day14_sent_at, awaiting_brand_decision_at, created_at, updated_at',
  )
  if (!c) return null
  return {
    case_id: c.case_ref,
    loan_id: c.external_ref,
    status: c.status as BrandCaseStatus,
    test: ctx.isTest,
    missing: c.status === 'missing_documents' ? c.missing_items : [],
    // Test borrowers are never billable; their SAMPLE letter is there from the same step.
    letter_available: (ctx.isTest || Boolean(c.billable_at)) && LETTER_STATUSES.includes(c.status as BrandCaseStatus),
    served_at: c.served_at,
    day7_sent_at: c.day7_sent_at,
    day14_sent_at: c.day14_sent_at,
    awaiting_decision_since: c.awaiting_brand_decision_at,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }
}

// ── Notes ─────────────────────────────────────────────────────────────────

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; status: number; code: string; message: string }

const MAX_NOTE = 2000
const MAX_NOTES_TOTAL = 10_000

/**
 * POST /borrowers/{id}/notes: the API's Notes column. Each note is added (dated), never replacing
 * earlier ones. Before drafting starts it becomes part of the borrower's details, so the letter
 * can use it; a borrower waiting in Missing Documents goes back to New and is checked again on
 * the next run (the way a sheet Notes edit does). Afterwards it is logged for staff.
 */
export async function addNote(
  ctx: ApiContext,
  id: string,
  raw: unknown,
  now = new Date(),
): Promise<ApiResult<{ case_id: string; status: BrandCaseStatus; reopened: boolean; used_for_letter: boolean }>> {
  const note = typeof (raw as { note?: unknown } | null)?.note === 'string' ? (raw as { note: string }).note.trim() : ''
  if (!note) return { ok: false, status: 400, code: 'invalid_note', message: 'Send the note as { "note": "…" }.' }
  if (note.length > MAX_NOTE) return { ok: false, status: 400, code: 'invalid_note', message: `A note can be at most ${MAX_NOTE} characters.` }
  const c = await findCase<ApiCase>(ctx, id, API_CASE_FIELDS)
  if (!c) return { ok: false, status: 404, code: 'not_found', message: `No borrower "${id}" on this ${ctx.isTest ? 'test' : 'live'} key.` }

  const current = c.last_notes ?? c.borrower?.Notes ?? ''
  const lagosDate = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
  const next = `${current ? `${current}\n` : ''}[${lagosDate}] ${note}`
  if (next.length > MAX_NOTES_TOTAL) return { ok: false, status: 413, code: 'notes_full', message: 'This borrower has too many notes. Contact Pandas LP.' }

  // Only while nothing has been done with the borrower (the same rule as a resubmission).
  const reopen = c.status === 'missing_documents'
  const { data: won } = await supabaseAdmin
    .from('brand_cases')
    .update({ borrower: { ...(c.borrower ?? {}), Notes: next }, last_notes: next, ...(reopen ? { status: 'new', missing_items: [] } : {}) })
    .eq('id', c.id)
    .in('status', CORRECTABLE)
    .is('claimed_at', null)
    .select('status')
  const usedForLetter = Boolean(won?.length)
  if (!usedForLetter) await supabaseAdmin.from('brand_cases').update({ last_notes: next }).eq('id', c.id)

  await logEvent(c, 'notes_updated', { from: current, to: next, source: 'api' })
  if (usedForLetter && reopen) await logEvent(c, 'resubmitted', { previous_status: 'missing_documents', notes_changed: true, source: 'api' })
  return { ok: true, case_id: c.case_ref, status: usedForLetter && reopen ? 'new' : c.status, reopened: usedForLetter && reopen, used_for_letter: usedForLetter }
}

// ── The letter ────────────────────────────────────────────────────────────

/**
 * GET /borrowers/{id}/letter: the demand letter as a PDF, once a lawyer has approved it. The
 * stamped copy staff attached (the one served on the borrower) when there is one; until then the
 * approved text as a PDF. `version` says which stage it is from: 'approved' or 'served'.
 */
export async function getLetter(
  ctx: ApiContext,
  id: string,
): Promise<ApiResult<{ pdf: Buffer; version: 'approved' | 'served'; stamped: boolean; filename: string }>> {
  const c = await findCase<{ case_ref: string; case_id: string | null; status: BrandCaseStatus; billable_at: string | null; served_at: string | null }>(
    ctx,
    id,
    'case_ref, case_id, status, billable_at, served_at',
  )
  if (!c) return { ok: false, status: 404, code: 'not_found', message: `No borrower "${id}" on this ${ctx.isTest ? 'test' : 'live'} key.` }
  if (ctx.isTest) {
    // Test mode: the fixed SAMPLE letter, from the same point in the journey as a real one.
    if (!LETTER_STATUSES.includes(c.status)) {
      return { ok: false, status: 409, code: 'letter_not_available', message: `The letter is available once a lawyer has approved it. This borrower is "${c.status}".` }
    }
    const { data: full } = await supabaseAdmin.from('brand_cases').select('borrower').eq('case_ref', c.case_ref).eq('brand_id', ctx.brand.id).single()
    return {
      ok: true,
      pdf: sampleLetterPdf({ case_ref: c.case_ref, borrower: full?.borrower ?? null }, ctx.brand.name),
      version: c.served_at ? 'served' : 'approved',
      stamped: false,
      filename: `${c.case_ref}-SAMPLE-letter-of-demand.pdf`,
    }
  }
  if (!c.billable_at || !c.case_id || !LETTER_STATUSES.includes(c.status)) {
    return { ok: false, status: 409, code: 'letter_not_available', message: `The letter is available once a lawyer has approved it. This borrower is "${c.status}".` }
  }

  let pdf: Buffer
  let stamped = false
  const { data: blob } = await supabaseAdmin.storage.from('case-documents').download(`reviewed/${c.case_id}.pdf`)
  if (blob) {
    pdf = Buffer.from(await blob.arrayBuffer())
    stamped = true
  } else {
    const { data: matter } = await supabaseAdmin.from('cases').select('document_title, document_body').eq('id', c.case_id).single()
    if (!matter?.document_body) return { ok: false, status: 500, code: 'letter_missing', message: 'The letter could not be found. Contact Pandas LP.' }
    pdf = buildTextDocumentBuffer(matter.document_title ?? 'Letter of Demand', matter.document_body, { watermark: false })
  }
  return { ok: true, pdf, version: c.served_at ? 'served' : 'approved', stamped, filename: `${c.case_ref}-letter-of-demand.pdf` }
}

// ── Test mode ─────────────────────────────────────────────────────────────

/**
 * POST /borrowers/{id}/advance (test key only): the test borrower takes the next step of the
 * journey now instead of waiting for the scheduled run, and its update goes out straight away.
 */
export async function advanceBorrower(
  ctx: ApiContext,
  id: string,
  deps: DeliverDeps = {},
): Promise<ApiResult<{ case_id: string; from: BrandCaseStatus; status: BrandCaseStatus }>> {
  if (!ctx.isTest) return { ok: false, status: 403, code: 'test_key_only', message: 'Only test borrowers can be moved on. Use your test key.' }
  const c = await findCase<BrandCaseRecord>(ctx, id, CASE_FIELDS)
  if (!c) return { ok: false, status: 404, code: 'not_found', message: `No borrower "${id}" on this test key.` }
  const result = await advanceTestBorrower(c, new Date())
  if (result.ok === false) return { ok: false, status: 409, code: 'cannot_advance', message: result.reason }
  await deliverForBorrower(c.id, deps)
  return { ok: true, case_id: c.case_ref, from: result.from, status: result.to }
}
