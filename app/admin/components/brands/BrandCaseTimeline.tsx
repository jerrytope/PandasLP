'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, AlertTriangle } from 'lucide-react'
import { authedFetch } from '@/lib/supabaseClient'
import { BRAND_CASE_STATUS_LABELS, type BrandCaseStatus } from '@/lib/brandSheet'
import { formatDate } from '../types'

interface BrandCaseInfo {
  case_ref: string
  status: BrandCaseStatus
  borrower: Record<string, string> | null
  letter_url: string | null
  last_error: string | null
  served_at: string | null
  day7_sent_at: string | null
  day14_sent_at: string | null
  awaiting_brand_decision_at: string | null
  billable_at: string | null
  brands: { name: string; code: string } | null
}

interface EventRow {
  id: string
  event_type: string
  detail: Record<string, unknown>
  actor: string
  created_at: string
}

/** Plain-English line for each audit event (lib/brandSync.ts, lib/brandServing.ts). */
function describe(e: EventRow): string {
  const d = e.detail ?? {}
  switch (e.event_type) {
    case 'case_created':
      return `Case ID given to the row the brand added (row ${d.row ?? '?'})`
    case 'status_changed':
      return `Status: ${label(d.from)} → ${label(d.to)}`
    case 'missing_documents':
      return `Missing documents: ${Array.isArray(d.missing) ? d.missing.join('; ') : ''}`
    case 'resubmitted':
      return 'The brand corrected the row; checking again'
    case 'letter_drafted':
      return `Letter drafted: ${d.title ?? ''}`
    case 'draft_failed':
      return `Drafting failed: ${d.error ?? ''}`
    case 'stale_claim_reset':
      return 'A sync stopped part-way; the row went back to New'
    case 'retry_requested':
      return 'Retry requested'
    case 'lawyer_approved':
      return `Approved by ${d.reviewer ?? e.actor}; the letter is now billable`
    case 'final_letter_saved':
      return 'FINAL letter saved to the brand’s Letters folder'
    case 'served':
      return d.method === 'email' ? `Served by email to ${d.to ?? 'the borrower'} (brand copied)` : 'Marked served by staff'
    case 'serve_failed':
      return `Serving failed, nothing was sent: ${d.error ?? ''}`
    case 'day7_reminder':
      return `Day 7 reminder emailed to ${d.to ?? 'the borrower'}`
    case 'day14_reminder':
      return `Day 14 reminder emailed to ${d.to ?? 'the borrower'}`
    case 'reminder_failed':
      return `${d.kind === 'day14' ? 'Day 14' : 'Day 7'} reminder failed, will retry: ${d.error ?? ''}`
    case 'awaiting_brand_decision':
      return 'Response period over: waiting for the brand’s decision'
    default:
      return e.event_type
  }
}

function label(status: unknown): string {
  return typeof status === 'string' && status in BRAND_CASE_STATUS_LABELS ? BRAND_CASE_STATUS_LABELS[status as BrandCaseStatus] : String(status)
}

export default function BrandCaseTimeline({ caseId }: { caseId: string }) {
  const [info, setInfo] = useState<BrandCaseInfo | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    authedFetch(`/api/admin/brands/cases?caseId=${encodeURIComponent(caseId)}`)
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) return setError(data.error || 'Could not load the borrower’s history.')
        setInfo(data.brandCase)
        setEvents(data.events)
      })
      .catch(() => !cancelled && setError('Network error while loading the borrower’s history.'))
    return () => {
      cancelled = true
    }
  }, [caseId])

  if (error) return <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>
  if (!info) return null

  const dates: [string, string | null][] = [
    ['Served', info.served_at],
    ['Day 7 reminder', info.day7_sent_at],
    ['Day 14 reminder', info.day14_sent_at],
  ]

  return (
    <div className="card" style={{ padding: '16px 18px', background: 'var(--bg-2)', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>
          Brand borrower · {info.brands?.name ?? ''} · <span style={{ fontFamily: 'var(--font-mono)' }}>{info.case_ref}</span>
        </div>
        <span className="badge">{label(info.status)}</span>
      </div>

      {info.awaiting_brand_decision_at && (
        <div style={{ fontSize: 13, color: 'var(--warning)', display: 'flex', gap: 6 }}>
          <AlertTriangle size={14} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          Awaiting the brand’s decision since {formatDate(info.awaiting_brand_decision_at)}. Nothing goes to court without their written approval.
        </div>
      )}
      {info.last_error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{info.last_error}</div>}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-2)' }}>
        {dates.map(([name, at]) => (
          <span key={name}>
            {name}: <strong style={{ color: 'var(--text-1)' }}>{at ? formatDate(at) : '—'}</strong>
          </span>
        ))}
        {info.letter_url && (
          <a href={info.letter_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Letter in the brand’s Drive <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>

      {events.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, fontSize: 12.5, color: 'var(--text-2)' }}>
          {events.map((e) => (
            <li key={e.id}>
              <span style={{ color: 'var(--text-3)' }}>{formatDate(e.created_at)}</span> · {describe(e)}
              {e.actor !== 'system' && <span style={{ color: 'var(--text-3)' }}> ({e.actor})</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
