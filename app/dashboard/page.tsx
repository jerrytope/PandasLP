'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, authedFetch } from '@/lib/supabaseClient'
import { AGENTS } from '@/lib/agents'
import type { AgentId } from '@/lib/agents'
import { renderFormattedText } from '@/lib/renderFormattedText'
import { Phone, AlertTriangle } from 'lucide-react'

interface CaseRow {
  id: string
  agent_id: string
  status: string
  document_title: string | null
  document_body: string | null
  amount_paid: number
  created_at: string
  deadline_at: string | null
  delivery_option: string | null
  client_phone: string | null
  reviewed_at: string | null
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
                boxShadow: active ? '0 0 0 3px var(--accent-glow)' : '0 0 0 0 transparent',
                transform: active ? 'scale(1.3)' : 'scale(1)',
                transition: 'background 0.2s, box-shadow 0.2s var(--ease-out), transform 0.2s var(--ease-out)',
              }} />
              <span style={{
                fontSize: 10,
                color: done ? 'var(--text-muted)' : 'color-mix(in srgb, var(--text-3) 40%, transparent)',
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
                transition: 'background 0.2s var(--ease-out)',
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
  const [expandedLetterId, setExpandedLetterId] = useState<string | null>(null)

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

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} aria-label="Loading your cases">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card" style={{ padding: '22px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="skeleton" style={{ width: 10, height: 10, borderRadius: '50%' }} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="skeleton" style={{ height: 16, width: `${45 - i * 8}%`, borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 12, width: '30%', borderRadius: 4, marginTop: 8 }} />
                  </div>
                  <div className="skeleton" style={{ height: 26, width: 90, borderRadius: 10 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && cases.length === 0 && (
          <div className="card" style={{ maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>No cases yet</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', fontSize: 14 }}>
              Start a conversation with one of our agents and your cases will appear here automatically.
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
                    borderColor: urgent
                      ? 'color-mix(in srgb, var(--danger) 35%, transparent)'
                      : overdue
                        ? 'color-mix(in srgb, var(--danger) 60%, transparent)'
                        : undefined,
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: agent?.color ?? 'var(--text-3)',
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
                      {c.document_body && (
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: 12, padding: '7px 14px', borderRadius: 10 }}
                          onClick={() => setExpandedLetterId((id) => (id === c.id ? null : c.id))}
                        >
                          {expandedLetterId === c.id ? 'Hide Letter' : 'View Letter'}
                        </button>
                      )}
                      <Link
                        href={`/agent/${c.agent_id}?resume=${c.id}`}
                        className="btn"
                        style={{ fontSize: 12, padding: '7px 14px', borderRadius: 10 }}
                      >
                        Resume →
                      </Link>
                    </div>
                  </div>

                  {expandedLetterId === c.id && c.document_body && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: '16px 18px',
                        borderRadius: 10,
                        background: 'var(--bg-1)',
                        border: '1px solid var(--border)',
                        fontSize: 13,
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        maxHeight: 420,
                        overflowY: 'auto',
                      }}
                    >
                      {renderFormattedText(c.document_body)}
                    </div>
                  )}

                  {/* Callback number — pandas-serves tier, once paid, so a lawyer can call the client */}
                  {isPaid && c.delivery_option === 'pandas-serves' && c.client_phone && (
                    <div style={{
                      marginTop: 14,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'color-mix(in srgb, var(--secondary) 8%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--secondary) 25%, transparent)',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Phone size={14} strokeWidth={1.5} aria-hidden="true" />
                        Client requested a callback:
                      </span>
                      <a href={`tel:${c.client_phone}`} style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                        {c.client_phone}
                      </a>
                    </div>
                  )}

                  {/* No callback number captured — client will see a form to add one on their end,
                      but flag it here too since a case can sit like this until they come back. */}
                  {isPaid && c.delivery_option === 'pandas-serves' && !c.client_phone && (
                    <div style={{
                      marginTop: 14,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
                      fontSize: 13,
                      color: 'var(--danger)',
                    }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={14} strokeWidth={1.5} aria-hidden="true" />
                        No callback number on file yet for this pandas-serves case.
                      </span>
                    </div>
                  )}

                  {/* Timeline (demand-letter cases that have been paid) */}
                  {isDebt && isPaid && <CaseTimeline status={c.status} />}

                  {/* Under review — shown after payment, before a lawyer has reviewed the
                      document. No download exists anywhere in this state on purpose; the
                      reviewed copy only ever arrives by email. */}
                  {c.status === 'paid' && !c.reviewed_at && (
                    <div style={{
                      marginTop: 14, padding: '10px 14px', borderRadius: 10,
                      background: 'var(--accent-glow-soft)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                      fontSize: 13, color: 'var(--text-2)',
                    }}>
                      Your letter is with our legal team for review. You'll receive your reviewed copy by email once that's done.
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                    {/* Mark as Served — shown after payment AND after a lawyer has reviewed it */}
                    {isPaid && c.status === 'paid' && c.reviewed_at && (
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
                          background: 'var(--accent-glow-soft)',
                          border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                          borderRadius: 10,
                          padding: '12px 16px',
                          fontSize: 13,
                          color: 'var(--text-2)',
                          lineHeight: 1.6,
                        }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Court filing fee applies. </span>
                          The Small Claims Court charges a filing fee based on your claim amount, typically
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
