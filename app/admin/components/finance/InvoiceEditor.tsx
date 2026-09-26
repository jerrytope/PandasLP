'use client'

import { useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { buildInvoicePdf } from '@/lib/pdfGenerator'
import { computeTotals, hasBankDetails, type BillingSettings, type InvoiceRow } from '@/lib/invoices'
import { formatKobo, parseNairaInput } from '@/lib/money'
import { lagosToday } from '@/lib/negotiationStatus'
import { fieldStyle, mutedText } from './shared'

type Line = { description: string; amount: string }

export interface InvoiceDefaults {
  caseId?: string | null
  clientName?: string
  clientEmail?: string | null
  matter?: string | null
}

// Create a new invoice or edit a draft. Totals and VAT are shown live but always recomputed by
// the server from the lines, so what is stored never depends on this form's arithmetic.
export default function InvoiceEditor({
  existing,
  defaults,
  settings,
  caseRef,
  onSaved,
  onCancel,
}: {
  existing?: InvoiceRow | null
  defaults?: InvoiceDefaults
  settings: BillingSettings | null
  caseRef?: string | null
  onSaved: (inv: InvoiceRow, sent: boolean) => void
  onCancel: () => void
}) {
  const [clientName, setClientName] = useState(existing?.client_name ?? defaults?.clientName ?? '')
  const [clientEmail, setClientEmail] = useState(existing?.client_email ?? defaults?.clientEmail ?? '')
  const [matter, setMatter] = useState(existing?.matter ?? defaults?.matter ?? '')
  const [lines, setLines] = useState<Line[]>(
    existing?.items.map((i) => ({ description: i.description, amount: (i.amount_kobo / 100).toString() })) ?? [{ description: '', amount: '' }],
  )
  const [vatRate, setVatRate] = useState(String(existing?.vat_rate ?? settings?.vat_rate ?? 0))
  const [issueDate, setIssueDate] = useState(existing?.issue_date ?? lagosToday())
  const [dueDate, setDueDate] = useState(existing?.due_date ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [busy, setBusy] = useState<'' | 'saving' | 'sending'>('')
  const [err, setErr] = useState('')

  const parsed = lines.map((l) => ({ description: l.description.trim(), amount_kobo: parseNairaInput(l.amount) }))
  const validItems = parsed.filter((p): p is { description: string; amount_kobo: number } => !!p.description && p.amount_kobo != null && p.amount_kobo > 0)
  const vat = Number(vatRate) || 0
  const totals = computeTotals(validItems, vat)

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }

  function payload() {
    return {
      clientName,
      clientEmail: clientEmail.trim() || null,
      matter: matter.trim() || null,
      items: validItems,
      vatRate: vat,
      issueDate,
      dueDate: dueDate || undefined,
      notes: notes.trim() || null,
    }
  }

  function check(): string | null {
    if (!clientName.trim()) return 'Add the client’s name.'
    if (validItems.length === 0) return 'Add at least one line with a description and an amount.'
    if (parsed.some((p) => (p.description && p.amount_kobo == null) || (!p.description && p.amount_kobo != null))) {
      return 'Each line needs both a description and an amount like 50,000.'
    }
    return null
  }

  function previewPdf() {
    const draft: InvoiceRow = {
      id: existing?.id ?? 'preview',
      invoice_number: existing?.invoice_number ?? (invoiceNumber.trim() || 'PLP/INV/(next number)'),
      case_id: existing?.case_id ?? defaults?.caseId ?? null,
      client_name: clientName || 'Client name',
      client_email: clientEmail || null,
      matter: matter || null,
      items: validItems.length ? validItems : [{ description: 'Line description', amount_kobo: 0 }],
      vat_rate: vat,
      ...totals,
      amount_paid_kobo: 0,
      status: 'draft',
      issue_date: issueDate,
      due_date: dueDate || null,
      notes: notes || null,
      sent_at: null,
      paid_at: null,
      voided_at: null,
      void_reason: null,
      created_by: '',
      created_at: new Date().toISOString(),
    }
    const doc = buildInvoicePdf(draft, settings, { caseRef })
    window.open(doc.output('bloburl').toString(), '_blank', 'noopener')
  }

  async function save(andSend: boolean) {
    setErr('')
    const problem = check()
    if (problem) return setErr(problem)
    if (andSend && !clientEmail.trim()) return setErr('Add the client’s email address to send the invoice.')
    if (andSend && !hasBankDetails(settings)) return setErr('Add the firm’s bank details in Finance → Settings before sending.')
    setBusy(andSend ? 'sending' : 'saving')
    try {
      const res = await authedFetch('/api/admin/invoices', {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          existing
            ? { id: existing.id, ...payload() }
            : { ...payload(), caseId: defaults?.caseId ?? null, invoiceNumber: invoiceNumber.trim() || undefined },
        ),
      })
      const data = await res.json()
      if (!res.ok || data.error) return setErr(data.error || 'Could not save the invoice.')
      let saved: InvoiceRow = data.invoice
      if (andSend) {
        const sendRes = await authedFetch('/api/admin/invoices/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: saved.id }),
        })
        const sendData = await sendRes.json()
        if (!sendRes.ok || sendData.error) {
          onSaved(saved, false)
          return setErr(`Saved as a draft, but not sent: ${sendData.error || 'the email failed.'}`)
        }
        saved = sendData.invoice
      }
      onSaved(saved, andSend)
    } catch {
      setErr('Network error. Please try again.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="card" style={{ padding: '18px 20px', display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{existing ? `Edit ${existing.invoice_number}` : 'New invoice'}</h3>
        {!existing && (
          <label style={{ ...fieldStyle, gridTemplateColumns: 'auto 200px', alignItems: 'center', gap: 8 }}>
            <span style={mutedText}>Invoice no.</span>
            <input id="inv-number" className="input" placeholder="Next number (automatic)" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} style={{ fontSize: 12 }} />
          </label>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        <label style={fieldStyle}><span>Client name</span><input id="inv-client" className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} /></label>
        <label style={fieldStyle}><span>Client email</span><input id="inv-email" className="input" type="email" value={clientEmail ?? ''} onChange={(e) => setClientEmail(e.target.value)} /></label>
        <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}><span>Matter</span><input id="inv-matter" className="input" placeholder="e.g. Joel Ukpebor v. Daniel Austine Efetobore" value={matter ?? ''} onChange={(e) => setMatter(e.target.value)} /></label>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Lines</span>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px auto', gap: 8, alignItems: 'start' }}>
            <textarea id={`inv-line-${i}`} className="input" rows={2} aria-label={`Line ${i + 1} description`} placeholder="Professional fees: settlement response to opposing counsel" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} style={{ fontSize: 13, resize: 'vertical' }} />
            <input id={`inv-amt-${i}`} className="input" inputMode="decimal" aria-label={`Line ${i + 1} amount in naira`} placeholder="₦ 50,000" value={l.amount} onChange={(e) => updateLine(i, { amount: e.target.value })} style={{ fontSize: 13, textAlign: 'right' }} />
            <button type="button" className="btn btn-sm" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <div>
          <button type="button" className="btn btn-sm" onClick={() => setLines((prev) => [...prev, { description: '', amount: '' }])}>Add line</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <label style={fieldStyle}><span>VAT (%)</span><input id="inv-vat" className="input" inputMode="decimal" value={vatRate} onChange={(e) => setVatRate(e.target.value)} /></label>
        <label style={fieldStyle}><span>Invoice date</span><input id="inv-issue" className="input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></label>
        <label style={fieldStyle}>
          <span>Due date</span>
          <input id="inv-due" className="input" type="date" value={dueDate ?? ''} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>
      {!dueDate && <p style={mutedText}>Left blank, the due date is set from the payment terms in Settings ({settings?.payment_terms_days ?? 7} days).</p>}
      <label style={fieldStyle}><span>Note on the invoice (optional)</span><input id="inv-notes" className="input" value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} /></label>

      <div style={{ display: 'grid', justifyContent: 'end', gap: 2, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontSize: 13 }}>
        <span>Subtotal {formatKobo(totals.subtotal_kobo)}</span>
        {vat > 0 && <span>VAT ({vat}%) {formatKobo(totals.vat_kobo)}</span>}
        <strong style={{ fontSize: 15 }}>Total {formatKobo(totals.total_kobo)}</strong>
      </div>

      {err && <p role="alert" style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy !== ''}>Cancel</button>
        <button type="button" className="btn btn-sm" onClick={previewPdf} disabled={busy !== ''}>Preview PDF</button>
        <button type="button" className="btn btn-sm" onClick={() => save(false)} disabled={busy !== ''}>{busy === 'saving' ? 'Saving…' : 'Save draft'}</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => save(true)} disabled={busy !== ''}>{busy === 'sending' ? 'Sending…' : 'Save and email to client'}</button>
      </div>
    </div>
  )
}
