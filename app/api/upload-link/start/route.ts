export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { EVIDENCE_BUCKET, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, evidencePath } from '@/lib/evidence'
import { readUploadToken } from '@/lib/uploadLink'

// The client's private upload link (lib/uploadLink.ts), step 1: a one-time signed URL to upload
// one signed form straight into the case's private evidence folder. No sign-in; the link itself
// is the permission, and it only lets files be added to that one case.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`upload-link:${getClientIp(req)}`, 40, 10 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many uploads — please wait a few minutes and try again.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })

  let body: { t?: string; filename?: string; mediaType?: string; size?: number }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const link = readUploadToken(body.t)
  if (!link) return Response.json({ error: 'This upload link has expired or is not valid. Please ask us for a new one on WhatsApp.' }, { status: 403 })
  const { filename, mediaType, size } = body
  if (!filename || typeof filename !== 'string' || filename.length > 255 || !mediaType) return Response.json({ error: 'Missing file details.' }, { status: 400 })
  if (!DOCUMENT_TYPES.includes(mediaType)) return Response.json({ error: 'Please send PDFs or photos (JPG or PNG).' }, { status: 400 })
  if (typeof size !== 'number' || size <= 0 || size > MAX_DOCUMENT_BYTES) return Response.json({ error: 'Each file must be under 10 MB.' }, { status: 413 })

  const { data: c } = await supabaseAdmin.from('cases').select('id').eq('id', link.caseId).maybeSingle()
  if (!c) return Response.json({ error: 'This upload link is no longer valid. Please ask us for a new one on WhatsApp.' }, { status: 404 })

  const { data, error } = await supabaseAdmin.storage.from(EVIDENCE_BUCKET).createSignedUploadUrl(evidencePath(link.caseId, `signed-${filename}`))
  if (error || !data) {
    console.error('Could not create a signed-forms upload URL:', error)
    return Response.json({ error: 'Could not start the upload. Please try again.' }, { status: 500 })
  }
  return Response.json({ path: data.path, token: data.token })
}
