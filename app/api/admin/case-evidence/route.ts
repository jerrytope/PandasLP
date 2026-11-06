export const runtime = 'nodejs'
// Reading a long PDF (a bank statement) can take a while; the file and note are saved first.
export const maxDuration = 120

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { callClaude } from '@/lib/claude'
import { EVIDENCE_BUCKET, EVIDENCE_TYPES, MAX_EVIDENCE_BYTES, isPathForCase, isVideo } from '@/lib/evidence'
import { evidenceObjectExists } from '@/lib/evidenceServer'
import { composeEvidenceText, parseEvidenceText, type EvidenceNote } from '@/lib/evidenceNote'

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 5 * 60 * 1000

// The bucket is private (see supabase-schema.sql) — a signed URL is the only way anyone,
// including staff, ever reads a file back out of it. One hour is generous enough for a
// reviewer to actually open the file, short enough that a copied/leaked link doesn't stay
// live indefinitely.
const SIGNED_URL_TTL_SECONDS = 60 * 60

// Lets staff see and open the actual evidence a client uploaded during the chat — screenshots,
// invoices, PDFs — instead of only Claude's text summary of it (see case_evidence's own
// comment in supabase-schema.sql for why that used to be the only thing that survived).
export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-case-evidence:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const url = new URL(req.url)
  const caseId = url.searchParams.get('caseId')
  if (!caseId) {
    return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('case_evidence')
    .select('id, filename, storage_path, media_type, size_bytes, extracted_facts, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: 'Failed to load evidence.' }, { status: 500 })
  }

  const evidence = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await supabaseAdmin.storage
        .from('case-evidence')
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS)
      return {
        id: row.id,
        filename: row.filename,
        mediaType: row.media_type,
        sizeBytes: row.size_bytes,
        extractedFacts: row.extracted_facts,
        createdAt: row.created_at,
        // null (not omitted) when signing fails, so the client can show "unavailable" for
        // that one file instead of the whole list quietly losing an entry.
        url: signed?.signedUrl ?? null,
      }
    }),
  )

  return Response.json({ evidence })
}

const MAX_IMAGE_READ_BYTES = 5 * 1024 * 1024

function cleanNote(n: Partial<EvidenceNote> | undefined, by: string): EvidenceNote | null {
  const what = (n?.what ?? '').trim()
  if (!what) return null
  const e = n?.electronic
  return {
    what: what.slice(0, 500),
    proves: n?.proves?.trim().slice(0, 800),
    dateRef: n?.dateRef?.trim().slice(0, 500),
    electronic: e === 'yes' || e === 'no' || e === 'unsure' ? e : undefined,
    other: n?.other?.trim().slice(0, 1500),
    by,
  }
}

// Staff add a document to the case from the dashboard, with a note on what it is and what it
// proves. The file is already in the bucket (see ./upload-url); this records it, then, if asked,
// has the AI pull out the facts that matter for that purpose (for a bank statement: the
// transactions with the defendant). A failed read keeps the file and the note.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-case-evidence-add:${getClientIp(req)}`, 30, 10 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests — please wait a few minutes.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const by = authResult.user.email || 'staff'

  let body: { caseId?: string; path?: string; filename?: string; mediaType?: string; size?: number; note?: Partial<EvidenceNote>; read?: boolean }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { caseId, path, filename, mediaType } = body
  if (!caseId || !path || !filename || !mediaType) return Response.json({ error: 'Missing file details.' }, { status: 400 })
  if (!EVIDENCE_TYPES.includes(mediaType) || !isPathForCase(path, caseId)) return Response.json({ error: 'Invalid upload.' }, { status: 400 })
  const note = cleanNote(body.note, by)
  if (!note) return Response.json({ error: 'Say what the document is before adding it.' }, { status: 400 })
  if (!(await evidenceObjectExists(path))) return Response.json({ error: 'The upload did not finish. Please try again.' }, { status: 400 })

  const { data: dup } = await supabaseAdmin.from('case_evidence').select('id').eq('case_id', caseId).eq('storage_path', path).maybeSingle()
  if (dup) return Response.json({ error: 'That file has already been added.' }, { status: 409 })

  const { data: row, error } = await supabaseAdmin
    .from('case_evidence')
    .insert({
      case_id: caseId,
      filename: String(filename).slice(0, 255),
      storage_path: path,
      media_type: mediaType,
      size_bytes: typeof body.size === 'number' && body.size <= MAX_EVIDENCE_BYTES ? body.size : null,
      extracted_facts: composeEvidenceText(note, null),
    })
    .select('id')
    .single()
  if (error || !row) return Response.json({ error: 'Could not save the document. Please try again.' }, { status: 500 })

  const readNote = isVideo(mediaType) ? 'Saved. Videos are kept but not read by the AI; your note describes it.' : body.read ? await readForPurpose({ caseId, rowId: row.id, path, filename, mediaType, note }) : 'Saved.'
  return Response.json({ ok: true, id: row.id, readNote })
}

