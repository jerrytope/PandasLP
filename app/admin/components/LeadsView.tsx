'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { LABELS, LEAD_STATUSES, LEAD_STATUS_LABEL, agentOpener, formatNairaPlain, type DebtCheckAnswers, type LeadStatus } from '@/lib/debtCheck'

interface LeadRow {
  id: string
  created_at: string
  name: string
  phone: string
  email: string | null
  answers: DebtCheckAnswers
  amount_naira: number
  verdict: 'strong' | 'good' | 'possible' | 'difficult' | 'review'
  next_step: 'demand_letter' | 'property' | 'lawyer_review'
  note: string | null
  source: string | null
  status: LeadStatus
  staff_notes: string | null
  contacted_at: string | null
  updated_by: string | null
}

const VERDICT_LABEL = { strong: 'Strong', good: 'Good', possible: 'Possible', difficult: 'Difficult', review: 'Needs review' } as const
const VERDICT_STYLE: Record<LeadRow['verdict'], { bg: string; fg: string }> = {
  strong: { bg: 'rgba(22, 128, 61, 0.10)', fg: '#16803d' },
  good: { bg: 'rgba(22, 128, 61, 0.07)', fg: '#16803d' },
  possible: { bg: 'rgba(184, 134, 11, 0.12)', fg: '#8a6508' },
  difficult: { bg: 'var(--bg-1)', fg: 'var(--text-2)' },
  review: { bg: 'rgba(42, 120, 214, 0.10)', fg: '#1d5fae' },
}
const STATUS_STYLE: Record<LeadStatus, { bg: string; fg: string }> = {
  new: { bg: 'rgba(179, 64, 46, 0.10)', fg: 'var(--danger)' },
  contacted: { bg: 'rgba(42, 120, 214, 0.10)', fg: '#1d5fae' },
  converted: { bg: 'rgba(22, 128, 61, 0.10)', fg: '#16803d' },
  not_a_fit: { bg: 'var(--bg-1)', fg: 'var(--text-3)' },
}

