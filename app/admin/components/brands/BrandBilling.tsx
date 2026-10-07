'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { formatKobo } from '@/lib/money'
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from '@/lib/invoices'

interface Summary {
  unbilled: number
  unbilledKobo: number
  oldestUnbilledAt: string | null
  invoices: { id: string; invoice_number: string; matter: string | null; status: InvoiceStatus; total_kobo: number; issue_date: string }[]
}

/** This month in Lagos, as "2026-10". */
function lagosMonth(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 7)
}

function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// Monthly billing for one brand (lib/brandBilling.ts): approved letters not yet billed become a
// draft invoice in Finance → Invoices, one line per letter, and are never billed again.
export default function BrandBilling({ brandId }: { brandId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [month, setMonth] = useState(lagosMonth())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    const res = await authedFetch(`/api/admin/brands/billing?brandId=${encodeURIComponent(brandId)}`)
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'Could not load billing.')
    setSummary(data)
  }

  useEffect(() => {
    load().catch(() => setError('Network error while loading billing.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId])

  async function createInvoice() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authedFetch('/api/admin/brands/billing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandId, month }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Could not create the invoice.')
      setNotice(`Draft invoice ${data.invoice.invoice_number} created with ${data.letters} letter${data.letters === 1 ? '' : 's'}. Check it and send it from Finance → Invoices.`)
      await load()
    } catch {
      setError('Network error. Check Finance → Invoices before trying again.')
    } finally {
      setBusy(false)
    }
  }

  if (!summary) return error ? <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p> : null

  return (
    <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
      <div style={{ color: 'var(--text-2)' }}>
        {summary.unbilled === 0 ? (
          'Every approved letter has been billed.'
        ) : (
          <>
            <strong style={{ color: 'var(--text-1)' }}>
              {summary.unbilled} approved letter{summary.unbilled === 1 ? '' : 's'} not yet billed
            </strong>{' '}
            ({formatKobo(summary.unbilledKobo)} before VAT). Letters with missing documents are never billed.
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Month
          <input type="month" className="input" value={month} max={lagosMonth()} onChange={(e) => setMonth(e.target.value)} style={{ minHeight: 34, fontSize: 13 }} />
        </label>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || summary.unbilled === 0 || !month} onClick={createInvoice}>
          {busy ? 'Creating…' : `Create invoice for ${month ? monthName(month) : '…'}`}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Includes every approved, unbilled letter up to the end of that month.</div>

      {notice && <div style={{ color: '#16a34a' }}>{notice}</div>}
      {error && <div role="alert" style={{ color: 'var(--danger)' }}>{error}</div>}

      {summary.invoices.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-2)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '6px 8px' }}>Invoice</th>
              <th style={{ padding: '6px 8px' }}>For</th>
              <th style={{ padding: '6px 8px' }}>Status</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {summary.invoices.map((i) => (
              <tr key={i.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)' }}>{i.invoice_number}</td>
                <td style={{ padding: '6px 8px' }}>{i.matter}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span className="badge">{INVOICE_STATUS_LABEL[i.status]}</span>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatKobo(i.total_kobo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <a href="/admin?section=finance&sub=invoices" style={{ fontSize: 12 }}>
        Open Finance → Invoices
      </a>
    </div>
  )
}
