'use client'

import { useEffect, useRef, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import type { Metrics } from '@/lib/metrics'
import { formatKobo } from '@/lib/money'
import { SERIES, compactNaira, mutedText, usd } from './shared'

type Payload = { metrics: Metrics; usdNgnRate: number | null; generatedAt: string }

const AI_ROUTE_LABEL: Record<string, string> = {
  chat: 'Client and lawyer chat',
  evidence: 'Reading evidence',
  translate: 'Translation',
  negotiation: 'Negotiation replies and advice',
  document: 'Document redrafts',
  intake: 'Intake triage',
}

// The business in numbers: revenue, matters, recoveries, receivables and what the AI costs.
// Every figure comes from lib/metrics.ts (unit-tested); this component only lays it out.
export default function FinanceOverview() {
  const [months, setMonths] = useState(6)
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr('')
    authedFetch(`/api/admin/metrics?months=${months}`)
      .then(async (res) => {
        const body = await res.json()
        if (cancelled) return
        if (!res.ok || body.error) setErr(body.error || 'Could not load the figures.')
        else setData(body)
      })
      .catch(() => !cancelled && setErr('Network error while loading the figures.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [months])

  const m = data?.metrics
  const fx = data?.usdNgnRate ?? null
  const inNaira = (usdAmount: number | null) => (usdAmount != null && fx ? ` · ${formatKobo(Math.round(usdAmount * fx * 100))}` : '')

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div role="group" aria-label="Time range" style={{ display: 'flex', gap: 4 }}>
          {[3, 6, 12].map((n) => (
            <button key={n} type="button" className={`btn btn-sm${months === n ? ' btn-primary' : ''}`} aria-pressed={months === n} onClick={() => setMonths(n)}>
              {n} months
            </button>
          ))}
        </div>
        <span style={mutedText}>{loading ? 'Updating…' : data ? `Updated ${new Date(data.generatedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })} · test cases excluded` : ''}</span>
      </div>

      {err && <p role="alert" style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{err}</p>}
      {!m && !err && <p style={mutedText}>Loading the figures…</p>}

      {m && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <Tile label="Revenue this month" value={formatKobo(m.kpis.revenueThisMonthKobo)} sub={delta(m.kpis.revenueThisMonthKobo, m.kpis.revenueLastMonthKobo, formatKobo)} />
            <Tile label="Matters paid this month" value={String(m.kpis.paidThisMonth)} sub={delta(m.kpis.paidThisMonth, m.kpis.paidLastMonth, String)} />
            <Tile label={`Recovered for clients (${months} mo)`} value={formatKobo(m.kpis.recoveredWindowKobo)} sub={`${formatKobo(m.kpis.recoveredAllTimeKobo)} all time`} />
            <Tile
              label="Owed to the firm"
              value={formatKobo(m.kpis.outstandingKobo)}
              sub={m.kpis.overdueCount ? `${formatKobo(m.kpis.overdueKobo)} overdue on ${m.kpis.overdueCount} invoice${m.kpis.overdueCount === 1 ? '' : 's'}` : 'Nothing overdue'}
              subTone={m.kpis.overdueCount ? 'danger' : undefined}
            />
            <Tile
              label="AI cost per paid matter"
              value={usd(m.kpis.aiCostPerPaidMatterUsd)}
              sub={m.kpis.aiCostPerPaidMatterUsd == null ? 'Shows once a paid matter has AI usage logged' : inNaira(m.kpis.aiCostPerPaidMatterUsd).replace(/^ · /, '') || 'Add a naira rate in Settings for ₦'}
            />
            <Tile
              label={`Saved by prompt caching (${months} mo)`}
              value={usd(m.kpis.cacheSavingsUsd)}
              sub={`${m.kpis.cacheHitRate != null ? `${Math.round(m.kpis.cacheHitRate * 100)}% of prompt tokens from cache · ` : ''}AI spend ${usd(m.kpis.aiCostWindowUsd)}${inNaira(m.kpis.aiCostWindowUsd)}`}
            />
          </div>

          <RevenueChart months={m.months} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <Funnel stages={m.funnel} />
            <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
              <SmallTable
                title={`Where paid matters came from (${months} mo)`}
                empty="No paid matters in this period."
                head={['Source', 'Paid', 'Fees']}
                rows={m.sources.map((s) => [s.source, String(s.paidMatters), formatKobo(s.revenueKobo)])}
              />
              <SmallTable
                title={`AI cost by feature (${months} mo)`}
                empty="No AI usage logged yet. Logging starts with this release."
                head={['Feature', 'Calls', 'Cost']}
                rows={m.aiByRoute.map((r) => [AI_ROUTE_LABEL[r.route] ?? r.route, r.calls.toLocaleString('en-NG'), `${usd(r.costUsd)}${inNaira(r.costUsd)}`])}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function delta(now: number, before: number, fmt: (n: number) => string): string {
  if (now === before) return `Same as last month (${fmt(before)})`
  const diff = now - before
  return `${diff > 0 ? '▲' : '▼'} ${fmt(Math.abs(diff))} vs last month`
}

function Tile({ label, value, sub, subTone }: { label: string; value: string; sub?: string; subTone?: 'danger' }) {
  return (
    <div className="card" style={{ padding: '14px 16px', display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 650, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: subTone === 'danger' ? 'var(--danger)' : 'var(--text-2)' }}>{sub}</span>}
    </div>
  )
}

// Round the axis maximum up to 1, 2, 2.5 or 5 x 10^n so the ticks read as clean numbers.
function niceMax(max: number): number {
  if (max <= 0) return 100_000 * 100 // ₦100K empty-state scale, in kobo
  const exp = Math.pow(10, Math.floor(Math.log10(max)))
  for (const step of [1, 2, 2.5, 5, 10]) if (step * exp >= max) return step * exp
  return 10 * exp
}

// Bar with only its top corners rounded (data end), square at the baseline.
function topRoundedBar(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

function RevenueChart({ months }: { months: Metrics['months'] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [showTable])

  const height = 220
  const pad = { top: 12, right: 8, bottom: 28, left: 52 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const yMax = niceMax(Math.max(...months.map((mo) => mo.revenueKobo)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax)
  const band = plotW / months.length
  const barW = Math.min(24, band * 0.6)
  const y = (v: number) => pad.top + plotH - (v / yMax) * plotH
  const GAP = 2
  const labelEvery = months.length > 8 && width < 520 ? 2 : 1
  const total = months.reduce((s, mo) => s + mo.revenueKobo, 0)

  return (
    <div className="card" style={{ padding: '16px 18px', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Revenue by month</h3>
          <span style={mutedText}>{formatKobo(total)} over {months.length} months · money received, not invoiced</span>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Legend color={SERIES.fees} label="Fixed fees" />
          <Legend color={SERIES.invoices} label="Invoice payments" />
          <button type="button" className="btn btn-sm" aria-pressed={showTable} onClick={() => setShowTable((s) => !s)}>{showTable ? 'Show chart' : 'Show table'}</button>
        </div>
      </div>

      {showTable ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr style={{ color: 'var(--text-3)', textAlign: 'right' }}><th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600 }}>Month</th><th style={{ fontWeight: 600 }}>Fixed fees</th><th style={{ fontWeight: 600 }}>Invoice payments</th><th style={{ fontWeight: 600 }}>Total</th><th style={{ fontWeight: 600 }}>Matters paid</th></tr></thead>
            <tbody>
              {months.map((mo) => (
                <tr key={mo.key} style={{ borderTop: '1px solid var(--border-subtle)', textAlign: 'right' }}>
                  <td style={{ textAlign: 'left', padding: '7px 0' }}>{mo.label}</td>
                  <td>{formatKobo(mo.feesKobo)}</td>
                  <td>{formatKobo(mo.invoiceKobo)}</td>
                  <td style={{ fontWeight: 600 }}>{formatKobo(mo.revenueKobo)}</td>
                  <td>{mo.paidMatters}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrapRef} style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
          <svg width={width} height={height} role="img" aria-label={`Revenue by month, ${months.map((mo) => `${mo.label} ${formatKobo(mo.revenueKobo)}`).join(', ')}`} style={{ display: 'block', maxWidth: '100%' }}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" strokeWidth={t === 0 ? 1 : 0.5} />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>{compactNaira(t)}</text>
              </g>
            ))}
            {months.map((mo, i) => {
              const cx = pad.left + band * i + band / 2
              const x = cx - barW / 2
              const feesTop = y(mo.feesKobo)
              const feesH = y(0) - feesTop
              const invH = y(0) - y(mo.invoiceKobo)
              const invBottom = feesH > 0 ? feesTop - GAP : y(0)
              const dim = hover != null && hover !== i
              return (
                <g key={mo.key} opacity={dim ? 0.45 : 1} style={{ transition: 'opacity 120ms' }}>
                  {feesH > 0 && (invH > 0 ? <rect x={x} y={feesTop} width={barW} height={feesH} fill={SERIES.fees} /> : <path d={topRoundedBar(x, feesTop, barW, feesH, 4)} fill={SERIES.fees} />)}
                  {invH > 0 && <path d={topRoundedBar(x, invBottom - invH, barW, invH, 4)} fill={SERIES.invoices} />}
                  {i % labelEvery === 0 && (
                    <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--text-3)">{mo.label.split(' ')[0]}{i === 0 || mo.key.endsWith('-01') ? ` ’${mo.key.slice(2, 4)}` : ''}</text>
                  )}
                  {/* Hit target: the whole month column, far larger than the bar. */}
                  <rect x={pad.left + band * i} y={pad.top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${mo.label}: ${formatKobo(mo.revenueKobo)}`} style={{ outline: 'none', cursor: 'default' }} />
                </g>
              )
            })}
          </svg>
          {hover != null && (
            <Tooltip
              left={Math.min(Math.max(pad.left + band * hover + band / 2, 90), width - 90)}
              top={Math.max(0, y(months[hover].revenueKobo) - 12)}
              month={months[hover]}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Tooltip({ left, top, month }: { left: number; top: number; month: Metrics['months'][number] }) {
  return (
    <div
      role="status"
      style={{
        position: 'absolute', left, top, transform: 'translate(-50%, -100%)', pointerEvents: 'none',
        background: 'var(--bg-0, #fff)', border: '1px solid var(--border-subtle)', borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', padding: '8px 10px', fontSize: 12, minWidth: 170, display: 'grid', gap: 4,
      }}
    >
      <strong style={{ color: 'var(--text-1)' }}>{month.label}</strong>
      <Row color={SERIES.invoices} label="Invoice payments" value={formatKobo(month.invoiceKobo)} />
      <Row color={SERIES.fees} label="Fixed fees" value={formatKobo(month.feesKobo)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 4, color: 'var(--text-1)', fontWeight: 600 }}>
        <span>Total</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatKobo(month.revenueKobo)}</span>
      </div>
      <span style={{ color: 'var(--text-3)' }}>{month.paidMatters} matter{month.paidMatters === 1 ? '' : 's'} paid · {month.startedMatters} started</span>
    </div>
  )
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-2)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{value}</span>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      {label}
    </span>
  )
}

// Matters by the furthest stage they reached. One hue: this is magnitude, not identity.
function Funnel({ stages }: { stages: Metrics['funnel'] }) {
  const top = Math.max(1, stages[0]?.count ?? 0)
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'grid', gap: 10, alignContent: 'start' }}>
      <div style={{ display: 'grid', gap: 2 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Matters by stage reached</h3>
        <span style={mutedText}>All matters to date. Each bar counts matters that got at least that far.</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].count : null
          const pct = Math.round((s.count / top) * 100)
          return (
            <div key={s.label} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr) 84px', gap: 10, alignItems: 'center', fontSize: 13 }} title={`${s.label}: ${s.count}`}>
              <span style={{ color: 'var(--text-2)' }}>{s.label}</span>
              <div style={{ height: 14, background: 'var(--bg-1)', borderRadius: 4 }}>
                <div style={{ width: `${Math.max(s.count ? 2 : 0, pct)}%`, height: '100%', background: SERIES.fees, borderRadius: '0 4px 4px 0' }} />
              </div>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>
                {s.count}
                {prev ? <span style={{ color: 'var(--text-3)', fontSize: 11 }}> · {Math.round((s.count / prev) * 100)}%</span> : null}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SmallTable({ title, head, rows, empty }: { title: string; head: string[]; rows: string[][]; empty: string }) {
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'grid', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
      {rows.length === 0 ? (
        <p style={mutedText}>{empty}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--text-3)' }}>
              {head.map((h, i) => <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', fontWeight: 600, padding: '4px 0' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {r.map((c, i) => <td key={i} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 0', fontVariantNumeric: i ? 'tabular-nums' : undefined }}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
