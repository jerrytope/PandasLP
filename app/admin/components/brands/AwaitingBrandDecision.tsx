'use client'

import { useEffect, useState } from 'react'
import { Scale } from 'lucide-react'
import { authedFetch } from '@/lib/supabaseClient'
import { formatShortDate, type AdminCaseRow } from '../types'

interface AwaitingRow {
  id: string
  case_ref: string
  case_id: string | null
  borrower: Record<string, string> | null
  awaiting_brand_decision_at: string | null
  brands: { name: string } | null
}

// Action Queue: brand borrowers past Day 14, waiting for the brand to say whether to go to
// court. Each opens its matter, where the brand's written approval is recorded.
export default function AwaitingBrandDecision({ cases, onOpenDrawer }: { cases: AdminCaseRow[]; onOpenDrawer: (c: AdminCaseRow) => void }) {
  const [rows, setRows] = useState<AwaitingRow[]>([])

  useEffect(() => {
    authedFetch('/api/admin/brands/cases?awaiting=1')
      .then((res) => (res.ok ? res.json() : { cases: [] }))
      .then((data) => setRows(data.cases ?? []))
      .catch(() => setRows([]))
  }, [])

  if (rows.length === 0) return null

  return (
    <section>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: 'var(--text-1)' }}>
        <Scale size={16} strokeWidth={2} style={{ color: 'var(--warning)' }} aria-hidden="true" />
        Awaiting brand decision
        <span className="badge">{rows.length}</span>
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 10px' }}>
        Past Day 14 with no payment. Ask the brand whether to go to court; nothing is filed without their written approval.
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map((r) => {
          const matter = cases.find((c) => c.id === r.case_id)
          return (
            <button
              key={r.id}
              type="button"
              className="card"
              disabled={!matter}
              onClick={() => matter && onOpenDrawer(matter)}
              style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', textAlign: 'left', fontSize: 13, cursor: matter ? 'pointer' : 'default' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)' }}>{r.case_ref}</span>
              <span style={{ flex: 1 }}>
                {r.borrower?.['Borrower Full Name'] ?? ''} · {r.brands?.name ?? ''}
              </span>
              <span style={{ color: 'var(--text-3)' }}>since {formatShortDate(r.awaiting_brand_decision_at)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