// The AI read for a staff upload, aimed at what the lawyer says the document is for.
async function readForPurpose(o: { caseId: string; rowId: string; path: string; filename: string; mediaType: string; note: EvidenceNote }): Promise<string> {
  try {
    const { data: blob } = await supabaseAdmin.storage.from(EVIDENCE_BUCKET).download(o.path)
    if (!blob) return 'Saved. The file could not be read back for the AI; your note will be used.'
    const buffer = Buffer.from(await blob.arrayBuffer())
    if (o.mediaType.startsWith('image/') && buffer.length > MAX_IMAGE_READ_BYTES) return 'Saved. The image is too large for the AI to read; your note will be used.'
    const { data: filing } = await supabaseAdmin.from('court_filings').select('facts').eq('case_id', o.caseId).maybeSingle()
    const facts = (filing?.facts ?? {}) as { claimant?: { name?: string }; defendant?: { name?: string } }
    const data = buffer.toString('base64')
    const block = o.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: o.mediaType, data } }
    const prompt = `A lawyer at a Nigerian law firm has added this document to a case file.
The lawyer says it is: ${o.note.what}
${o.note.proves ? `It is meant to prove: ${o.note.proves}\n` : ''}${o.note.dateRef ? `Date / reference given: ${o.note.dateRef}\n` : ''}Claimant: ${facts.claimant?.name || 'not recorded'}. Defendant: ${facts.defendant?.name || 'not recorded'}.

Extract only the facts relevant to that purpose, exactly as the document shows them: every relevant date, amount, account name and number, reference and the names of the people or businesses involved. For a bank statement, give the account holder, bank, account number and period, then list each relevant transaction on its own line: date, the description as printed, amount, reference. Quote names as printed and say plainly where a name differs from the parties' names. Add the total of the relevant transactions. Do not summarise unrelated entries and give no legal opinion. Bullet points.

File name: ${o.filename}`
    const result = await callClaude({ route: 'evidence.staff-read', caseId: o.caseId, system: '', messages: [{ role: 'user', content: [block, { type: 'text', text: prompt }] }], maxTokens: 2000 })
    if (result.ok === false || !result.text?.trim()) return 'Saved. The AI could not read it; your note will be used.'
    await supabaseAdmin.from('case_evidence').update({ extracted_facts: composeEvidenceText(o.note, result.text.trim()) }).eq('id', o.rowId)
    return 'Saved and read.'
  } catch (err) {
    console.error('Staff evidence read failed:', err)
    return 'Saved. The AI read failed; your note will be used.'
  }
}

// Adds or changes the lawyer's note on any document in Evidence Files, including ones the client
// sent, keeping what the AI read from it.
export async function PATCH(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  let body: { id?: string; note?: Partial<EvidenceNote> }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.id) return Response.json({ error: 'Missing id.' }, { status: 400 })
  const note = cleanNote(body.note, authResult.user.email || 'staff')
  if (!note) return Response.json({ error: 'Say what the document is.' }, { status: 400 })
  const { data: row } = await supabaseAdmin.from('case_evidence').select('extracted_facts').eq('id', body.id).maybeSingle()
  if (!row) return Response.json({ error: 'Document not found.' }, { status: 404 })
  const { facts } = parseEvidenceText(row.extracted_facts)
  const { error } = await supabaseAdmin.from('case_evidence').update({ extracted_facts: composeEvidenceText(note, facts) }).eq('id', body.id)
  if (error) return Response.json({ error: 'Could not save the note.' }, { status: 500 })
  return Response.json({ ok: true })
}
