import { describe, expect, it } from 'vitest'
import { buildMetrics, lagosMonthKey, monthKeys } from '../metrics'

const NOW = new Date('2026-09-26T10:00:00Z')

const base = {
  cases: [
    { id: 'a', created_at: '2026-08-19T09:00:00Z', paid_at: '2026-08-19T10:00:00Z', amount_paid: 25000, status: 'closed', source: 'x' },
    { id: 'b', created_at: '2026-09-02T09:00:00Z', paid_at: '2026-09-02T11:00:00Z', amount_paid: 10000, status: 'letter_served', source: 'x' },
    { id: 'c', created_at: '2026-09-10T09:00:00Z', paid_at: null, amount_paid: 0, status: 'document_ready', source: null },
    { id: 'd', created_at: '2026-09-11T09:00:00Z', paid_at: '2026-09-12T09:00:00Z', amount_paid: 25000, status: 'paid', source: 'referral' },
  ],
  invoices: [
    { status: 'sent', total_kobo: 5_000_000, amount_paid_kobo: 0, due_date: '2026-10-03' },
    { status: 'part_paid', total_kobo: 2_000_000, amount_paid_kobo: 500_000, due_date: '2026-09-20' },
    { status: 'paid', total_kobo: 1_000_000, amount_paid_kobo: 1_000_000, due_date: '2026-09-01' },
    { status: 'draft', total_kobo: 9_000_000, amount_paid_kobo: 0, due_date: null },
  ],
  invoicePayments: [
    { amount_kobo: 1_000_000, paid_on: '2026-09-05' },
    { amount_kobo: 500_000, paid_on: '2026-09-21' },
  ],
  recoveries: [{ amount_recovered: 3_200_000, confirmed_at: '2026-09-05T12:00:00Z' }],
  aiUsage: [
    { created_at: '2026-09-02T10:00:00Z', case_id: 'b', route: 'chat.small-claims', model: 'claude-sonnet-4-6', cost_usd: 0.4, input_tokens: 1000, output_tokens: 500, cache_read_tokens: 50_000, cache_write_5m_tokens: 2000, cache_write_1h_tokens: 8000 },
    { created_at: '2026-09-02T10:05:00Z', case_id: 'b', route: 'chat.small-claims', model: 'claude-sonnet-4-6', cost_usd: 0.2, input_tokens: 500, output_tokens: 400, cache_read_tokens: 60_000, cache_write_5m_tokens: 800, cache_write_1h_tokens: 0 },
    { created_at: '2026-09-12T10:00:00Z', case_id: 'd', route: 'chat.small-claims', model: 'claude-sonnet-4-6', cost_usd: 0.9, input_tokens: 1000, output_tokens: 500, cache_read_tokens: 0, cache_write_5m_tokens: 0, cache_write_1h_tokens: 0 },
    { created_at: '2026-09-15T10:00:00Z', case_id: 'c', route: 'evidence.extract', model: 'claude-sonnet-4-6', cost_usd: 0.05, input_tokens: 3000, output_tokens: 300, cache_read_tokens: 0, cache_write_5m_tokens: 0, cache_write_1h_tokens: 0 },
    { created_at: '2026-01-01T10:00:00Z', case_id: null, route: 'translate.text', model: 'claude-sonnet-4-6', cost_usd: 5, input_tokens: 1, output_tokens: 1, cache_read_tokens: 0, cache_write_5m_tokens: 0, cache_write_1h_tokens: 0 },
  ],
  months: 6,
  today: '2026-09-26',
  now: NOW,
}

describe('metrics', () => {
  it('buckets by Lagos month', () => {
    // 23:30 UTC on 31 Aug is already 1 Sept in Lagos.
    expect(lagosMonthKey('2026-08-31T23:30:00Z')).toBe('2026-09')
    expect(monthKeys(3, NOW)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(monthKeys(2, new Date('2026-01-15T00:00:00Z'))).toEqual(['2025-12', '2026-01'])
  })

  it('adds fixed fees and invoice payments into monthly revenue', () => {
    const m = buildMetrics(base)
    const sep = m.months.find((x) => x.key === '2026-09')!
    const aug = m.months.find((x) => x.key === '2026-08')!
    expect(aug.feesKobo).toBe(2_500_000)
    expect(sep.feesKobo).toBe(3_500_000) // 10,000 + 25,000 naira
    expect(sep.invoiceKobo).toBe(1_500_000)
    expect(sep.revenueKobo).toBe(5_000_000)
    expect(m.kpis.revenueThisMonthKobo).toBe(5_000_000)
    expect(m.kpis.revenueLastMonthKobo).toBe(2_500_000)
    expect(sep.startedMatters).toBe(3)
    expect(sep.paidMatters).toBe(2)
  })

  it('reports recoveries and receivables', () => {
    const m = buildMetrics(base)
    expect(m.kpis.recoveredAllTimeKobo).toBe(320_000_000)
    expect(m.kpis.outstandingKobo).toBe(5_000_000 + 1_500_000) // drafts and paid excluded
    expect(m.kpis.overdueKobo).toBe(1_500_000)
    expect(m.kpis.overdueCount).toBe(1)
  })

  it('costs AI per paid matter, ignoring calls outside the window and unpaid matters', () => {
    const m = buildMetrics(base)
    // b: 0.6, d: 0.9 → average 0.75. c is unpaid; the January call is outside the window.
    expect(m.kpis.aiCostPerPaidMatterUsd).toBeCloseTo(0.75, 6)
    expect(m.kpis.aiCostWindowUsd).toBeCloseTo(1.55, 6)
    expect(m.kpis.cacheSavingsUsd).toBeGreaterThan(0)
    expect(m.kpis.cacheHitRate).toBeGreaterThan(0.8)
    expect(m.aiByRoute[0]).toEqual({ route: 'chat', calls: 3, costUsd: 1.5 })
  })

  it('counts the funnel cumulatively and ranks sources', () => {
    const m = buildMetrics(base)
    expect(m.funnel.map((f) => f.count)).toEqual([4, 4, 3, 2, 1, 1, 1])
    expect(m.sources[0]).toEqual({ source: 'x', paidMatters: 2, revenueKobo: 3_500_000 })
  })
})
