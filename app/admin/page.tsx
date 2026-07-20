'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, authedFetch } from '@/lib/supabaseClient'
import { AGENTS } from '@/lib/agents'
import type { AgentId } from '@/lib/agents'
import { formatNaira } from '@/lib/formatNaira'

interface AdminCaseRow {
  id: string
  case_number: number
  user_id: string
  userEmail: string
  agent_id: string
  status: string
  document_title: string | null
  amount_paid: number
  expected_amount: number | null
  delivery_option: string | null
  client_phone: string | null
  created_at: string
}

interface CustomClaimRow {
  id: string
  name: string
  email: string
  phone: string | null
  description: string
  amount_paid: number
  status: string
  created_at: string
}

interface WaitlistRow {
  id: string
  service: string
  email: string
  created_at: string
}

const STAGE_LABEL: Record<string, string> = {
  draft: 'Interview',
  document_ready: 'Doc Ready',
  paid: 'Paid',
  letter_served: 'Letter Served',
  filed: 'Filed in Court',
  judgment_obtained: 'Judgment Won',
  closed: 'Closed',
}

const NEXT_ACTION: Record<string, { action: 'markServed' | 'markFiled' | 'markJudgment'; label: string } | undefined> = {
  paid: { action: 'markServed', label: 'Mark Served' },
  letter_served: { action: 'markFiled', label: 'Mark Filed' },
  filed: { action: 'markJudgment', label: 'Mark Judgment Won' },
}

type Tab = 'cases' | 'claims' | 'waitlist'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPage() {
  const router = useRouter()
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [tab, setTab] = useState<Tab>('cases')

  const [cases, setCases] = useState<AdminCaseRow[]>([])
  const [claims, setClaims] = useState<CustomClaimRow[]>([])
  const [signups, setSignups] = useState<WaitlistRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [filterEmail, setFilterEmail] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAgent, setFilterAgent] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/')
        return
      }
      setCheckedAuth(true)
    })
  }, [router])

  useEffect(() => {
    if (!checkedAuth) return
    loadTab(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, tab])

  async function loadTab(which: Tab) {
    setLoading(true)
    setLoadError('')
    try {
      if (which === 'cases') {
        const params = new URLSearchParams()
        if (filterEmail) params.set('email', filterEmail)
        if (filterStatus) params.set('status', filterStatus)
        if (filterAgent) params.set('agentId', filterAgent)
        const res = await authedFetch(`/api/admin/cases?${params.toString()}`)
        if (res.status === 403) { setAccessDenied(true); return }
        const data = await res.json()
        if (!res.ok) { setLoadError(data.error || 'Failed to load cases.'); return }
        setCases(data.cases ?? [])
      } else if (which === 'claims') {
        const res = await authedFetch('/api/admin/custom-claims')
        if (res.status === 403) { setAccessDenied(true); return }
        const data = await res.json()
        if (!res.ok) { setLoadError(data.error || 'Failed to load custom claims.'); return }
        setClaims(data.claims ?? [])
      } else {
        const res = await authedFetch('/api/admin/waitlist')
        if (res.status === 403) { setAccessDenied(true); return }
        const data = await res.json()
        if (!res.ok) { setLoadError(data.error || 'Failed to load waitlist signups.'); return }
        setSignups(data.signups ?? [])
      }
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusAction(caseId: string, action: 'markServed' | 'markFiled' | 'markJudgment') {
    setUpdatingId(caseId)
    try {
      const res = await authedFetch('/api/update-case-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, action }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not update this case.')
        return
      }
      await loadTab('cases')
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (!checkedAuth) return null

  if (accessDenied) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <h2 style={{ marginTop: 0 }}>Access Denied</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>This area is restricted to Pandas LP staff.</p>
          <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: 12, display: 'inline-flex' }}>Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <header className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
            Pandas <span className="accent">LP</span> <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Admin</span>
          </Link>
          <Link href="/dashboard" className="btn" style={{ fontSize: 13 }}>My Dashboard</Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 100, paddingBottom: 96 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 24 }}>
          Admin
        </h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
          {(['cases', 'claims', 'waitlist'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 4px', marginRight: 20, fontSize: 14, fontWeight: 600,
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {t === 'cases' ? 'Cases' : t === 'claims' ? 'Custom Claims' : 'Waitlist Signups'}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 20, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--danger)', fontSize: 14 }}>{loadError}</span>
            <button type="button" className="btn btn-sm" onClick={() => setLoadError('')}>Dismiss</button>
          </div>
        )}

        {tab === 'cases' && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              <input
                className="input"
                placeholder="Filter by client email…"
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') loadTab('cases') }}
                style={{ maxWidth: 240, fontSize: 13 }}
              />
              <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ maxWidth: 180, fontSize: 13 }}>
                <option value="">All statuses</option>
                {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="input" value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} style={{ maxWidth: 200, fontSize: 13 }}>
                <option value="">All agents</option>
                {Object.values(AGENTS).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => loadTab('cases')}>Apply Filters</button>
            </div>

            {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
            {!loading && cases.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No cases match these filters.</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cases.map((c) => {
                const agent = AGENTS[c.agent_id as AgentId]
                const next = NEXT_ACTION[c.status]
                return (
                  <div key={c.id} className="card" style={{ padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>
                          {c.document_title ?? agent?.name ?? c.agent_id}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                          {c.userEmail || 'unknown client'} · {formatDate(c.created_at)}
                        </div>
                      </div>
                      <span className="badge">{STAGE_LABEL[c.status] ?? c.status}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 13, color: 'var(--text-2)' }}>
                      <span>Paid: {formatNaira(c.amount_paid)}</span>
                      {c.expected_amount != null && <span>Quoted: {formatNaira(c.expected_amount)}</span>}
                      {c.delivery_option && <span>Delivery: {c.delivery_option}</span>}
                      {c.client_phone && (
                        <a href={`tel:${c.client_phone}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>📞 {c.client_phone}</a>
                      )}
                      {c.delivery_option === 'pandas-serves' && !c.client_phone && (
                        <span style={{ color: 'var(--danger)' }}>⚠ No callback number</span>
                      )}
                    </div>

                    {next && (
                      <div style={{ marginTop: 14 }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={updatingId === c.id}
                          onClick={() => handleStatusAction(c.id, next.action)}
                        >
                          {updatingId === c.id ? 'Updating…' : next.label}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === 'claims' && (
          <>
            {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
            {!loading && claims.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No custom claims yet.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {claims.map((claim) => (
                <div key={claim.id} className="card" style={{ padding: '18px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>{claim.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                        {claim.email}{claim.phone ? ` · ${claim.phone}` : ''} · {formatDate(claim.created_at)}
                      </div>
                    </div>
                    <span className="badge">{formatNaira(claim.amount_paid)}</span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--text-1)', marginTop: 10, whiteSpace: 'pre-wrap' }}>{claim.description}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'waitlist' && (
          <>
            {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
            {!loading && signups.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No waitlist signups yet.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {signups.map((s) => (
                <div key={s.id} className="card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontSize: 14 }}>{s.email}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.service} · {formatDate(s.created_at)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
