export const runtime = 'nodejs'

import { getClientIp } from '@/lib/rateLimit'
import { advanceBorrower, apiError, authenticate, logRequest } from '@/lib/brandApi'

// POST /api/v1/borrowers/{id}/advance — TEST KEY ONLY. Moves a test borrower to the next step of
// the journey now (drafted, approved, served, Day 7, Day 14, closed) instead of waiting for the
// scheduled run, and sends that step's webhook straight away. See lib/brandTestMode.ts.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req)
  const ctx = await authenticate(req)
  if (ctx instanceof Response) {
    logRequest(null, req, ctx.status, {}, ip)
    return ctx
  }
  const { id } = await params
  const result = await advanceBorrower(ctx, decodeURIComponent(id).trim())
  if (result.ok === false) {
    logRequest(ctx, req, result.status, { id, code: result.code }, ip)
    return apiError(result.status, result.code, result.message)
  }
  const { ok: _ok, ...answer } = result
  logRequest(ctx, req, 200, { id, from: answer.from, to: answer.status }, ip)
  return Response.json(answer)
}
