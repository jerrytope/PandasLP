'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { NEGOTIATION_STATUS_LABEL, isNegotiationStatus } from '@/lib/negotiationStatus'
import type { AdminCaseRow } from './types'
import { Handshake } from 'lucide-react'

type FollowUp = {
  id: string
  caseId: string
  caseTitle: string | null
  caseNumber: number | null
  status: string | null
  nextAction: string
  nextActionDue: string
  overdue: boolean
  dueToday: boolean
}

function formatDue(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// Negotiation next actions that are overdue, due today, or due within a week, across every
// case — so a promised undertaking or a reply deadline can't slip by unnoticed. Data comes
// from app/api/admin/negotiations/due/route.ts; actions are set and closed in
// components/NegotiationPanel.tsx.
export default function NegotiationFollowUps({
  cases,
  onOpenDrawer,
}: {
  cases: AdminCaseRow[]
  onOpenDrawer: (c: AdminCaseRow) => void
}) {
  const [items, setItems] = useState<FollowUp[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authedFetch('/api/admin/negotiations/due')
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || data.error) {
          setError(data.error || 'Could not load negotiation follow-ups.')
          return
        }
        setItems(data.items || [])
      } catch {
        if (!cancelled) setError('Network error while loading negotiation follow-ups.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const urgent = (items || []).filter((i) => i.overdue || i.dueToday).length

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
          <Handshake size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
          <span>Negotiation follow-ups</span>
          <span
            className="badge"
            style={{
              background: urgent > 0 ? 'rgba(var(--danger-rgb),  0.12)' : 'var(--bg-1)',
              color: urgent > 0 ? 'var(--danger)' : 'var(--text-3)',
            }}
          >
            {items ? items.length : '…'}
          </span>
        </h2>
      </div>

      {error ? (
        <div className="card" style={{ padding: '14px 18px', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      ) : items === null ? (
        <div className="card" style={{ padding: '14px 18px', color: 'var(--text-3)', fontSize: 13 }}>Loading follow-ups…</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: '14px 18px', color: 'var(--text-3)', fontSize: 13 }}>
          Nothing due in the next 7 days. Set a next action and due date when you log a negotiation round to track it here.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {items.map((i, idx) => {
            const c = cases.find((x) => x.id === i.caseId)
            const color = i.overdue ? 'var(--danger)' : i.dueToday ? 'var(--warning)' : 'var(--text-2)'
            return (
              <div
                key={i.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border-subtle)',
                  borderLeft: `3px solid ${i.overdue ? 'var(--danger)' : i.dueToday ? 'var(--warning)' : 'transparent'}`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                    {i.caseNumber != null ? `#${i.caseNumber} ` : ''}
                    {i.caseTitle || 'Untitled case'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>{i.nextAction}</div>
                  <div style={{ fontSize: 12, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color, fontWeight: i.overdue || i.dueToday ? 600 : 400 }}>
                      {i.overdue ? `Overdue since ${formatDue(i.nextActionDue)}` : i.dueToday ? 'Due today' : `Due ${formatDue(i.nextActionDue)}`}
                    </span>
                    {isNegotiationStatus(i.status) && <span style={{ color: 'var(--text-3)' }}>{NEGOTIATION_STATUS_LABEL[i.status]}</span>}
                  </div>
                </div>
                {c && (
                  <button type="button" className="btn btn-sm" onClick={() => onOpenDrawer(c)}>
                    Open case
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
