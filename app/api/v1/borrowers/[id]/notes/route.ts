export const runtime = 'nodejs'

import { getClientIp } from '@/lib/rateLimit'
import { addNote, apiError, authenticate, logRequest } from '@/lib/brandApi'

// POST /api/v1/borrowers/{id}/notes  { "note": "…" }: the API's Notes column. Each note is added,
// dated, to the borrower's notes; see addNote in lib/brandApi.ts for what it changes.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req)
  const ctx = await authenticate(req)
  if (ctx instanceof Response) {
    logRequest(null, req, ctx.status, {}, ip)
    return ctx
  }
  const { id } = await params
  const text = await req.text()
  if (text.length > 20_000) {
    logRequest(ctx, req, 413, { id, code: 'too_large' }, ip)
    return apiError(413, 'too_large', 'The request body is too large. A note can be at most 2000 characters.')
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    logRequest(ctx, req, 400, { id, code: 'invalid_json' }, ip)
    return apiError(400, 'invalid_json', 'The request body is not valid JSON.')
  }
  const result = await addNote(ctx, decodeURIComponent(id).trim(), body)
  if (result.ok === false) {
    logRequest(ctx, req, result.status, { id, code: result.code }, ip)
    return apiError(result.status, result.code, result.message)
  }
  const { ok: _ok, ...answer } = result
  logRequest(ctx, req, 200, { id, case_id: answer.case_id, reopened: answer.reopened }, ip)
  return Response.json(answer)
}
