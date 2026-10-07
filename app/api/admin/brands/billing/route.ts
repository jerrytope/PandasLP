export const runtime = 'nodejs'

import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { brandBillingSummary, createBrandInvoice } from '@/lib/brandBilling'

// GET  ?brandId=…          letters waiting to be billed, and the brand's invoices
// POST {brandId, month}    "Create invoice for {month}": a draft in Finance → Invoices
export async function GET(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const brandId = new URL(req.url).searchParams.get('brandId')
  if (!brandId) return Response.json({ error: 'Missing brandId.' }, { status: 400 })
  return Response.json(await brandBillingSummary(brandId))
}

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-brand-billing:${getClientIp(req)}`, 20, 5 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const body = (await req.json().catch(() => ({}))) as { brandId?: string; month?: string }
  if (!body.brandId || !body.month) return Response.json({ error: 'Missing brandId or month.' }, { status: 400 })
  const result = await createBrandInvoice(body.brandId, body.month, authResult.user.email ?? 'staff')
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status })
  return Response.json({ ok: true, invoice: result.invoice, letters: result.letters })
}
