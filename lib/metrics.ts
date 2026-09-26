// The finance dashboard's numbers, computed from raw rows in one pure function so every figure
// is unit-tested (lib/__tests__/metrics.test.ts) rather than trusted. app/api/admin/metrics
// fetches the rows and calls buildMetrics; the admin Finance tab only displays the result.
//
// Conventions: months are calendar months in Lagos time; money is kobo; AI cost is US dollars
// (what Anthropic bills) and converted to naira only for display, at the rate in settings.
// Test cases (is_test) are excluded before rows reach here.

import { nairaToKobo } from './money'
import { costUsd, uncachedCostUsd, type TokenUsage } from './aiPricing'

export interface MetricsCase {
  id: string
  created_at: string
  paid_at: string | null
  amount_paid: number // whole naira
  status: string
  source: string | null
}
export interface MetricsInvoice {
  status: string
  total_kobo: number
  amount_paid_kobo: number
  due_date: string | null
}
export interface MetricsInvoicePayment {
  amount_kobo: number
  paid_on: string // YYYY-MM-DD
}
export interface MetricsRecovery {
  amount_recovered: number // whole naira
  confirmed_at: string
}
export interface MetricsAiUsage {
  created_at: string
  case_id: string | null
  route: string
  model: string
  cost_usd: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_5m_tokens: number
  cache_write_1h_tokens: number
}

export interface MonthMetrics {
  key: string // YYYY-MM
  label: string // "Sep 2026"
  feesKobo: number // fixed-fee revenue from matters paid that month
  invoiceKobo: number // invoice payments received that month
  revenueKobo: number
  startedMatters: number
  paidMatters: number
  recoveredKobo: number
  aiCostUsd: number
}

export const FUNNEL_STAGES = [
  { status: 'draft', label: 'Started' },
  { status: 'document_ready', label: 'Document drafted' },
  { status: 'paid', label: 'Paid' },
  { status: 'letter_served', label: 'Letter served' },
  { status: 'filed', label: 'Filed in court' },
  { status: 'judgment_obtained', label: 'Judgment' },
  { status: 'closed', label: 'Closed' },
] as const
const STAGE_INDEX = new Map<string, number>(FUNNEL_STAGES.map((s, i) => [s.status, i]))

export function lagosMonthKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }).slice(0, 7)
}

