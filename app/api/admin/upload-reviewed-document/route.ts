export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { CASE_DOCUMENT_BUCKET, reviewedDocumentPath } from '@/lib/reviewedDocuments'

const RATE_LIMIT = 15
const RATE_WINDOW_MS = 10 * 60 * 1000
const MAX_FILE_BYTES = 10 * 1024 * 1024
// The staff-uploaded, reviewed-and-stamped PDF for a specific case — when present, this is
// what sendCaseEmail's `reviewed_document` type attaches instead of the auto-generated PDF
// built from document_body (see lib/sendCaseEmail.ts). Lets a lawyer's actual signature/stamp
// go out to the client instead of the system's plain rendering.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-upload-reviewed-doc:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many uploads — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { caseId?: string; fileBase64?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { caseId, fileBase64 } = body
  if (!caseId || !fileBase64) {
    return Response.json({ error: 'Missing caseId or file.' }, { status: 400 })
  }

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }

  // Same size-estimate approach as app/api/extract/route.ts — base64 inflates size ~4/3.
  const approxBytes = (fileBase64.length * 3) / 4
  if (approxBytes > MAX_FILE_BYTES) {
    return Response.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 413 })
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(fileBase64, 'base64')
  } catch {
    return Response.json({ error: 'Invalid file data.' }, { status: 400 })
  }
  // %PDF is the standard PDF file signature — a cheap, real check that this is actually a
  // PDF rather than trusting a client-reported mime type that doesn't exist in this request.
  if (buffer.subarray(0, 4).toString('ascii') !== '%PDF') {
    return Response.json({ error: 'File must be a PDF.' }, { status: 400 })
  }

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(CASE_DOCUMENT_BUCKET)
    .upload(reviewedDocumentPath(caseId), buffer, { contentType: 'application/pdf', upsert: true })
  if (uploadErr) {
    console.error('Failed to upload reviewed document:', uploadErr)
    // Admin-only route, so the storage message is safe to show — it is the only way to see
    // that the case-documents bucket is missing (see fix-review-and-stamp.sql).
    return Response.json({ error: `Failed to upload the document. (${uploadErr.message})` }, { status: 500 })
  }

  return Response.json({ ok: true })
}
