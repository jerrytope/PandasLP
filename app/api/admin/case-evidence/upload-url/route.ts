export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { EVIDENCE_BUCKET, EVIDENCE_TYPES, evidencePath, maxBytesFor, sizeLimitText } from '@/lib/evidence'

// Staff adding a document to a case's Evidence Files from the dashboard (a bank statement, the
// agreement, proof of service): a one-time signed URL to upload the original straight into the
// case's private evidence folder. The note and the AI read are recorded by POST
// /api/admin/case-evidence once the upload has finished.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-evidence-upload:${getClientIp(req)}`, 60, 10 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many uploads — please wait a few minutes.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { caseId?: string; filename?: string; mediaType?: string; size?: number }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { caseId, filename, mediaType, size } = body
  if (!caseId || !filename || !mediaType) return Response.json({ error: 'Missing file details.' }, { status: 400 })
  if (!EVIDENCE_TYPES.includes(mediaType)) return Response.json({ error: 'Upload a PDF, an image (JPG, PNG, WEBP) or a video (MP4, MOV, WEBM, 3GP).' }, { status: 400 })
  if (typeof size !== 'number' || size <= 0 || size > maxBytesFor(mediaType)) return Response.json({ error: `The file must be under ${sizeLimitText(mediaType)}.` }, { status: 413 })

  const { data: c } = await supabaseAdmin.from('cases').select('id').eq('id', caseId).maybeSingle()
  if (!c) return Response.json({ error: 'Case not found.' }, { status: 404 })

  const { data, error } = await supabaseAdmin.storage.from(EVIDENCE_BUCKET).createSignedUploadUrl(evidencePath(caseId, filename))
  if (error || !data) return Response.json({ error: 'Could not start the upload. Please try again.' }, { status: 500 })
  return Response.json({ path: data.path, token: data.token })
}
