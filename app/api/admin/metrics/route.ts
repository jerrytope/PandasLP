export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { lagosToday } from '@/lib/negotiationStatus'
import { loadBillingSettings } from '@/lib/billing'
import { buildMetrics, monthKeys } from '@/lib/metrics'

const PAGE = 1000
const MAX_ROWS = 50_000

// Supabase returns at most 1,000 rows per request; read in pages so totals stay right as the
// firm grows. The cap is a runaway guard, far above the current volume.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

// The finance dashboard (admin → Finance → Overview). ?months=6 (1–24).
export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-metrics:${getClientIp(req)}`, 60, 5 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const monthsParam = Number(new URL(req.url).searchParams.get('months') ?? 6)
  const months = Number.isInteger(monthsParam) ? Math.min(24, Math.max(1, monthsParam)) : 6
  const windowStart = `${monthKeys(months)[0]}-01`
  // A day earlier covers the hour Lagos is ahead of UTC at the start of the first month.
  const windowStartIso = new Date(new Date(`${windowStart}T00:00:00Z`).getTime() - 86_400_000).toISOString()

  try {
    const [cases, invoices, invoicePayments, recoveries, aiUsage, settings] = await Promise.all([
      fetchAll((from, to) =>
        supabaseAdmin.from('cases').select('id, created_at, paid_at, amount_paid, status, source').eq('is_test', false).order('created_at').range(from, to),
      ),
      fetchAll((from, to) =>
        supabaseAdmin.from('invoices').select('status, total_kobo, amount_paid_kobo, due_date').neq('status', 'void').order('created_at').range(from, to),
      ),
      fetchAll((from, to) =>
        supabaseAdmin.from('invoice_payments').select('amount_kobo, paid_on').gte('paid_on', windowStart).order('paid_on').range(from, to),
      ),
      fetchAll((from, to) =>
        supabaseAdmin.from('recoveries').select('amount_recovered, confirmed_at, cases!inner(is_test)').eq('cases.is_test', false).order('confirmed_at').range(from, to),
      ),
      fetchAll((from, to) =>
        supabaseAdmin
          .from('ai_usage')
          .select('created_at, case_id, route, model, cost_usd, input_tokens, output_tokens, cache_read_tokens, cache_write_5m_tokens, cache_write_1h_tokens')
          .gte('created_at', windowStartIso)
          .order('created_at')
          .range(from, to),
      ),
      loadBillingSettings(),
    ])

    const metrics = buildMetrics({
      cases,
      invoices: invoices.map((i) => ({ ...i, total_kobo: Number(i.total_kobo), amount_paid_kobo: Number(i.amount_paid_kobo) })),
      invoicePayments: invoicePayments.map((p) => ({ ...p, amount_kobo: Number(p.amount_kobo) })),
      recoveries: recoveries.map((r) => ({ amount_recovered: Number(r.amount_recovered), confirmed_at: r.confirmed_at })),
      aiUsage: aiUsage.map((u) => ({ ...u, cost_usd: Number(u.cost_usd) })),
      months,
      today: lagosToday(),
    })
    return Response.json({ metrics, usdNgnRate: settings.usd_ngn_rate, generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Failed to build metrics:', err)
    return Response.json({ error: `Could not load the figures. (${err instanceof Error ? err.message : 'unknown error'})` }, { status: 500 })
  }
}
