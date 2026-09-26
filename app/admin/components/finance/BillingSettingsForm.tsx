'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import type { BillingSettings } from '@/lib/invoices'
import { fieldStyle, mutedText, useBillingSettings } from './shared'

// Bank details and billing defaults. Invoices cannot be sent until the bank details are here,
// because the client needs somewhere to pay.
export default function BillingSettingsForm() {
  const { settings, setSettings, error: loadError } = useBillingSettings()
  const [form, setForm] = useState({ bankAccountName: '', bankAccountNumber: '', bankName: '', vatRate: '0', taxId: '', paymentTermsDays: '7', usdNgnRate: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!settings) return
    setForm({
      bankAccountName: settings.bank_account_name ?? '',
      bankAccountNumber: settings.bank_account_number ?? '',
      bankName: settings.bank_name ?? '',
      vatRate: String(settings.vat_rate ?? 0),
      taxId: settings.tax_id ?? '',
      paymentTermsDays: String(settings.payment_terms_days ?? 7),
      usdNgnRate: settings.usd_ngn_rate != null ? String(settings.usd_ngn_rate) : '',
    })
  }, [settings])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setMsg('')
    setSaving(true)
    try {
      const res = await authedFetch('/api/admin/settings/billing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          vatRate: Number(form.vatRate || 0),
          paymentTermsDays: Number(form.paymentTermsDays || 0),
          usdNgnRate: form.usdNgnRate.trim() ? Number(form.usdNgnRate) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setErr(data.error || 'Could not save.')
        return
      }
      setSettings(data.settings as BillingSettings)
      setMsg('Saved.')
    } catch {
      setErr('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="card" style={{ padding: '20px 22px', display: 'grid', gap: 18, maxWidth: 720 }}>
      {loadError && <p style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{loadError}</p>}
      <section style={{ display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Bank details</h3>
        <p style={mutedText}>Printed on every invoice. Invoices can&rsquo;t be sent until these are filled in.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <label style={fieldStyle}><span>Account name</span><input id="bs-acct-name" className="input" value={form.bankAccountName} onChange={set('bankAccountName')} /></label>
          <label style={fieldStyle}><span>Account number</span><input id="bs-acct-no" className="input" inputMode="numeric" maxLength={10} placeholder="10 digits" value={form.bankAccountNumber} onChange={set('bankAccountNumber')} /></label>
          <label style={fieldStyle}><span>Bank</span><input id="bs-bank" className="input" value={form.bankName} onChange={set('bankName')} /></label>
        </div>
      </section>
      <section style={{ display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Invoice defaults</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <label style={fieldStyle}><span>VAT (%)</span><input id="bs-vat" className="input" inputMode="decimal" value={form.vatRate} onChange={set('vatRate')} /></label>
          <label style={fieldStyle}><span>Tax ID (printed when VAT is charged)</span><input id="bs-tin" className="input" value={form.taxId} onChange={set('taxId')} /></label>
          <label style={fieldStyle}><span>Payment terms (days)</span><input id="bs-terms" className="input" inputMode="numeric" value={form.paymentTermsDays} onChange={set('paymentTermsDays')} /></label>
        </div>
        <p style={mutedText}>Set VAT to 0 if the firm is not VAT-registered. 7.5% is the current Nigerian rate.</p>
      </section>
      <section style={{ display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Dashboard</h3>
        <label style={{ ...fieldStyle, maxWidth: 260 }}>
          <span>Naira per US dollar</span>
          <input id="bs-fx" className="input" inputMode="decimal" placeholder="e.g. 1330" value={form.usdNgnRate} onChange={set('usdNgnRate')} />
        </label>
        <p style={mutedText}>AI is billed in dollars. With a rate here, the dashboard also shows AI cost in naira. Update it when the rate moves.</p>
      </section>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        {msg && <span style={mutedText}>{msg}</span>}
        {err && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</span>}
      </div>
    </form>
  )
}
