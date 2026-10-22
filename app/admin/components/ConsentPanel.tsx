'use client'

import { useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import type { ConsentRecordRow, MarketingContact } from '@/lib/consent'

export interface ConsentData {
  records: ConsentRecordRow[]
  active: MarketingContact[]
}

const SOURCE_LABEL: Record<string, string> = {
  debt_check: 'Debt check',
  footer_newsletter: 'Newsletter sign-up',
  unsubscribe_link: 'Unsubscribe link',
  admin: 'Staff',
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
}

// Who may receive marketing, the downloadable list, a form for choices given directly to staff,
// and the recent audit trail. Everything here writes new consent records; nothing is edited.
export default function ConsentPanel({ data, error, onChanged }: { data: ConsentData | null; error: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ contact: '', granted: 'false', note: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function download() {
    setErr('')
    try {
      const res = await authedFetch('/api/admin/consents?format=csv')
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        return setErr(d.error || 'Could not download the list.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'marketing-list.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setErr('Network error.')
    }
  }

  async function record(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setMsg('')
    const c = form.contact.trim()
    const isEmail = c.includes('@')
    setBusy(true)
    try {
      const res = await authedFetch('/api/admin/consents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: isEmail ? c : null, phone: isEmail ? null : c, granted: form.granted === 'true', note: form.note }),
      })
      const d = await res.json()
      if (!res.ok || d.error) return setErr(d.error || 'Could not record it.')
      setMsg(form.granted === 'true' ? 'Opt-in recorded.' : 'Opt-out recorded. They are off the marketing list.')
      setForm({ contact: '', granted: 'false', note: '' })
      onChanged()
    } catch {
      setErr('Network error.')
    } finally {
      setBusy(false)
    }
  }

  const recent = data ? [...data.records].reverse().slice(0, 12) : []

  return (
    <div className="card" style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <strong style={{ fontSize: 14 }}>Marketing consent</strong>
          <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            {data ? `${data.active.length} ${data.active.length === 1 ? 'person has' : 'people have'} agreed to receive tips and news.` : error || 'Loading…'} Only message people on this list.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm" onClick={download} disabled={!data}>Download list (CSV)</button>
          <button type="button" className="btn btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Hide records' : 'Record a choice / view records'}</button>
        </div>
      </div>

      {open && (
        <>
          <form onSubmit={record} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-3)' }}>Email or phone</span>
              <input id="consent-contact" className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="0803… or name@…" style={{ fontSize: 13 }} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-3)' }}>Choice</span>
              <select id="consent-choice" className="input" value={form.granted} onChange={(e) => setForm({ ...form, granted: e.target.value })} style={{ fontSize: 13 }}>
                <option value="false">Opted out</option>
                <option value="true">Opted in</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-3)' }}>How it was given {form.granted === 'true' ? '(required)' : '(optional)'}</span>
              <input id="consent-note" className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={form.granted === 'true' ? 'Said yes on a call today' : 'Replied STOP on WhatsApp'} style={{ fontSize: 13 }} />
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !form.contact.trim()}>{busy ? 'Saving…' : 'Record'}</button>
          </form>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
            If anyone asks to stop (“STOP”, “don’t message me”), record it here straight away. Records can’t be edited; a new choice replaces the old one.
          </p>

          {recent.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-3)' }}>
                    {['When (Lagos)', 'Who', 'Purpose', 'Choice', 'Where', 'Words agreed to / note'].map((h) => <th key={h} style={{ padding: '6px 8px 6px 0', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                      <td style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                      <td style={{ padding: '6px 8px 6px 0' }}>{r.email ?? ''}{r.email && r.phone ? ' · ' : ''}{r.phone ? `+${r.phone}` : ''}</td>
                      <td style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>{r.purpose === 'marketing' ? 'Marketing' : 'About their matter'}</td>
                      <td style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap', color: r.granted ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{r.granted ? 'Yes' : 'No / withdrawn'}</td>
                      <td style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>{SOURCE_LABEL[r.source] ?? r.source}{r.recorded_by ? ` (${r.recorded_by})` : ''}</td>
                      <td style={{ padding: '6px 0', color: 'var(--text-2)' }}>{r.note ? `${r.note} · ` : ''}<span title={r.wording}>{r.wording.length > 90 ? `${r.wording.slice(0, 90)}…` : r.wording}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {msg && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-2)' }}>{msg}</p>}
      {err && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--danger)' }}>{err}</p>}
    </div>
  )
}
