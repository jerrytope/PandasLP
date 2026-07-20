'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, authedFetch } from '@/lib/supabaseClient'
import { AGENTS } from '@/lib/agents'
import type { AgentId } from '@/lib/agents'

interface CaseRow {
  id: string
  agent_id: string
  status: string
  document_title: string | null
  amount_paid: number
  created_at: string
  deadline_at: string | null
  delivery_option: string | null
  client_phone: string | null
}

const STAGE_ORDER = ['draft', 'document_ready', 'paid', 'letter_served', 'filed', 'judgment_obtained', 'closed']

const STAGE_LABEL: Record<string, string> = {
  draft:              'Interview',
  document_ready:     'Doc Ready',
  paid:               'Paid',
  letter_served:      'Letter Served',
  filed:              'Filed in Court',
  judgment_obtained:  'Judgment Won',
  closed:             'Closed',
}

const TIMELINE_STEPS = [
  { key: 'paid',          label: 'Document Paid' },
  { key: 'letter_served', label: 'Letter Served' },
  { key: 'filed',         label: 'Court Filed' },
  { key: 'judgment_obtained', label: 'Judgment Won' },
]

function stageIndex(status: string) {
  return STAGE_ORDER.indexOf(status)
}

function daysLeft(deadline: string) {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
}

