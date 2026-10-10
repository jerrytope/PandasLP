export const runtime = 'nodejs'

import { getClientIp } from '@/lib/rateLimit'
import { apiError, authenticate, logRequest, submitBorrower, type SubmitResult } from '@/lib/brandApi'
import { MAX_BATCH } from '@/lib/brandApiInput'

// Kept under AWS Lambda's 6 MB request limit with room to spare. With documents inside the
// JSON (under 1 MB each, about 1.4 MB once base64-encoded) that is up to 3 borrowers per call;
// with document links, up to MAX_BATCH. Plan: plans/phase-5-api-intake.md.
const MAX_BODY_BYTES = 5 * 1024 * 1024

// POST /api/v1/borrowers
//   One borrower:      { "loan_id": "...", "borrower_full_name": "...", ..., "documents": [...] }
//   Several at once:   { "borrowers": [ {...}, {...} ] }
// Always answers { "results": [...] }, one entry per borrower, in the order sent: our Case ID
// and status, or what's missing, or why that one borrower couldn't be accepted.
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const ctx = await authenticate(req)
  if (ctx instanceof Response) {
    logRequest(null, req, ctx.status, {}, ip)
    return ctx
  }

  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) {
    logRequest(ctx, req, 413, { declared }, ip)
    return apiError(413, 'too_large', 'The request is over 5 MB. Send fewer borrowers per call, or use document links.')
  }
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) {
    logRequest(ctx, req, 413, { size: text.length }, ip)
    return apiError(413, 'too_large', 'The request is over 5 MB. Send fewer borrowers per call, or use document links.')
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    logRequest(ctx, req, 400, { reason: 'invalid_json' }, ip)
    return apiError(400, 'invalid_json', 'The request body is not valid JSON.')
  }

  const list: unknown[] =
    body && typeof body === 'object' && !Array.isArray(body) && Array.isArray((body as { borrowers?: unknown }).borrowers)
      ? (body as { borrowers: unknown[] }).borrowers
      : [body]
  if (list.length === 0) return apiError(400, 'empty', 'No borrowers in the request.')
  if (list.length > MAX_BATCH) {
    logRequest(ctx, req, 400, { count: list.length }, ip)
    return apiError(400, 'batch_too_large', `At most ${MAX_BATCH} borrowers per call.`)
  }

  // One at a time, in order: each may allocate a Case ID and store documents.
  const results: SubmitResult[] = []
  for (const item of list) {
    try {
      results.push(await submitBorrower(ctx, item))
    } catch (err) {
      console.error('Brand API submission failed:', err)
      const loanId = item && typeof item === 'object' && 'loan_id' in item ? String((item as { loan_id: unknown }).loan_id) : null
      results.push({ loan_id: loanId, error: 'Something went wrong with this borrower. Please retry.' })
    }
  }

  const created = results.filter((r) => r.case_id && !r.duplicate && !r.updated).length
  logRequest(ctx, req, 200, { count: list.length, created, errors: results.filter((r) => r.error).length, case_ids: results.map((r) => r.case_id ?? null) }, ip)
  return Response.json({ test: ctx.isTest, results })
}
