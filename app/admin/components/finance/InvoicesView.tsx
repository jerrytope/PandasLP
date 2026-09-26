'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { INVOICE_STATUSES, INVOICE_STATUS_LABEL, balanceKobo, hasBankDetails, isOverdue, type BillingSettings, type InvoiceRow, type InvoiceStatus } from '@/lib/invoices'
import { formatKobo } from '@/lib/money'
import { lagosToday } from '@/lib/negotiationStatus'
import InvoiceDetail from './InvoiceDetail'
import InvoiceEditor, { type InvoiceDefaults } from './InvoiceEditor'
import { InvoiceStatusBadge, longDate, mutedText } from './shared'

type Filter = 'all' | 'unpaid' | 'overdue' | InvoiceStatus

// Invoice list with create and open. Used firm-wide in Finance and, with `caseId`, inside a
// case so a lawyer can bill the matter they are looking at without leaving it.
export default function InvoicesView({
  settings,
  caseId,
  defaults,
  compact,
}: {
  settings: BillingSettings | null
  caseId?: string
  defaults?: InvoiceDefaults
  compact?: boolean
}) {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null)
  const [filter, setFilter] = useState<Filter>(caseId ? 'all' : 'unpaid')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')
  const today = lagosToday()

  async function load() {
    setErr('')
    try {
      const res = await authedFetch(`/api/admin/invoices${caseId ? `?caseId=${encodeURIComponent(caseId)}` : ''}`)
      const data = await res.json()
      if (!res.ok || data.error) return setErr(data.error || 'Could not load invoices.')
      setInvoices(data.invoices)
    } catch {
      setErr('Network error while loading invoices.')
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  function upsert(inv: InvoiceRow) {
    setInvoices((prev) => {
      const list = prev ?? []
      return list.some((i) => i.id === inv.id) ? list.map((i) => (i.id === inv.id ? inv : i)) : [inv, ...list]
    })
  }

  const list = (invoices ?? []).filter((i) => {
    if (filter === 'all') return true
    if (filter === 'unpaid') return i.status === 'draft' || i.status === 'sent' || i.status === 'part_paid'
    if (filter === 'overdue') return isOverdue(i, today)
    return i.status === filter
  })
  const owing = (invoices ?? []).filter((i) => i.status === 'sent' || i.status === 'part_paid').reduce((s, i) => s + balanceKobo(i), 0)

  if (creating) {
    return (
      <InvoiceEditor
        defaults={{ caseId: caseId ?? null, ...defaults }}
        settings={settings}
        onCancel={() => setCreating(false)}
        onSaved={(inv) => {
          upsert(inv)
          setCreating(false)
          setOpenId(inv.id)
        }}
      />
    )
  }
  if (openId) {
    return <InvoiceDetail invoiceId={openId} settings={settings} onChanged={upsert} onClose={() => setOpenId(null)} />
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {settings && !hasBankDetails(settings) && (
        <p style={{ ...mutedText, color: 'var(--warning)', fontSize: 13 }}>Add the firm&rsquo;s bank details in Finance → Settings before sending invoices.</p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!compact && (
            <select id="inv-filter" className="input" aria-label="Filter invoices" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={{ fontSize: 13, width: 'auto' }}>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
              <option value="all">All</option>
              {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</option>)}
            </select>
          )}
          {owing > 0 && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{formatKobo(owing)} owed to the firm{caseId ? ' on this matter' : ''}</span>}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>New invoice</button>
      </div>

      {err && <p role="alert" style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{err}</p>}
      {invoices === null && !err && <p style={mutedText}>Loading invoices…</p>}
      {invoices !== null && list.length === 0 && (
        <p style={{ ...mutedText, fontSize: 13 }}>{invoices.length === 0 ? (caseId ? 'No invoices for this matter yet.' : 'No invoices yet. Create the first one.') : 'No invoices match this filter.'}</p>
      )}

      {list.length > 0 && (
        <div className={compact ? undefined : 'card'} style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-3)' }}>
                <th style={th}>Invoice</th>
                {!caseId && <th style={th}>Client</th>}
                <th style={th}>Due</th>
                <th style={{ ...th, textAlign: 'right' }}>Total</th>
                <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const overdue = isOverdue(i, today)
                return (
                  <tr key={i.id} onClick={() => setOpenId(i.id)} style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                    <td style={td}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setOpenId(i.id) }} style={{ all: 'unset', cursor: 'pointer', fontWeight: 600 }}>{i.invoice_number}</button>
                    </td>
                    {!caseId && <td style={td}>{i.client_name}</td>}
                    <td style={{ ...td, color: overdue ? 'var(--danger)' : undefined }}>{i.due_date ? longDate(i.due_date) : 'On receipt'}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKobo(i.total_kobo)}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i.status === 'void' ? '—' : formatKobo(balanceKobo(i))}</td>
                    <td style={td}><InvoiceStatusBadge status={i.status} overdue={overdue} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap' }
