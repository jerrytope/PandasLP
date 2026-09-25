'use client'

import { formatNaira } from '@/lib/formatNaira'
import { DAY_MS, type AdminCaseRow } from './types'
import { TrendingUp, Clock, AlertTriangle, Briefcase, DollarSign, ArrowUpRight } from 'lucide-react'

interface AdminStatsOverviewProps {
  cases: AdminCaseRow[]
  onSelectFilter?: (status: string) => void
}

export default function AdminStatsOverview({ cases, onSelectFilter }: AdminStatsOverviewProps) {
  const now = Date.now()
  const weekAgo = now - 7 * DAY_MS
  const twoWeeksAgo = now - 14 * DAY_MS

  const paidCases = cases.filter((c) => c.paid_at && !c.is_test)
  const paidThisWeek = paidCases.filter((c) => new Date(c.paid_at!).getTime() >= weekAgo)
  const paidLastWeek = paidCases.filter((c) => {
    const t = new Date(c.paid_at!).getTime()
    return t >= twoWeeksAgo && t < weekAgo
  })
  const revenueThisWeek = paidThisWeek.reduce((sum, c) => sum + (c.amount_paid || 0), 0)

  // Acquisition source breakdown
  const sourceCounts: Record<string, number> = {}
  for (const c of paidThisWeek) {
    const key = c.source || 'direct'
    sourceCounts[key] = (sourceCounts[key] || 0) + 1
  }

  // Urgent unserved cases
  const unserved = cases
    .filter((c) => c.status === 'paid' && !c.is_test)
    .sort((a, b) => new Date(a.paid_at ?? a.created_at).getTime() - new Date(b.paid_at ?? b.created_at).getTime())

  const oldestUnservedDays =
    unserved.length > 0 ? Math.floor((now - new Date(unserved[0].paid_at ?? unserved[0].created_at).getTime()) / DAY_MS) : null

  const activePipeline = cases.filter(
    (c) => ['paid', 'letter_served', 'filed', 'judgment_obtained'].includes(c.status) && !c.is_test,
  )

  const unreviewedCount = cases.filter((c) => c.status === 'paid' && !c.reviewed_at && !c.is_test).length
  const counterPendingCount = cases.filter((c) => c.negotiationStatus === 'awaiting_our_reply' && !c.is_test).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
      {/* Metric Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        {/* Paid this week */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderLeft: '3px solid var(--accent)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>New Paid This Week</span>
            <TrendingUp size={15} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>
              {paidThisWeek.length}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              vs {paidLastWeek.length} last week
            </div>
          </div>
        </div>

        {/* Revenue this week */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderLeft: '3px solid #16a34a',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Revenue This Week</span>
            <DollarSign size={15} strokeWidth={1.8} style={{ color: '#16a34a' }} />
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>
              {formatNaira(revenueThisWeek)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              From {paidThisWeek.length} verified transactions
            </div>
          </div>
        </div>

        {/* Active Matters in Pipeline */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderLeft: '3px solid #0284c7',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Active Pipeline</span>
            <Briefcase size={15} strokeWidth={1.8} style={{ color: '#0284c7' }} />
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>
              {activePipeline.length}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              Paid, served, or in court
            </div>
          </div>
        </div>

        {/* Oldest Unserved / SLA Tracker */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            borderLeft: `3px solid ${oldestUnservedDays !== null && oldestUnservedDays >= 3 ? 'var(--danger)' : 'var(--warning)'}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Oldest Unserved SLA</span>
            <Clock
              size={15}
              strokeWidth={1.8}
              style={{ color: oldestUnservedDays !== null && oldestUnservedDays >= 3 ? 'var(--danger)' : 'var(--warning)' }}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1.1,
                color: oldestUnservedDays !== null && oldestUnservedDays >= 3 ? 'var(--danger)' : 'inherit',
              }}
            >
              {oldestUnservedDays === null ? '0d' : `${oldestUnservedDays}d`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              {unserved.length} paid cases awaiting dispatch
            </div>
          </div>
        </div>

        {/* Source breakdown */}
        <div
          className="card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Acquisition Sources</span>
            <ArrowUpRight size={15} strokeWidth={1.8} style={{ color: 'var(--text-3)' }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.keys(sourceCounts).length === 0 ? (
              <span style={{ color: 'var(--text-3)' }}>No paid cases this week</span>
            ) : (
              Object.entries(sourceCounts).slice(0, 3).map(([src, count]) => (
                <div key={src} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>{src}:</span>
                  <strong style={{ color: 'var(--text-1)' }}>{count}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Actionable Urgent Alerts Strip */}
      {(unreviewedCount > 0 || counterPendingCount > 0) && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-1)',
            border: '1px solid var(--border-subtle)',
            fontSize: 13,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-1)' }}>
            <AlertTriangle size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
            Priority Legal Actions:
          </span>

          {unreviewedCount > 0 && (
            <button
              type="button"
              onClick={() => onSelectFilter?.('paid')}
              className="badge"
              style={{
                background: 'rgba(217, 119, 6, 0.12)',
                color: '#d97706',
                border: '1px solid rgba(217, 119, 6, 0.25)',
                cursor: 'pointer',
              }}
            >
              {unreviewedCount} case{unreviewedCount > 1 ? 's' : ''} awaiting lawyer review →
            </button>
          )}

          {counterPendingCount > 0 && (
            <span
              className="badge"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--danger)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              {counterPendingCount} debtor counter-offer{counterPendingCount > 1 ? 's' : ''} awaiting reply
            </span>
          )}
        </div>
      )}
    </div>
  )
}
