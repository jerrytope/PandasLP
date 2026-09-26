'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { buildInvoicePdf } from '@/lib/pdfGenerator'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, balanceKobo, isOverdue, type BillingSettings, type InvoiceRow } from '@/lib/invoices'
import { formatKobo, parseNairaInput } from '@/lib/money'
import { lagosToday } from '@/lib/negotiationStatus'
import InvoiceEditor from './InvoiceEditor'
import { InvoiceStatusBadge, fieldStyle, longDate, mutedText } from './shared'

type Payment = { id: string; amount_kobo: number; paid_on: string; method: string; reference: string | null; recorded_by: string }

// One invoice: its lines and totals, payments received, and the actions that apply to its
// status (edit a draft, send or resend, record or remove a payment, download, void).
export default function InvoiceDetail({
  invoiceId,
  settings,
  onChanged,
  onClose,
}: {
  invoiceId: string
  settings: BillingSettings | null
  onChanged: (inv: InvoiceRow) => void
  onClose: () => void
}) {
  const [inv, setInv] = useState<InvoiceRow | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [caseRef, setCaseRef] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [pay, setPay] = useState({ amount: '', paidOn: lagosToday(), method: 'bank_transfer', reference: '' })
  const [voidReason, setVoidReason] = useState('')
  const [confirmVoid, setConfirmVoid] = useState(false)

  async function load() {
    try {
      const res = await authedFetch(`/api/admin/invoices?id=${encodeURIComponent(invoiceId)}`)
      const data = await res.json()
      if (!res.ok || data.error) return setErr(data.error || 'Could not load the invoice.')
      setInv(data.invoice)
      setPayments(data.payments || [])
      setCaseRef(data.caseRef ?? null)
      setPay((p) => ({ ...p, amount: (balanceKobo(data.invoice) / 100).toString() }))
    } catch {
      setErr('Network error while loading the invoice.')
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  function applied(updated: InvoiceRow | null, message: string) {
    if (!updated) return
    setInv(updated)
    onChanged(updated)
    setMsg(message)
  }

  async function call(label: string, url: string, method: string, body: unknown, message: string) {
    setErr('')
    setMsg('')
    setBusy(label)
    try {
      const res = await authedFetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok || data.error) {
        setErr(data.error || 'Something went wrong.')
        return false
      }
      applied(data.invoice, message)
      return true
    } catch {
      setErr('Network error. Please try again.')
      return false
    } finally {
      setBusy('')
    }
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseNairaInput(pay.amount)
    if (!amount) return setErr('Enter the amount received, like 50,000.')
    const ok = await call('pay', '/api/admin/invoices/payments', 'POST', { invoiceId, amountKobo: amount, paidOn: pay.paidOn, method: pay.method, reference: pay.reference }, 'Payment recorded.')
    if (ok) {
      setPay((p) => ({ ...p, reference: '' }))
      load()
    }
  }

  function download() {
    if (!inv) return
    buildInvoicePdf(inv, settings, { caseRef }).save(`${inv.invoice_number.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`)
  }

  if (!inv) return <div className="card" style={{ padding: 18, fontSize: 13, color: err ? 'var(--danger)' : 'var(--text-3)' }}>{err || 'Loading invoice…'}</div>
  if (editing) {
    return (
      <InvoiceEditor
        existing={inv}
        settings={settings}
        caseRef={caseRef}
        onCancel={() => setEditing(false)}
        onSaved={(saved, sent) => {
          setEditing(false)
          applied(saved, sent ? 'Saved and emailed to the client.' : 'Draft saved.')
        }}
      />
    )
  }

  const balance = balanceKobo(inv)
  const overdue = isOverdue(inv, lagosToday())
  const canPay = inv.status === 'sent' || inv.status === 'part_paid'

  return (
    <div className="card" style={{ padding: '18px 20px', display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{inv.invoice_number}</h3>
          <InvoiceStatusBadge status={inv.status} overdue={overdue} />
        </div>
        <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, fontSize: 13 }}>
        <div><div style={mutedText}>Client</div>{inv.client_name}{inv.client_email ? <div style={mutedText}>{inv.client_email}</div> : null}</div>
        <div><div style={mutedText}>Issued / due</div>{longDate(inv.issue_date)} · {inv.due_date ? longDate(inv.due_date) : 'On receipt'}</div>
        <div><div style={mutedText}>Total</div><strong>{formatKobo(inv.total_kobo)}</strong></div>
        <div><div style={mutedText}>Balance</div><strong style={{ color: overdue ? 'var(--danger)' : undefined }}>{formatKobo(balance)}</strong></div>
      </div>
      {inv.matter && <p style={{ margin: 0, fontSize: 13 }}><span style={mutedText}>Matter: </span>{inv.matter}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--text-3)' }}><th style={{ padding: '6px 0', fontWeight: 600 }}>Description</th><th style={{ padding: '6px 0', fontWeight: 600, textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 12px 8px 0', whiteSpace: 'pre-wrap' }}>{it.description}</td>
                <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKobo(it.amount_kobo)}</td>
              </tr>
            ))}
            {inv.vat_rate > 0 && (
              <tr style={{ borderTop: '1px solid var(--border-subtle)' }}><td style={{ padding: '8px 0' }}>VAT ({inv.vat_rate}%)</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatKobo(inv.vat_kobo)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {inv.status === 'draft' && <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>Edit</button>}
        {inv.status !== 'void' && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy !== ''} onClick={() => call('send', '/api/admin/invoices/send', 'POST', { id: inv.id }, inv.status === 'paid' ? 'Receipt emailed to the client.' : 'Emailed to the client.')}>
            {busy === 'send' ? 'Sending…' : inv.status === 'draft' ? 'Email to client' : inv.status === 'paid' ? 'Email receipt' : 'Email again'}
          </button>
        )}
        <button type="button" className="btn btn-sm" onClick={download}>Download PDF</button>
        {inv.status !== 'void' && inv.amount_paid_kobo === 0 && !confirmVoid && (
          <button type="button" className="btn btn-sm" onClick={() => setConfirmVoid(true)}>Void</button>
        )}
      </div>
      {inv.sent_at && <p style={mutedText}>Last emailed {new Date(inv.sent_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}

      {confirmVoid && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
          <label style={{ ...fieldStyle, flex: 1, minWidth: 200 }}><span>Reason for voiding (kept on record)</span><input id="inv-void-reason" className="input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} /></label>
          <button type="button" className="btn btn-sm" style={{ color: 'var(--danger)' }} disabled={busy !== ''} onClick={async () => { if (await call('void', '/api/admin/invoices', 'PATCH', { id: inv.id, action: 'void', voidReason }, 'Invoice voided.')) setConfirmVoid(false) }}>
            {busy === 'void' ? 'Voiding…' : 'Void invoice'}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setConfirmVoid(false)}>Keep it</button>
        </div>
      )}
      {inv.status === 'void' && inv.void_reason && <p style={mutedText}>Voided: {inv.void_reason}</p>}

      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Payments</span>
        {payments.length === 0 && <p style={mutedText}>No payments recorded yet.</p>}
        {payments.map((p) => (
          <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--border-subtle)', paddingTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}><strong>{formatKobo(p.amount_kobo)}</strong> · {longDate(p.paid_on)} · {PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
            <button type="button" className="btn btn-sm" disabled={busy !== ''} onClick={async () => { if (await call('rm', '/api/admin/invoices/payments', 'DELETE', { paymentId: p.id }, 'Payment removed.')) load() }}>Remove</button>
          </div>
        ))}
        {canPay && (
          <form onSubmit={recordPayment} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, alignItems: 'end', paddingTop: 8 }}>
            <label style={fieldStyle}><span>Amount (₦)</span><input id="pay-amount" className="input" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
            <label style={fieldStyle}><span>Received on</span><input id="pay-date" className="input" type="date" max={lagosToday()} value={pay.paidOn} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })} /></label>
            <label style={fieldStyle}>
              <span>Method</span>
              <select id="pay-method" className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
              </select>
            </label>
            <label style={fieldStyle}><span>Reference</span><input id="pay-ref" className="input" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></label>
            <button type="submit" className="btn btn-sm" disabled={busy !== ''}>{busy === 'pay' ? 'Recording…' : 'Record payment'}</button>
          </form>
        )}
      </div>

      {msg && <p style={{ ...mutedText, fontSize: 13 }}>{msg}</p>}
      {err && <p role="alert" style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{err}</p>}
    </div>
  )
}
