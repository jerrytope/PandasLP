export const runtime = 'nodejs'

import { getClientIp } from '@/lib/rateLimit'
import { apiError, authenticate, getLetter, logRequest } from '@/lib/brandApi'

// GET /api/v1/borrowers/{id}/letter: the demand letter as a PDF, once a lawyer has approved it.
// {id} is our Case ID or the brand's loan ID. The X-Letter-Version header says which stage the
// copy is from ('approved', or 'served' once it has been served on the borrower), and
// X-Letter-Stamped whether it is the stamped copy staff attached.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req)
  const ctx = await authenticate(req)
  if (ctx instanceof Response) {
    logRequest(null, req, ctx.status, {}, ip)
    return ctx
  }
  const { id } = await params
  const result = await getLetter(ctx, decodeURIComponent(id).trim())
  if (result.ok === false) {
    logRequest(ctx, req, result.status, { id, code: result.code }, ip)
    return apiError(result.status, result.code, result.message)
  }
  logRequest(ctx, req, 200, { id, version: result.version, stamped: result.stamped }, ip)
  return new Response(new Uint8Array(result.pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${result.filename}"`,
      'cache-control': 'no-store',
      'x-letter-version': result.version,
      'x-letter-stamped': result.stamped ? 'yes' : 'no',
    },
  })
}
