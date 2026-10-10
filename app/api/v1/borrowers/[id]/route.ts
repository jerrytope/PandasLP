export const runtime = 'nodejs'

import { getClientIp } from '@/lib/rateLimit'
import { apiError, authenticate, getBorrower, logRequest } from '@/lib/brandApi'

// GET /api/v1/borrowers/{id}: one borrower's status and dates. {id} is our Case ID
// (e.g. MONIE-0004) or the brand's own loan ID. A test key only sees test borrowers, a live key
// only live ones.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req)
  const ctx = await authenticate(req)
  if (ctx instanceof Response) {
    logRequest(null, req, ctx.status, {}, ip)
    return ctx
  }
  const { id } = await params
  const borrower = await getBorrower(ctx, decodeURIComponent(id).trim())
  if (!borrower) {
    logRequest(ctx, req, 404, { id }, ip)
    return apiError(404, 'not_found', `No borrower "${id}" on this ${ctx.isTest ? 'test' : 'live'} key.`)
  }
  logRequest(ctx, req, 200, { case_id: borrower.case_id }, ip)
  return Response.json(borrower)
}
