'use client'

// Served debt cases whose fourteen days have run out without payment: the queue that turns a
// lapsed demand into a filed claim (lib/readyToFile.ts). Each row shows what still blocks filing,
// and downloads the full registry bundle in one click.

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import type { Blocker } from '@/lib/readyToFile'
import type { AdminCaseRow } from './types'
import { Gavel, Download } from 'lucide-react'

interface Item {
  caseId: string
  caseNumber: number | null
  title: string | null
  state: string | null
  received: string
  firstFilingDay: string
  daysSinceLapse: number
  packDrafted: number
  packTotal: number
  signedReceived: boolean
  blockers: Blocker[]
}

export async function downloadFilingBundle(caseId: string, caseNumber: number | string | null): Promise<string | null> {
  const res = await authedFetch(`/api/admin/court-filing/bundle?caseId=${encodeURIComponent(caseId)}`)
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    return json.error || 'Could not build the bundle.'
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `filing-bundle-case-${caseNumber ?? 'case'}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return null
}

const when = (d: number, first: string) =>
  d < 0 ? `Can be filed from ${new Date(`${first}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : d === 0 ? 'Can be filed today' : `Overdue for filing by ${d} day${d === 1 ? '' : 's'}`

export default function ReadyToFile({ cases, onOpenDrawer }: { cases: AdminCaseRow[]; onOpenDrawer: (c: AdminCaseRow) => void }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    authedFetch('/api/admin/ready-to-file')
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.error) : setItems(j.items)))
      .catch(() => setError('Could not load the ready-to-file list.'))
  }, [])

  if (error) return <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>
  if (!items || items.length === 0) return null

  return (
    <section>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-1)' }}>
        <Gavel size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
        Ready to file ({items.length})
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 14px' }}>
        The fourteen days have run out with no payment. Debtors pay when the summons arrives, so clear what blocks each one and file.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => {
          const row = cases.find((c) => c.id === it.caseId)
          const late = it.daysSinceLapse > 0
          return (
            <div key={it.caseId} className="card" style={{ padding: '14px 16px', background: 'var(--bg-2)', borderLeft: `3px solid ${late ? 'var(--danger)' : 'var(--accent)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 14 }}>#{it.caseNumber} {it.title ?? 'Untitled case'}</strong>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: late ? 'var(--danger)' : 'var(--accent-deep)' }}>{when(it.daysSinceLapse, it.firstFilingDay)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4 }}>
                {it.state ? `${it.state[0].toUpperCase()}${it.state.slice(1)}` : 'State not chosen'} · pack {it.packDrafted} of {it.packTotal} drafted · {it.signedReceived ? 'signed forms received' : 'signed forms not received'}
              </div>
              {it.blockers.length > 0 ? (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--text-1)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {it.blockers.slice(0, 6).map((b) => <li key={b.key}>{b.label}</li>)}
                  {it.blockers.length > 6 && <li style={{ color: 'var(--text-3)' }}>and {it.blockers.length - 6} more</li>}
                </ul>
              ) : (
                <p style={{ margin: '8px 0 0', fontSize: 13, color: '#17683F', fontWeight: 600 }}>Nothing blocking: take the bundle to the registry.</p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {row && <button type="button" className="btn btn-sm" onClick={() => onOpenDrawer(row)}>Open the case</button>}
                {it.state && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy === it.caseId}
                    onClick={async () => {
                      setBusy(it.caseId)
                      const err = await downloadFilingBundle(it.caseId, it.caseNumber)
                      setBusy('')
                      if (err) setError(err)
                    }}
                  >
                    <Download size={13} aria-hidden="true" /> {busy === it.caseId ? 'Building…' : 'Download the filing bundle'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
