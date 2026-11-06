export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, isPathForCase } from '@/lib/evidence'
import { alertNewEvidence, evidenceObjectExists } from '@/lib/evidenceServer'
import { readUploadToken } from '@/lib/uploadLink'

const SIGNED_NOTE = 'Signed court forms returned by the client through the upload link.'

// The client's private upload link, step 2: once the files are in the bucket, record each one
// in the case's Evidence Files, note on the court filing that signed copies came back, and tell
// the firm. Only files that are really in that case's folder are recorded.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`upload-link-done:${getClientIp(req)}`, 20, 10 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests — please wait a few minutes.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })

  let body: { t?: string; files?: { path?: string; filename?: string; mediaType?: string; size?: number }[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const link = readUploadToken(body.t)
  if (!link) return Response.json({ error: 'This upload link has expired or is not valid. Please ask us for a new one on WhatsApp.' }, { status: 403 })
  const files = (body.files ?? []).slice(0, 30)
  if (!files.length) return Response.json({ error: 'No files were uploaded.' }, { status: 400 })

  const rows: { case_id: string; filename: string; storage_path: string; media_type: string; size_bytes: number | null; extracted_facts: string }[] = []
  for (const f of files) {
    if (!f.path || !f.filename || !f.mediaType || !isPathForCase(f.path, link.caseId) || !DOCUMENT_TYPES.includes(f.mediaType)) continue
    if (!(await evidenceObjectExists(f.path))) continue
    rows.push({
      case_id: link.caseId,
      filename: String(f.filename).slice(0, 255),
      storage_path: f.path,
      media_type: f.mediaType,
      size_bytes: typeof f.size === 'number' && f.size <= MAX_DOCUMENT_BYTES ? f.size : null,
      extracted_facts: SIGNED_NOTE,
    })
  }
  if (!rows.length) return Response.json({ error: 'We could not find those uploads. Please try again.' }, { status: 400 })

  // Re-submitting the same upload must not record it twice.
  const { data: existing } = await supabaseAdmin.from('case_evidence').select('storage_path').eq('case_id', link.caseId).in('storage_path', rows.map((r) => r.storage_path))
  const known = new Set((existing ?? []).map((e: { storage_path: string }) => e.storage_path))
  const fresh = rows.filter((r) => !known.has(r.storage_path))
  if (fresh.length) {
    const { error } = await supabaseAdmin.from('case_evidence').insert(fresh)
    if (error) {
      console.error('Failed to record signed forms:', error)
      return Response.json({ error: 'Your files were uploaded but could not be recorded. Please tell us on WhatsApp.' }, { status: 500 })
    }
    // The date the signed copies came back, shown in the Court filing tab.
    const { data: filing } = await supabaseAdmin.from('court_filings').select('id').eq('case_id', link.caseId).maybeSingle()
    if (filing) {
      await supabaseAdmin.from('court_filing_documents').insert({
        filing_id: filing.id,
        kind: 'signed_received',
        title: `Signed forms received (${fresh.length} file${fresh.length === 1 ? '' : 's'})`,
        body: fresh.map((r) => r.filename).join('\n'),
        ai_generated: false,
        created_by: 'client upload link',
      })
    }
    await alertNewEvidence({ caseId: link.caseId, files: fresh.map((r) => ({ filename: r.filename })), via: 'upload link' })
  }
  return Response.json({ ok: true, received: rows.length })
}
