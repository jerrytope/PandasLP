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
  paid_at: string | null
  deadline_at: string | null
  source: string | null
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

const NEXT_ACTION: Record<string, { action: 'markServed' | 'markFiled' | 'markJudgment' | 'markClosed'; label: string } | undefined> = {
  paid: { action: 'markServed', label: 'Mark Served' },
  letter_served: { action: 'markFiled', label: 'Mark Filed' },
  filed: { action: 'markJudgment', label: 'Mark Judgment Won' },
  judgment_obtained: { action: 'markClosed', label: 'Close Case' },
}

type Tab = 'queue' | 'cases' | 'claims' | 'waitlist'

const DAY_MS = 24 * 60 * 60 * 1000

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Shared by the Cases tab (flat filtered list) and the Queue tab (urgency-bucketed) — one
// card implementation instead of two copies drifting apart. `accentColor` lets the queue
// flag urgency (red/amber) without the Cases tab needing to know about that concept.
function CaseCard({
  c,
  updatingId,
  onAction,
  accentColor,
}: {
  c: AdminCaseRow
  updatingId: string | null
  onAction: (caseId: string, action: 'markServed' | 'markFiled' | 'markJudgment' | 'markClosed') => void
  accentColor?: string
}) {
  const agent = AGENTS[c.agent_id as AgentId]
  const next = NEXT_ACTION[c.status]
  return (
    <div className="card" style={{ padding: '18px 22px', ...(accentColor ? { borderColor: accentColor } : {}) }}>
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
            onClick={() => onAction(c.id, next.action)}
          >
            {updatingId === c.id ? 'Updating…' : next.label}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [tab, setTab] = useState<Tab>('queue')

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
      if (which === 'queue') {
        // Unfiltered — the queue needs every case regardless of the Cases tab's filter
        // inputs, since it buckets by urgency across all statuses at once.
        const res = await authedFetch('/api/admin/cases')
        if (res.status === 403) { setAccessDenied(true); return }
        const data = await res.json()
        if (!res.ok) { setLoadError(data.error || 'Failed to load cases.'); return }
        setCases(data.cases ?? [])
      } else if (which === 'cases') {
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

  async function handleStatusAction(caseId: string, action: 'markServed' | 'markFiled' | 'markJudgment' | 'markClosed') {
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
      if (action === 'markServed') {
        // Mirrors app/dashboard/page.tsx's updateCaseStatus — without this, marking a case
        // served from the admin panel silently skipped the Day-0 client notification.
        await authedFetch('/api/send-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ caseId, day: 0 }),
        }).catch((err) => console.error('Failed to send day-0 follow-up email:', err))
      }
      await loadTab(tab)
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
          {(['queue', 'cases', 'claims', 'waitlist'] as Tab[]).map((t) => (
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
              {t === 'queue' ? 'Queue' : t === 'cases' ? 'Cases' : t === 'claims' ? 'Custom Claims' : 'Waitlist Signups'}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 20, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--danger)', fontSize: 14 }}>{loadError}</span>
            <button type="button" className="btn btn-sm" onClick={() => setLoadError('')}>Dismiss</button>
          </div>
        )}

        {tab === 'queue' && (() => {
          const now = Date.now()
          const weekAgo = now - 7 * DAY_MS
          const twoWeeksAgo = now - 14 * DAY_MS

          const paidCases = cases.filter((c) => c.paid_at)
          const paidThisWeek = paidCases.filter((c) => new Date(c.paid_at!).getTime() >= weekAgo)
          const paidLastWeek = paidCases.filter((c) => {
            const t = new Date(c.paid_at!).getTime()
            return t >= twoWeeksAgo && t < weekAgo
          })
          const revenueThisWeek = paidThisWeek.reduce((sum, c) => sum + (c.amount_paid || 0), 0)

          const sourceCounts: Record<string, number> = {}
          for (const c of paidThisWeek) {
            const key = c.source || 'direct'
            sourceCounts[key] = (sourceCounts[key] || 0) + 1
          }

          const unserved = cases
            .filter((c) => c.status === 'paid')
            .sort((a, b) => new Date(a.paid_at ?? a.created_at).getTime() - new Date(b.paid_at ?? b.created_at).getTime())
          const oldestUnservedDays =
            unserved.length > 0 ? Math.floor((now - new Date(unserved[0].paid_at ?? unserved[0].created_at).getTime()) / DAY_MS) : null

          const deadlinePassed = cases.filter(
            (c) => c.status === 'letter_served' && c.deadline_at && new Date(c.deadline_at).getTime() < now,
          )
          const awaitingJudgment = cases.filter((c) => c.status === 'filed')

          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
                <div className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>New paid this week</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                    {paidThisWeek.length} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>vs {paidLastWeek.length} last week</span>
                  </div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Revenue this week</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginTop: 4 }}>{formatNaira(revenueThisWeek)}</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cases by source (this week)</div>
                  <div style={{ fontSize: 13, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {Object.keys(sourceCounts).length === 0 && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    {Object.entries(sourceCounts).map(([src, count]) => (
                      <span key={src}>{src}: <strong>{count}</strong></span>
                    ))}
                  </div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Oldest unserved case</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                    {oldestUnservedDays === null ? '—' : `${oldestUnservedDays}d`}
                  </div>
                </div>
              </div>

              {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}

              {!loading && (
                <>
                  <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                    ⚠ Unserved {unserved.length > 0 && `(${unserved.length})`}
                  </h2>
                  {unserved.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>Nothing waiting to be served.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
                    {unserved.map((c) => {
                      const daysSincePaid = Math.floor((now - new Date(c.paid_at ?? c.created_at).getTime()) / DAY_MS)
                      return (
                        <CaseCard
                          key={c.id}
                          c={c}
                          updatingId={updatingId}
                          onAction={handleStatusAction}
                          accentColor={daysSincePaid >= 3 ? 'var(--danger)' : undefined}
                        />
                      )
                    })}
                  </div>

                  <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                    ⏰ Deadline passed {deadlinePassed.length > 0 && `(${deadlinePassed.length})`}
                  </h2>
                  {deadlinePassed.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>No cases past their response deadline.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
                    {deadlinePassed.map((c) => (
                      <CaseCard key={c.id} c={c} updatingId={updatingId} onAction={handleStatusAction} accentColor="var(--warning)" />
                    ))}
                  </div>

                  <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                    ⚖ Filed, awaiting judgment {awaitingJudgment.length > 0 && `(${awaitingJudgment.length})`}
                  </h2>
                  {awaitingJudgment.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>No cases waiting on a judgment.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {awaitingJudgment.map((c) => (
                      <CaseCard key={c.id} c={c} updatingId={updatingId} onAction={handleStatusAction} />
                    ))}
                  </div>
                </>
              )}
            </>
          )
        })()}

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
              {cases.map((c) => (
                <CaseCard key={c.id} c={c} updatingId={updatingId} onAction={handleStatusAction} />
              ))}
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