/** The last `count` month keys, oldest first, ending with the month containing `now`. */
export function monthKeys(count: number, now: Date = new Date()): string[] {
  const [y, m] = lagosMonthKey(now.toISOString()).split('-').map(Number)
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function buildMetrics(input: {
  cases: MetricsCase[]
  invoices: MetricsInvoice[]
  invoicePayments: MetricsInvoicePayment[]
  recoveries: MetricsRecovery[]
  aiUsage: MetricsAiUsage[]
  months: number
  today: string // YYYY-MM-DD, Lagos
  now?: Date
}) {
  const keys = monthKeys(input.months, input.now)
  const inWindow = new Set(keys)
  const byMonth = new Map<string, MonthMetrics>(
    keys.map((key) => [key, { key, label: monthLabel(key), feesKobo: 0, invoiceKobo: 0, revenueKobo: 0, startedMatters: 0, paidMatters: 0, recoveredKobo: 0, aiCostUsd: 0 }]),
  )

  const paidCaseIds = new Set<string>()
  for (const c of input.cases) {
    const started = byMonth.get(lagosMonthKey(c.created_at))
    if (started) started.startedMatters++
    if (c.paid_at) {
      paidCaseIds.add(c.id)
      const m = byMonth.get(lagosMonthKey(c.paid_at))
      if (m) {
        m.paidMatters++
        m.feesKobo += nairaToKobo(c.amount_paid || 0)
      }
    }
  }
  for (const p of input.invoicePayments) {
    const m = byMonth.get(p.paid_on.slice(0, 7))
    if (m) m.invoiceKobo += p.amount_kobo
  }
  let recoveredAllTimeKobo = 0
  for (const r of input.recoveries) {
    const kobo = nairaToKobo(r.amount_recovered)
    recoveredAllTimeKobo += kobo
    const m = byMonth.get(lagosMonthKey(r.confirmed_at))
    if (m) m.recoveredKobo += kobo
  }

  // AI: spend by month and route, cache effect, and cost per paid matter.
  const aiByRoute = new Map<string, { route: string; calls: number; costUsd: number }>()
  const aiByCase = new Map<string, number>()
  let windowCost = 0
  // Savings compare like with like: both sides priced from the same token counts.
  let windowUncached = 0
  let windowPricedFromTokens = 0
  let promptTokens = 0
  let cachedTokens = 0
  for (const u of input.aiUsage) {
    const key = lagosMonthKey(u.created_at)
    if (!inWindow.has(key)) continue
    const cost = Number(u.cost_usd) || 0
    byMonth.get(key)!.aiCostUsd += cost
    windowCost += cost
    const tokens: TokenUsage = {
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheReadTokens: u.cache_read_tokens,
      cacheWrite5mTokens: u.cache_write_5m_tokens,
      cacheWrite1hTokens: u.cache_write_1h_tokens,
    }
    windowUncached += uncachedCostUsd(u.model, tokens)
    windowPricedFromTokens += costUsd(u.model, tokens)
    promptTokens += u.input_tokens + u.cache_read_tokens + u.cache_write_5m_tokens + u.cache_write_1h_tokens
    cachedTokens += u.cache_read_tokens
    const route = u.route.split('.')[0]
    const r = aiByRoute.get(route) ?? { route, calls: 0, costUsd: 0 }
    r.calls++
    r.costUsd += cost
    aiByRoute.set(route, r)
    if (u.case_id) aiByCase.set(u.case_id, (aiByCase.get(u.case_id) ?? 0) + cost)
  }
  const paidWithUsage = [...aiByCase.entries()].filter(([id]) => paidCaseIds.has(id))
  const aiCostPerPaidMatterUsd = paidWithUsage.length
    ? paidWithUsage.reduce((s, [, c]) => s + c, 0) / paidWithUsage.length
    : null

  const months = keys.map((k) => {
    const m = byMonth.get(k)!
    m.revenueKobo = m.feesKobo + m.invoiceKobo
    m.aiCostUsd = Math.round(m.aiCostUsd * 10000) / 10000
    return m
  })
  const thisMonth = months[months.length - 1]
  const lastMonth = months.length > 1 ? months[months.length - 2] : null

  // Receivables: what clients still owe on sent invoices.
  let outstandingKobo = 0
  let overdueKobo = 0
  let overdueCount = 0
  for (const inv of input.invoices) {
    if (inv.status !== 'sent' && inv.status !== 'part_paid') continue
    const balance = Math.max(0, inv.total_kobo - inv.amount_paid_kobo)
    outstandingKobo += balance
    if (inv.due_date && inv.due_date < input.today) {
      overdueKobo += balance
      overdueCount++
    }
  }

  const funnel = FUNNEL_STAGES.map((stage, i) => ({
    label: stage.label,
    count: input.cases.filter((c) => (STAGE_INDEX.get(c.status) ?? 0) >= i).length,
  }))

  const sourceMap = new Map<string, { source: string; paidMatters: number; revenueKobo: number }>()
  for (const c of input.cases) {
    if (!c.paid_at || !inWindow.has(lagosMonthKey(c.paid_at))) continue
    const source = c.source?.trim() || 'Direct / unknown'
    const s = sourceMap.get(source) ?? { source, paidMatters: 0, revenueKobo: 0 }
    s.paidMatters++
    s.revenueKobo += nairaToKobo(c.amount_paid || 0)
    sourceMap.set(source, s)
  }

  return {
    months,
    kpis: {
      revenueThisMonthKobo: thisMonth.revenueKobo,
      revenueLastMonthKobo: lastMonth?.revenueKobo ?? 0,
      revenueWindowKobo: months.reduce((s, m) => s + m.revenueKobo, 0),
      paidThisMonth: thisMonth.paidMatters,
      paidLastMonth: lastMonth?.paidMatters ?? 0,
      recoveredAllTimeKobo,
      recoveredWindowKobo: months.reduce((s, m) => s + m.recoveredKobo, 0),
      outstandingKobo,
      overdueKobo,
      overdueCount,
      aiCostWindowUsd: Math.round(windowCost * 10000) / 10000,
      aiCostPerPaidMatterUsd: aiCostPerPaidMatterUsd != null ? Math.round(aiCostPerPaidMatterUsd * 10000) / 10000 : null,
      cacheSavingsUsd: Math.round(Math.max(0, windowUncached - windowPricedFromTokens) * 10000) / 10000,
      cacheHitRate: promptTokens ? cachedTokens / promptTokens : null,
    },
    funnel,
    sources: [...sourceMap.values()].sort((a, b) => b.paidMatters - a.paidMatters || b.revenueKobo - a.revenueKobo),
    aiByRoute: [...aiByRoute.values()]
      .map((r) => ({ ...r, costUsd: Math.round(r.costUsd * 10000) / 10000 }))
      .sort((a, b) => b.costUsd - a.costUsd),
  }
}

export type Metrics = ReturnType<typeof buildMetrics>