type Filter = 'open' | 'all' | LeadStatus

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  return days < 14 ? `${days} d ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Leads from the free debt check at /debt-check. Each shows what the visitor told us, one-tap
// WhatsApp / call / email, and a status so nobody is left uncontacted. The "by source" strip
// shows which posts and links are producing leads.
export default function LeadsView({ onStartIntake }: { onStartIntake: (seed: string) => void }) {
  const [leads, setLeads] = useState<LeadRow[] | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<Filter>('open')

  async function load() {
    setErr('')
    try {
      const res = await authedFetch('/api/admin/debt-checks')
      const data = await res.json()
      if (!res.ok || data.error) return setErr(data.error || 'Could not load leads.')
      setLeads(data.leads)
    } catch {
      setErr('Network error while loading leads.')
    }
  }
  useEffect(() => {
    load()
  }, [])

  const all = leads ?? []
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
  const thisWeek = all.filter((l) => new Date(l.created_at).getTime() >= weekAgo)
  const bySource = new Map<string, { leads: number; converted: number }>()
  for (const l of thisWeek) {
    const k = l.source || 'direct / unknown'
    const v = bySource.get(k) ?? { leads: 0, converted: 0 }
    v.leads++
    if (l.status === 'converted') v.converted++
    bySource.set(k, v)
  }
  const list = all.filter((l) => (filter === 'all' ? true : filter === 'open' ? l.status === 'new' || l.status === 'contacted' : l.status === filter))
  const newCount = all.filter((l) => l.status === 'new').length

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <Stat label="Leads, last 7 days" value={String(thisWeek.length)} />
        <Stat label="Waiting for a call" value={String(newCount)} tone={newCount ? 'danger' : undefined} />
        <Stat label="Became clients, last 7 days" value={String(thisWeek.filter((l) => l.status === 'converted').length)} />
        <div className="card" style={{ padding: '12px 14px', display: 'grid', gap: 4, fontSize: 12.5 }}>
          <span style={{ color: 'var(--text-3)' }}>Where they came from, last 7 days</span>
          {bySource.size === 0 && <span style={{ color: 'var(--text-3)' }}>No leads yet</span>}
          {[...bySource.entries()].sort((a, b) => b[1].leads - a[1].leads).slice(0, 5).map(([k, v]) => (
            <span key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>{v.leads}{v.converted ? ` · ${v.converted} won` : ''}</span>
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <select id="lead-filter" className="input" aria-label="Filter leads" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={{ width: 'auto', fontSize: 13 }}>
          <option value="open">Open (new and contacted)</option>
          <option value="all">All</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Share links with <code>?ref=</code> to track posts, e.g. pandaslp.com.ng/debt-check?ref=x-pinned
        </span>
      </div>

      {err && <p role="alert" style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{err}</p>}
      {leads === null && !err && <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>Loading leads…</p>}
      {leads !== null && list.length === 0 && (
        <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>
          {all.length === 0 ? 'No leads yet. They appear here when someone takes the free debt check and asks a lawyer to contact them.' : 'No leads match this filter.'}
        </p>
      )}

      {list.map((l) => (
        <LeadCard key={l.id} lead={l} onChanged={(u) => setLeads((prev) => (prev ?? []).map((x) => (x.id === u.id ? u : x)))} onStartIntake={onStartIntake} />
      ))}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="card" style={{ padding: '12px 14px', display: 'grid', gap: 2 }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: tone === 'danger' ? 'var(--danger)' : 'var(--text-1)' }}>{value}</span>
    </div>
  )
}

function Pill({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return <span className="badge" style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600 }}>{children}</span>
}

function LeadCard({ lead, onChanged, onStartIntake }: { lead: LeadRow; onChanged: (l: LeadRow) => void; onStartIntake: (seed: string) => void }) {
  const [notes, setNotes] = useState(lead.staff_notes ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const a = lead.answers
  const firstName = lead.name.split(' ')[0]
  const waText = `Hello ${firstName}, this is Pandas LP. Thank you for taking our debt check about the ${formatNairaPlain(lead.amount_naira)} you are owed. Is now a good time to talk about the next steps?`

  async function patch(body: { status?: LeadStatus; staffNotes?: string }) {
    setBusy(true)
    setErr('')
    try {
      const res = await authedFetch('/api/admin/debt-checks', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: lead.id, ...body }) })
      const data = await res.json()
      if (!res.ok || data.error) return setErr(data.error || 'Could not save.')
      onChanged(data.lead)
    } catch {
      setErr('Network error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: '16px 18px', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15 }}>{lead.name}</strong>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatNairaPlain(lead.amount_naira)}</span>
          <Pill {...VERDICT_STYLE[lead.verdict]}>{VERDICT_LABEL[lead.verdict]}</Pill>
          <Pill {...STATUS_STYLE[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</Pill>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{ago(lead.created_at)} · from {lead.source || 'direct / unknown'}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '6px 16px', fontSize: 13 }}>
        <Fact k="Owed by" v={LABELS.debtor[a.debtor]} />
        <Fact k="Due" v={LABELS.age[a.age]} />
        <Fact k="State" v={LABELS.state[a.state]} />
        <Fact k="Admitted?" v={LABELS.admission[a.admission]} />
        <Fact k="Can reach them?" v={LABELS.location[a.location]} />
        <Fact k="Proof" v={a.proof.map((p) => LABELS.proof[p]).join('; ')} />
      </div>
      {lead.note && <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', background: 'var(--bg-1)', padding: '8px 10px' }}>“{lead.note}”</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <a className="btn btn-primary btn-sm" href={`https://wa.me/${lead.phone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer" onClick={() => lead.status === 'new' && patch({ status: 'contacted' })}>WhatsApp</a>
        <a className="btn btn-sm" href={`tel:+${lead.phone}`} onClick={() => lead.status === 'new' && patch({ status: 'contacted' })}>Call +{lead.phone}</a>
        {lead.email && <a className="btn btn-sm" href={`mailto:${lead.email}`}>Email</a>}
        <button type="button" className="btn btn-sm" onClick={() => onStartIntake(agentOpener(a))}>Start intake for them</button>
        <select
          id={`lead-status-${lead.id}`}
          className="input"
          aria-label="Lead status"
          value={lead.status}
          disabled={busy}
          onChange={(e) => patch({ status: e.target.value as LeadStatus })}
          style={{ width: 'auto', fontSize: 13, marginLeft: 'auto' }}
        >
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <textarea
          id={`lead-notes-${lead.id}`}
          className="input"
          rows={2}
          aria-label="Notes on this lead"
          placeholder="Notes from the call"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ fontSize: 13, resize: 'vertical', flex: 1 }}
        />
        <button type="button" className="btn btn-sm" disabled={busy || notes === (lead.staff_notes ?? '')} onClick={() => patch({ staffNotes: notes })}>Save</button>
      </div>
      {(lead.contacted_at || lead.updated_by) && (
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {lead.contacted_at ? `First contacted ${ago(lead.contacted_at)}` : ''}{lead.updated_by ? ` · last updated by ${lead.updated_by}` : ''}
        </span>
      )}
      {err && <p role="alert" style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{err}</p>}
    </div>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span style={{ color: 'var(--text-3)' }}>{k}: </span>
      {v}
    </div>
  )
}
