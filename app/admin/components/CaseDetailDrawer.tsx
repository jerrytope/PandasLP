'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { AGENTS, type AgentId } from '@/lib/agents'
import { formatNaira } from '@/lib/formatNaira'
import { renderFormattedText } from '@/lib/renderFormattedText'
import AudioReader from '@/components/AudioReader'
import TranslationPane from '@/components/TranslationPane'
import RecoveryPanel from '@/components/RecoveryPanel'
import NegotiationPanel from '@/components/NegotiationPanel'
import CaseReviewStepper from './CaseReviewStepper'
import CaseActionMenu from './CaseActionMenu'
import {
  formatDate,
  STAGE_LABEL,
  STAGE_BADGE_STYLE,
  nextActionFor,
  type AdminCaseRow,
  type CaseAction,
  type CaseMessage,
  type CaseEvidenceRow,
  type ServiceRecordRow,
} from './types'
import {
  X,
  FileText,
  MessageSquare,
  Paperclip,
  Phone,
  Mail,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  DollarSign,
  Send,
} from 'lucide-react'

interface CaseDetailDrawerProps {
  c: AdminCaseRow | null
  onClose: () => void
  updatingId: string | null
  deletingId?: string | null
  confirmDeleteId?: string | null
  regeneratingId?: string | null
  togglingTestId?: string | null
  secondReviewingId?: string | null
  savingClientEmailId?: string | null
  savingRecipientPhoneId?: string | null
  onAction: (caseId: string, action: CaseAction, reviewChecklist?: Record<string, boolean>) => void
  onDeleteAction?: (caseId: string, action: 'request' | 'cancel' | 'confirm') => void
  onRegenerateDocument?: (caseId: string) => void
  onToggleTest?: (caseId: string, isTest: boolean) => void
  onSecondReview?: (caseId: string, email: string) => void
  onSaveClientEmail?: (caseId: string, email: string) => void
  onSaveRecipientPhone?: (caseId: string, phone: string) => void
  onReloadCase?: () => void
}

type DrawerTab = 'document' | 'interview' | 'evidence' | 'service' | 'negotiation'