function CaseTimeline({ status }: { status: string }) {
  const current = stageIndex(status)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 12, flexWrap: 'wrap', rowGap: 8 }}>
      {TIMELINE_STEPS.map((step, i) => {
        const stepIdx = stageIndex(step.key)
        const done    = current >= stepIdx
        const active  = current === stepIdx
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: done ? 'var(--accent)' : 'var(--border-strong)',
                boxShadow: active ? '0 0 0 3px rgba(214,187,128,0.25)' : 'none',
                transition: 'background 0.2s',
              }} />
              <span style={{
                fontSize: 10,
                color: done ? 'var(--text-muted)' : 'rgba(156,150,144,0.4)',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
              }}>
                {step.label}
              </span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div style={{
                width: 40, height: 1,
                background: current > stepIdx ? 'var(--accent)' : 'var(--border)',
                marginBottom: 18, marginLeft: 4, marginRight: 4,
                transition: 'background 0.2s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [cases, setCases] = useState<CaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUserEmail(session.user.email ?? '')
      fetchCases()
    })
  }, [router])

  async function fetchCases() {
    const { data } = await supabase
      .from('cases')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setCases(data as CaseRow[])
    setLoading(false)
  }

  async function updateCaseStatus(caseId: string, action: 'markServed' | 'markFiled' | 'markJudgment') {
    setUpdatingId(caseId)
    setUpdateError(null)
    try {
      const res = await authedFetch('/api/update-case-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, action }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setUpdateError(data.error || 'Could not update this case. Please refresh and try again.')
        return
      }
      if (action === 'markServed') {
        await authedFetch('/api/send-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ caseId, day: 0 }),
        }).catch((err) => console.error('Failed to send day-0 follow-up email:', err))
      }
      await fetchCases()
    } catch (err) {
      console.error('Failed to update case status:', err)
      setUpdateError('Network error. Please check your connection and try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  const markServed   = (caseId: string) => updateCaseStatus(caseId, 'markServed')
  const markFiled    = (caseId: string) => updateCaseStatus(caseId, 'markFiled')
  const markJudgment = (caseId: string) => updateCaseStatus(caseId, 'markJudgment')

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
      <header className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
            Pandas <span className="accent">LP</span>
          </Link>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/" className="btn" style={{ fontSize: 13, padding: '10px 18px' }}>← Home</Link>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: '10px 18px' }} onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 56, paddingBottom: 96 }}>
        <div style={{ marginBottom: 40 }}>
          <span className="label-mono">Your Account</span>
          <h1 style={{
            marginTop: 8, marginBottom: 4,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4vw,44px)',
            fontWeight: 700, letterSpacing: '-0.02em',
          }}>
            Case History
          </h1>
          {userEmail && <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>{userEmail}</p>}
        </div>

        {updateError && (
          <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 20, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--danger)', fontSize: 14 }}>{updateError}</span>
            <button type="button" className="btn btn-sm" onClick={() => setUpdateError(null)}>Dismiss</button>
          </div>
        )}

        {loading && <p style={{ color: 'var(--text-muted)' }}>Loading your cases…</p>}

        {!loading && cases.length === 0 && (
          <div className="card" style={{ maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>No cases yet</h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', fontSize: 14 }}>
              Start a conversation with one of our AI agents and your cases will appear here automatically.
            </p>
            <Link href="/" className="btn btn-primary" style={{ display: 'inline-flex' }}>Get Started →</Link>
          </div>
        )}

        {!loading && cases.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {cases.map((c) => {
              const agent    = AGENTS[c.agent_id as AgentId]
              const days     = c.deadline_at ? daysLeft(c.deadline_at) : null
              const urgent   = days !== null && days <= 2 && days > 0
              const overdue  = days !== null && days <= 0
              const isDebt   = c.agent_id === 'small-claims'
              const isServed = c.status === 'letter_served'
              const isPaid   = stageIndex(c.status) >= stageIndex('paid')
              const isJudgment = c.status === 'judgment_obtained'

              return (
                <div
                  key={c.id}
                  className="card"
                  style={{
                    padding: '22px 24px',
                    borderColor: urgent ? 'rgba(239,68,68,0.35)' : overdue ? 'rgba(239,68,68,0.6)' : undefined,
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: agent?.color ?? '#666',
                      flexShrink: 0, marginTop: 6,
                    }} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{
                        fontFamily: 'var(--font-display)', fontSize: 16,
                        fontWeight: 600, letterSpacing: '-0.01em',
                      }}>
                        {c.document_title ?? agent?.name ?? c.agent_id}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
                        {new Date(c.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {c.amount_paid > 0 && ` · ₦${c.amount_paid.toLocaleString()} paid`}
                      </div>
                    </div>

                    {/* Badges + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {days !== null && days > 0 && (
                        <span className="badge" style={{
                          borderColor: urgent ? 'var(--accent)' : undefined,
                          color:       urgent ? 'var(--accent-hover)' : undefined,
                        }}>
                          {days}d deadline
                        </span>
                      )}
                      {overdue && isServed && (
                        <span className="badge" style={{ borderColor: 'var(--accent)', color: 'var(--accent-hover)' }}>
                          Deadline passed
                        </span>
                      )}
                      <span className="badge">{STAGE_LABEL[c.status] ?? c.status}</span>
                      <Link
                        href={`/agent/${c.agent_id}?resume=${c.id}`}
                        className="btn"
                        style={{ fontSize: 12, padding: '7px 14px', borderRadius: 10 }}
                      >
                        Resume →
                      </Link>
                    </div>
                  </div>

                  {/* Callback number — pandas-serves tier, once paid, so a lawyer can call the client */}
                  {isPaid && c.delivery_option === 'pandas-serves' && c.client_phone && (
                    <div style={{
                      marginTop: 14,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(143,174,198,0.08)',
                      border: '1px solid rgba(143,174,198,0.25)',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}>
                      <span>📞 Client requested a callback —</span>
                      <a href={`tel:${c.client_phone}`} style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                        {c.client_phone}
                      </a>
                    </div>
                  )}

                  {/* Timeline (demand-letter cases that have been paid) */}
                  {isDebt && isPaid && <CaseTimeline status={c.status} />}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                    {/* Mark as Served — shown after payment, before served */}
                    {isPaid && c.status === 'paid' && (
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 13 }}
                        disabled={updatingId === c.id}
                        onClick={() => markServed(c.id)}
                      >
                        {updatingId === c.id ? 'Updating…' : 'Mark Letter as Served'}
                      </button>
                    )}

                    {/* Escalate to Court Filing — shown after deadline passes */}
                    {(isServed && overdue) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        <div style={{
                          background: 'rgba(214,187,128,0.06)',
                          border: '1px solid rgba(214,187,128,0.2)',
                          borderRadius: 10,
                          padding: '12px 16px',
                          fontSize: 13,
                          color: 'var(--text-2)',
                          lineHeight: 1.6,
                        }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Court filing fee applies. </span>
                          The Small Claims Court charges a filing fee based on your claim amount — typically
                          between <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>₦5,000 and ₦15,000</span>.
                          You will see the exact breakdown before paying.
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Link
                            href={`/agent/${c.agent_id}?resume=${c.id}&fileCourt=1`}
                            className="btn btn-primary"
                            style={{ fontSize: 13, alignSelf: 'flex-start' }}
                          >
                            Prepare Court Filing →
                          </Link>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: 13 }}
                            disabled={updatingId === c.id}
                            onClick={() => markFiled(c.id)}
                          >
                            {updatingId === c.id ? 'Updating…' : "I've Already Filed This"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Enforce Judgment — shown after judgment won */}
                    {isJudgment && (
                      <Link
                        href={`/?enforceFrom=${c.id}`}
                        className="btn btn-primary"
                        style={{ fontSize: 13 }}
                      >
                        Enforce Judgment →
                      </Link>
                    )}

                    {/* Mark judgment obtained — shown after filed */}
                    {c.status === 'filed' && (
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 13 }}
                        disabled={updatingId === c.id}
                        onClick={() => markJudgment(c.id)}
                      >
                        {updatingId === c.id ? 'Updating…' : 'Mark Judgment Obtained'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
