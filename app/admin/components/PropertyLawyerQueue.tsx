'use client'

import { useCallback, useEffect, useState } from 'react'
import { Gavel } from 'lucide-react'
import { authedFetch } from '@/lib/supabaseClient'
import { formatShortDate, type AdminCaseRow } from './types'

interface QueueRow {
  caseId: string
  area: string | null
  state: string | null
  status: string
  reason: string | null
  flaggedAt: string
  documentTitle: string | null
  clientEmail: string | null
}

type Action = 'take' | 'return_to_agent' | 'close'

const ACTION_LABEL: Record<Action, string> = {
  take: "I'll handle it",
  return_to_agent: 'Back to the agent',
  close: 'Close matter',
}

// Action Queue: Property Law Agent matters that need a lawyer — escalated by the agent, or a
// document nothing is paid for online (a transfer deed the firm invoices, a will, a dispute
// brief...). Each row opens its matter; the buttons take it out of the queue.
export default function PropertyLawyerQueue({ cases, onOpenDrawer }: { cases: AdminCaseRow[]; onOpenDrawer: (c: AdminCaseRow) => void }) {
  const [rows, setRows] = useState<QueueRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    authedFetch('/api/admin/property-matters')
      .then((res) => (res.ok ? res.json() : { matters: [] }))
      .then((data) => setRows(data.matters ?? []))
      .catch(() => setRows([]))
  }, [])

  useEffect(load, [load])

  async function act(caseId: string, action: Action) {
    setBusy(caseId)
    setError('')
    try {
      const res = await authedFetch('/api/admin/property-matters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error ?? 'Could not update the matter.')
      else load()
    } finally {
      setBusy(null)
    }
  }

  if (rows.length === 0) return null

  return (
    <section>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: 'var(--text-1)' }}>
        <Gavel size={16} strokeWidth={2} style={{ color: 'var(--warning)' }} aria-hidden="true" />
        Property matters needing a lawyer
        <span className="badge">{rows.length}</span>
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 10px' }}>
        Escalated by the Property Law Agent, or a document the firm must take forward (nothing is paid for it online).
      </p>
      {error && <p role="alert" style={{ fontSize: 13, color: 'var(--danger)', margin: '0 0 8px' }}>{error}</p>}
      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map((r) => {
          const matter = cases.find((c) => c.id === r.caseId)
          return (
            <div key={r.caseId} className="card" style={{ padding: '10px 14px', fontSize: 13, display: 'grid', gap: 8 }}>
              <button
                type="button"
                disabled={!matter}
                onClick={() => matter && onOpenDrawer(matter)}
                style={{ all: 'unset', cursor: matter ? 'pointer' : 'default', display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}
              >
                <strong>{r.area ?? 'Not routed'}</strong>
                <span style={{ color: 'var(--text-2)' }}>{r.state ?? ''}</span>
                <span style={{ flex: 1 }}>{r.documentTitle ?? r.clientEmail ?? ''}</span>
                <span style={{ color: 'var(--text-3)' }}>since {formatShortDate(r.flaggedAt)}</span>
              </button>
              {r.reason && <div style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>{r.reason}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(ACTION_LABEL) as Action[]).map((a) => (
                  <button key={a} type="button" className="btn btn-outline btn-sm" disabled={busy === r.caseId} onClick={() => act(r.caseId, a)}>
                    {ACTION_LABEL[a]}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
