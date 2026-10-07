'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, AlertTriangle } from 'lucide-react'
import { authedFetch } from '@/lib/supabaseClient'
import { BRAND_CASE_STATUS_LABELS, type BrandCaseStatus } from '@/lib/brandSheet'

interface BorrowerRow {
  id: string
  case_ref: string
  status: BrandCaseStatus
  borrower: Record<string, string> | null
  missing_items: string[]
  letter_url: string | null
  last_error: string | null
  attempts: number
  awaiting_brand_decision_at: string | null
  updated_at: string
}

interface FlagRow {
  id: string
  kind: string
  case_ref: string | null
  column_name: string | null
  old_value: string | null
  new_value: string | null
}

const FLAG_TEXT: Record<string, string> = {
  unknown_case_id: 'has a Case ID the app never issued (typed in by hand?) — not processed',
  duplicate_case_id: 'appears on more than one row — not processed until only one is left',
  edited_after_processing: 'was edited after we started on it. Nothing was done with the change, and the brand has been asked to use Notes.',
  row_missing: 'is no longer in the sheet. The borrower’s record is kept.',
}

const MAX_ATTEMPTS = 3

// The borrowers of one brand, as the database (the source of truth) has them.
export default function BrandBorrowers({ brandId }: { brandId: string }) {
  const [cases, setCases] = useState<BorrowerRow[] | null>(null)
  const [flags, setFlags] = useState<FlagRow[]>([])
  const [error, setError] = useState('')

  async function load() {
    const res = await authedFetch(`/api/admin/brands/cases?brandId=${encodeURIComponent(brandId)}`)
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'Failed to load borrowers.')
    setCases(data.cases)
    setFlags(data.flags)
  }

  useEffect(() => {
    load().catch(() => setError('Network error while loading borrowers.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId])

  async function retry(brandCaseId: string) {
    const res = await authedFetch('/api/admin/brands/cases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ brandCaseId, action: 'retry' }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Could not retry.')
    await load()
  }

  if (error) return <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>
  if (!cases) return <p style={{ color: 'var(--text-2)', fontSize: 13, margin: 0 }}>Loading borrowers…</p>

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {flags.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase' }}>Needs attention</div>
          {flags.map((f) => (
            <FlagItem key={f.id} flag={f} onResolved={load} />
          ))}
        </div>
      )}

      {cases.length === 0 ? (
        <p style={{ color: 'var(--text-2)', fontSize: 13, margin: 0 }}>
          No borrowers yet. Rows the brand adds to its sheet appear here after the next sync.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '6px 8px' }}>Case ID</th>
                <th style={{ padding: '6px 8px' }}>Borrower</th>
                <th style={{ padding: '6px 8px' }}>Outstanding</th>
                <th style={{ padding: '6px 8px' }}>Status</th>
                <th style={{ padding: '6px 8px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{c.case_ref}</td>
                  <td style={{ padding: '8px' }}>{c.borrower?.['Borrower Full Name'] || <span style={{ color: 'var(--text-3)' }}>not checked yet</span>}</td>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{c.borrower?.['Amount Outstanding'] || '—'}</td>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                    <span className="badge">{BRAND_CASE_STATUS_LABELS[c.status]}</span>
                  </td>
                  <td style={{ padding: '8px' }}>
                    {c.letter_url && (
                      <a href={c.letter_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Letter <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    )}
                    {c.awaiting_brand_decision_at && c.status === 'day14_sent' && (
                      <div style={{ color: 'var(--warning)', fontWeight: 600 }}>Awaiting the brand’s decision</div>
                    )}
                    {c.status === 'missing_documents' && c.missing_items.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-2)' }}>
                        {c.missing_items.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    )}
                    {c.last_error && (
                      <div style={{ color: 'var(--danger)' }}>
                        {c.last_error}
                        {c.status === 'new' && c.attempts >= MAX_ATTEMPTS && (
                          <>
                            {' '}— stopped after {MAX_ATTEMPTS} attempts.{' '}
                            <button type="button" className="btn btn-sm" onClick={() => retry(c.id)}>Retry</button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// One flag, and the staff decision on it (with a note). See resolveFlag in lib/brandExceptions.ts.
function FlagItem({ flag, onResolved }: { flag: FlagRow; onResolved: () => Promise<void> }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const edited = flag.kind === 'edited_after_processing'
  const resolvable = edited || flag.kind === 'row_missing'
  const show = (v: string | null) => (v ? `“${v}”` : '(empty)')

  async function decide(decision: 'accept' | 'keep' | 'noted') {
    setBusy(true)
    setError('')
    try {
      const res = await authedFetch('/api/admin/brands/cases', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_flag', flagId: flag.id, decision, note }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Could not resolve.')
      await onResolved()
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ fontSize: 13, display: 'grid', gap: 6, padding: '8px 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ color: 'var(--danger)', display: 'flex', gap: 6 }}>
        <AlertTriangle size={14} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
        <span>
          <strong>{flag.case_ref}</strong> {FLAG_TEXT[flag.kind] ?? flag.kind}
          {!edited && flag.new_value ? ` (${flag.new_value})` : ''}
        </span>
      </div>
      {edited && (
        <div style={{ color: 'var(--text-2)' }}>
          {flag.column_name}: {show(flag.old_value)} → <strong style={{ color: 'var(--text-1)' }}>{show(flag.new_value)}</strong>
        </div>
      )}
      {resolvable && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Note: what was decided, and why"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ flex: '1 1 220px', fontSize: 12, minHeight: 32, padding: '4px 10px' }}
            aria-label={`Note on ${flag.case_ref}`}
          />
          {edited ? (
            <>
              <button type="button" className="btn btn-sm" disabled={busy || note.trim().length < 3} onClick={() => decide('accept')} title="The new value becomes the record (e.g. reminders go to a corrected email)">
                Accept new value
              </button>
              <button type="button" className="btn btn-sm" disabled={busy || note.trim().length < 3} onClick={() => decide('keep')}>
                Keep original
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-sm" disabled={busy || note.trim().length < 3} onClick={() => decide('noted')}>
              Mark resolved
            </button>
          )}
        </div>
      )}
      {error && <div role="alert" style={{ color: 'var(--danger)' }}>{error}</div>}
    </div>
  )
}