export default function CaseDetailDrawer({
  c,
  onClose,
  updatingId,
  deletingId,
  confirmDeleteId,
  regeneratingId,
  togglingTestId,
  secondReviewingId,
  savingClientEmailId,
  savingRecipientPhoneId,
  onAction,
  onDeleteAction,
  onRegenerateDocument,
  onToggleTest,
  onSecondReview,
  onSaveClientEmail,
  onSaveRecipientPhone,
  onReloadCase,
}: CaseDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('document')

  // Inline metadata inputs
  const [clientEmailInput, setClientEmailInput] = useState('')
  const [recipientPhoneInput, setRecipientPhoneInput] = useState('')

  // Interview messages state
  const [messages, setMessages] = useState<CaseMessage[] | null>(null)
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [interviewError, setInterviewError] = useState('')

  // Evidence files state
  const [evidence, setEvidence] = useState<CaseEvidenceRow[] | null>(null)
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [evidenceError, setEvidenceError] = useState('')

  // Service records state
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[] | null>(null)
  const [serviceRecordsLoading, setServiceRecordsLoading] = useState(false)
  const [serviceRecordsError, setServiceRecordsError] = useState('')
  const [ackingId, setAckingId] = useState<string | null>(null)

  // Sync inputs on case change
  useEffect(() => {
    if (c) {
      setClientEmailInput(c.client_email ?? '')
      setRecipientPhoneInput(c.recipient_phone ?? '')
      setMessages(null)
      setEvidence(null)
      setServiceRecords(null)
      setActiveTab(c.document_body ? 'document' : 'interview')
    }
  }, [c?.id])

  // Escape key closes drawer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!c) return null

  const agent = AGENTS[c.agent_id as AgentId]
  const next = nextActionFor(c)
  const badgeStyle = STAGE_BADGE_STYLE[c.status] ?? STAGE_BADGE_STYLE.draft
  const isMoneyAgent = c.agent_id === 'small-claims' || c.agent_id === 'judgment-enforcement'

  async function loadInterview() {
    if (!c || messages) return
    setInterviewLoading(true)
    setInterviewError('')
    try {
      const res = await authedFetch(`/api/admin/case-messages?caseId=${c.id}`)
      const data = await res.json()
      if (!res.ok) {
        setInterviewError(data.error || 'Failed to load interview.')
        return
      }
      setMessages(data.messages ?? [])
    } catch {
      setInterviewError('Network error. Please try again.')
    } finally {
      setInterviewLoading(false)
    }
  }

  async function loadEvidence() {
    if (!c) return
    setEvidenceLoading(true)
    setEvidenceError('')
    try {
      const res = await authedFetch(`/api/admin/case-evidence?caseId=${c.id}`)
      const data = await res.json()
      if (!res.ok) {
        setEvidenceError(data.error || 'Failed to load evidence.')
        return
      }
      setEvidence(data.evidence ?? [])
    } catch {
      setEvidenceError('Network error. Please try again.')
    } finally {
      setEvidenceLoading(false)
    }
  }

  async function loadServiceRecords() {
    if (!c) return
    setServiceRecordsLoading(true)
    setServiceRecordsError('')
    try {
      const res = await authedFetch(`/api/admin/service-records?caseId=${c.id}`)
      const data = await res.json()
      if (!res.ok) {
        setServiceRecordsError(data.error || 'Failed to load service records.')
        return
      }
      setServiceRecords(data.records ?? [])
    } catch {
      setServiceRecordsError('Network error. Please try again.')
    } finally {
      setServiceRecordsLoading(false)
    }
  }

  async function acknowledgeService(recordId: string) {
    setAckingId(recordId)
    try {
      const res = await authedFetch('/api/admin/service-records', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recordId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setServiceRecordsError(data.error || 'Failed to update.')
        return
      }
      await loadServiceRecords()
    } catch {
      setServiceRecordsError('Network error. Please try again.')
    } finally {
      setAckingId(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(2px)',
      }}
    >
      {/* Backdrop click */}
      <div style={{ flex: 1 }} onClick={onClose} />

      {/* Drawer Container */}
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          background: 'var(--bg-0)',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
          borderLeft: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '16px 24px',
            background: 'var(--bg-2)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--accent)',
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--accent-glow-soft)',
                border: '1px solid var(--accent-glow)',
              }}
            >
              #{c.case_number || c.id.slice(0, 6)}
            </span>

            <h2
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--text-1)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {c.document_title || agent?.name || 'Untitled Matter'}
            </h2>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span
                className="badge"
                style={{
                  background: badgeStyle.bg,
                  color: badgeStyle.color,
                  borderColor: badgeStyle.border,
                }}
              >
                {STAGE_LABEL[c.status] ?? c.status}
              </span>

              {c.is_test && (
                <span
                  className="badge"
                  style={{ background: 'rgba(107,114,128,0.15)', color: 'var(--text-3)' }}
                >
                  TEST LEAD
                </span>
              )}

              {c.negotiationStatus === 'awaiting_our_reply' && (
                <span
                  className="badge badge-danger"
                  style={{ animation: 'pulse 2s infinite' }}
                >
                  COUNTER RECEIVED
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CaseActionMenu
              c={c}
              updatingId={updatingId}
              deletingId={deletingId}
              confirmDeleteId={confirmDeleteId}
              regeneratingId={regeneratingId}
              togglingTestId={togglingTestId}
              onAction={onAction}
              onDeleteAction={onDeleteAction}
              onRegenerateDocument={onRegenerateDocument}
              onToggleTest={onToggleTest}
            />

            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm"
              style={{ padding: 8, borderRadius: '50%', minHeight: 36, width: 36 }}
              aria-label="Close drawer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Body - Split View (Left Content Tabs, Right Sticky Metadata/Actions) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* LEFT: Tab Navigation + Content Area */}
          <div
            style={{
              flex: '1 1 60%',
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--border-subtle)',
              background: 'var(--bg-0)',
              overflow: 'hidden',
            }}
          >
            {/* Tab Bar */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: '8px 16px',
                background: 'var(--bg-2)',
                borderBottom: '1px solid var(--border-subtle)',
                overflowX: 'auto',
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'document' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 14px', fontSize: 13, gap: 6 }}
                onClick={() => setActiveTab('document')}
              >
                <FileText size={14} /> Legal Document
              </button>

              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'interview' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 14px', fontSize: 13, gap: 6 }}
                onClick={() => {
                  setActiveTab('interview')
                  loadInterview()
                }}
              >
                <MessageSquare size={14} /> Interview Transcript
              </button>

              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'evidence' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 14px', fontSize: 13, gap: 6 }}
                onClick={() => {
                  setActiveTab('evidence')
                  loadEvidence()
                }}
              >
                <Paperclip size={14} /> Evidence Files
              </button>

              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'service' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 14px', fontSize: 13, gap: 6 }}
                onClick={() => {
                  setActiveTab('service')
                  loadServiceRecords()
                }}
              >
                <Send size={14} /> Service Log
              </button>

              {isMoneyAgent && (
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'negotiation' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '6px 14px', fontSize: 13, gap: 6 }}
                  onClick={() => setActiveTab('negotiation')}
                >
                  <Scale size={14} /> Recoveries & Counter
                </button>
              )}
            </div>

            {/* Tab Contents */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {/* TAB 1: Document */}
              {activeTab === 'document' && (
                <div>
                  {c.document_body ? (
                    <div
                      style={{
                        background: 'var(--bg-2)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: 24,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        fontSize: 14,
                        lineHeight: 1.7,
                      }}
                    >
                      {c.status !== 'paid' || !c.reviewed_at ? (
                        <div
                          style={{
                            marginBottom: 14,
                            padding: '6px 12px',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            color: 'var(--danger)',
                          }}
                        >
                          PREVIEW / WATERMARKED DRAFT (UNREVIEWED)
                        </div>
                      ) : (
                        <div
                          style={{
                            marginBottom: 14,
                            padding: '6px 12px',
                            background: 'rgba(22,163,74,0.08)',
                            border: '1px solid rgba(22,163,74,0.2)',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            color: '#16a34a',
                          }}
                        >
                          OFFICIAL REVIEWED & VERIFIED DOCUMENT
                        </div>
                      )}

                      <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-1)' }}>
                        {renderFormattedText(c.document_body)}
                      </div>

                      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                        <AudioReader text={c.document_body} label="Listen to Drafted Letter" />
                        <TranslationPane originalText={c.document_body} allowReplace={false} />
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '48px 24px',
                        color: 'var(--text-3)',
                      }}
                    >
                      <FileText size={40} strokeWidth={1.2} style={{ margin: '0 auto 12px' }} />
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>
                        No legal document generated yet
                      </div>
                      <p style={{ fontSize: 13, marginTop: 4 }}>
                        The client is either still in the intake interview or the document failed to compile.
                      </p>
                      {onRegenerateDocument && c.status !== 'draft' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: 16 }}
                          disabled={regeneratingId === c.id}
                          onClick={() => onRegenerateDocument(c.id)}
                        >
                          {regeneratingId === c.id ? 'Regenerating…' : 'Generate from Interview Transcript'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Interview */}
              {activeTab === 'interview' && (
                <div>
                  {interviewLoading && <p style={{ color: 'var(--text-3)' }}>Loading conversation…</p>}
                  {interviewError && <p style={{ color: 'var(--danger)' }}>{interviewError}</p>}
                  {!interviewLoading && !interviewError && messages?.length === 0 && (
                    <p style={{ color: 'var(--text-3)' }}>No conversation records found.</p>
                  )}
                  {!interviewLoading && messages && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {messages.map((m, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-md)',
                            background: m.role === 'user' ? 'var(--bg-1)' : 'var(--bg-2)',
                            border: `1px solid ${m.role === 'user' ? 'var(--border-subtle)' : 'var(--accent-glow)'}`,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              color: m.role === 'user' ? 'var(--text-2)' : 'var(--accent)',
                              marginBottom: 4,
                            }}
                          >
                            <span>{m.role === 'user' ? c.userEmail || 'Client' : `${agent?.name ?? 'Pandas LP'} AI Agent`}</span>
                            <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>{formatDate(m.created_at)}</span>
                          </div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-1)' }}>
                            {renderFormattedText(m.content)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Evidence */}
              {activeTab === 'evidence' && (
                <div>
                  {evidenceLoading && <p style={{ color: 'var(--text-3)' }}>Loading uploaded evidence…</p>}
                  {evidenceError && <p style={{ color: 'var(--danger)' }}>{evidenceError}</p>}
                  {!evidenceLoading && !evidenceError && evidence?.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
                      <Paperclip size={32} style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontSize: 14 }}>No evidence files uploaded for this case.</div>
                    </div>
                  )}
                  {!evidenceLoading && evidence && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {evidence.map((ev) => {
                        const kb = ev.sizeBytes ? ev.sizeBytes / 1024 : null
                        const sizeLabel = kb == null ? null : kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`
                        return (
                          <div
                            key={ev.id}
                            className="card"
                            style={{ padding: '14px 18px', background: 'var(--bg-2)' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                {ev.url ? (
                                  <a href={ev.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>
                                    {ev.filename} ↗
                                  </a>
                                ) : (
                                  <span style={{ fontWeight: 600, fontSize: 14 }}>{ev.filename}</span>
                                )}
                                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                                  {ev.mediaType} {sizeLabel ? `· ${sizeLabel}` : ''} · {formatDate(ev.createdAt)}
                                </div>
                              </div>
                            </div>
                            {ev.extractedFacts && (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: 10,
                                  borderRadius: 4,
                                  background: 'var(--bg-1)',
                                  fontSize: 12.5,
                                  lineHeight: 1.5,
                                  color: 'var(--text-2)',
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                <strong style={{ color: 'var(--text-1)', display: 'block', marginBottom: 4 }}>
                                  AI Extracted Facts:
                                </strong>
                                {renderFormattedText(ev.extractedFacts)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Service Log */}
              {activeTab === 'service' && (
                <div>
                  {serviceRecordsLoading && <p style={{ color: 'var(--text-3)' }}>Loading service history…</p>}
                  {serviceRecordsError && <p style={{ color: 'var(--danger)' }}>{serviceRecordsError}</p>}
                  {!serviceRecordsLoading && !serviceRecordsError && serviceRecords?.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
                      <Send size={32} style={{ margin: '0 auto 10px', color: 'var(--text-3)' }} />
                      <div style={{ fontSize: 14 }}>No service dispatches recorded yet.</div>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                        Use the "Serve Debtor via WhatsApp" button on the right to dispatch formal service.
                      </p>
                    </div>
                  )}
                  {!serviceRecordsLoading && serviceRecords && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {serviceRecords.map((r) => (
                        <div
                          key={r.id}
                          className="card"
                          style={{
                            padding: '12px 16px',
                            background: 'var(--bg-2)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 12,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {r.recipient_phone}{' '}
                              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
                                (WhatsApp Service)
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                              Dispatched: {formatDate(r.dispatched_at)}
                              {r.link_opened_at && ` · Link Opened: ${formatDate(r.link_opened_at)}`}
                              {r.acknowledged_at && ` · Acknowledged: ${formatDate(r.acknowledged_at)}`}
                            </div>
                          </div>

                          <div>
                            {r.status === 'acknowledged' ? (
                              <span className="badge badge-green" style={{ fontSize: 11 }}>
                                ✓ Acknowledged by {r.acknowledged_by}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={ackingId === r.id}
                                onClick={() => acknowledgeService(r.id)}
                              >
                                {ackingId === r.id ? '…' : 'Mark Acknowledged'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Recoveries & Negotiation */}
              {activeTab === 'negotiation' && isMoneyAgent && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <RecoveryPanel caseId={c.id} expectedAmount={c.expected_amount} />
                  <NegotiationPanel caseId={c.id} caseTitle={c.document_title} recipientPhone={c.recipient_phone} />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Sticky Operations & Metadata Panel */}
          <div
            style={{
              flex: '1 1 40%',
              background: 'var(--bg-1)',
              overflowY: 'auto',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Metadata Card: Client & Debtor Contact Details */}
            <div
              className="card"
              style={{
                padding: '16px 18px',
                background: 'var(--bg-2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Matter Contacts & Parties
              </div>

              {/* Client Email Updater */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Mail size={12} /> Client Delivery Email
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="email"
                    className="input"
                    value={clientEmailInput}
                    onChange={(e) => setClientEmailInput(e.target.value)}
                    placeholder="Client email address"
                    style={{ minHeight: 34, fontSize: 13, padding: '6px 10px' }}
                  />
                  {onSaveClientEmail && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ minHeight: 34, padding: '4px 10px', fontSize: 12 }}
                      disabled={savingClientEmailId === c.id || clientEmailInput.trim() === (c.client_email ?? '')}
                      onClick={() => onSaveClientEmail(c.id, clientEmailInput.trim())}
                    >
                      {savingClientEmailId === c.id ? '…' : 'Save'}
                    </button>
                  )}
                </div>
                {c.client_email && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, display: 'block' }}>
                    Deliveries routed to this email instead of {c.userEmail || 'account'}.
                  </span>
                )}
              </div>

              {/* Client Phone */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Phone size={12} /> Client Direct Phone
                </label>
                {c.client_phone ? (
                  <a
                    href={`tel:${c.client_phone}`}
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {c.client_phone} ↗
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} /> No client phone recorded
                  </span>
                )}
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />

              {/* Debtor / Recipient Phone (For WhatsApp Service) */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Shield size={12} /> Debtor / Recipient Phone (Service Target)
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="tel"
                    className="input"
                    value={recipientPhoneInput}
                    onChange={(e) => setRecipientPhoneInput(e.target.value)}
                    placeholder="Debtor WhatsApp number"
                    style={{ minHeight: 34, fontSize: 13, padding: '6px 10px' }}
                  />
                  {onSaveRecipientPhone && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ minHeight: 34, padding: '4px 10px', fontSize: 12 }}
                      disabled={savingRecipientPhoneId === c.id || recipientPhoneInput.trim() === (c.recipient_phone ?? '')}
                      onClick={() => onSaveRecipientPhone(c.id, recipientPhoneInput.trim())}
                    >
                      {savingRecipientPhoneId === c.id ? '…' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Financials & Delivery Tier */}
            <div
              className="card"
              style={{
                padding: '14px 18px',
                background: 'var(--bg-2)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Amount Paid</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a', marginTop: 2 }}>
                  {formatNaira(c.amount_paid)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Quoted Value</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginTop: 2 }}>
                  {c.expected_amount ? formatNaira(c.expected_amount) : '—'}
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-2)' }}>
                <span>Delivery: <strong>{c.delivery_option || 'Standard'}</strong></span>
                <span style={{ margin: '0 8px' }}>·</span>
                <span>Created: {formatDate(c.created_at)}</span>
              </div>
            </div>

            {/* Review & Stamping Stepper (if Paid) */}
            {c.status === 'paid' && (
              <CaseReviewStepper
                c={c}
                updatingId={updatingId}
                onAction={onAction}
                onSecondReview={onSecondReview}
                secondReviewingId={secondReviewingId}
                onReloadCase={onReloadCase}
              />
            )}

            {/* Next Lifecycle Transition Button (if beyond 'paid' or letter ready) */}
            {next && next.action !== 'markReviewed' && (
              <div
                className="card"
                style={{
                  padding: '16px 18px',
                  background: 'var(--bg-2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>
                  Next Lifecycle Stage
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={updatingId === c.id}
                  onClick={() => onAction(c.id, next.action)}
                >
                  {updatingId === c.id ? 'Advancing…' : next.label}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
