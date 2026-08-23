'use client'

import { Suspense, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase, authedFetch } from '@/lib/supabaseClient'
import { AGENTS } from '@/lib/agents'
import type { AgentId } from '@/lib/agents'
import { formatNaira } from '@/lib/formatNaira'
import { renderFormattedText } from '@/lib/renderFormattedText'
import { downloadTextDocument } from '@/lib/pdfGenerator'
import AudioReader from '@/components/AudioReader'
import TranslationPane from '@/components/TranslationPane'
import { Phone, AlertTriangle, Scale, Check, Clock } from 'lucide-react'

interface AdminCaseRow {
  id: string
  case_number: number
  user_id: string
  userEmail: string
  agent_id: string
  status: string
  document_title: string | null
  document_body: string | null
  amount_paid: number
  expected_amount: number | null
  delivery_option: string | null
  client_phone: string | null
  created_at: string
  paid_at: string | null
  deadline_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  reviewed_document_sent_at: string | null
  source: string | null
}

interface ServiceRecordRow {
  id: string
  channel: string
  recipient_phone: string
  status: 'dispatched' | 'link_opened' | 'acknowledged'
  dispatched_at: string
  link_opened_at: string | null
  acknowledged_at: string | null
  acknowledged_by: string | null
}

interface CustomClaimRow {
  id: string
  name: string
  email: string
  phone: string | null
  description: string
  amount_paid: number
  status: string
  notified: boolean
  created_at: string
}

interface WaitlistRow {
  id: string
  service: string
  email: string
  created_at: string
}

interface CaseMessage {
  role: 'user' | 'assistant'
  content: string
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

type CaseAction = 'markReviewed' | 'sendReviewedDocument' | 'markServed' | 'markFiled' | 'markJudgment' | 'markClosed'

const NEXT_ACTION: Record<string, { action: CaseAction; label: string } | undefined> = {
  letter_served: { action: 'markFiled', label: 'Mark Filed' },
  filed: { action: 'markJudgment', label: 'Mark Judgment Won' },
  judgment_obtained: { action: 'markClosed', label: 'Close Case' },
}

// 'paid' is the one status with two possible next steps depending on whether a lawyer has
// reviewed the document yet — a plain status->action lookup can't express that, so it's
// handled separately from the NEXT_ACTION map above.
function nextActionFor(c: AdminCaseRow): { action: CaseAction; label: string } | undefined {
  if (c.status === 'paid') {
    return c.reviewed_at
      ? { action: 'markServed', label: 'Mark Served' }
      : { action: 'markReviewed', label: 'Mark Reviewed' }
  }
  return NEXT_ACTION[c.status]
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
  deletingId,
  confirmDeleteId,
  regeneratingId,
  onAction,
  onDeleteAction,
  onRegenerateDocument,
  accentColor,
  domId,
}: {
  c: AdminCaseRow
  updatingId: string | null
  deletingId?: string | null
  confirmDeleteId?: string | null
  regeneratingId?: string | null
  onAction: (caseId: string, action: CaseAction) => void
  onDeleteAction?: (caseId: string, action: 'request' | 'cancel' | 'confirm') => void
  onRegenerateDocument?: (caseId: string) => void
  accentColor?: string
  domId?: string
}) {
  const agent = AGENTS[c.agent_id as AgentId]
  const next = nextActionFor(c)
  const [showLetter, setShowLetter] = useState(false)
  // Only a document that's actually been paid for AND reviewed by a lawyer is the real,
  // clean deliverable — everything before that (still drafting, paid-but-unreviewed) shows
  // the same watermarked version the client saw in their own preview, so staff never end up
  // with an unreviewed clean copy floating around just because they wanted to check on a lead.
  const isFinalClean = c.status === 'paid' && !!c.reviewed_at

  const [showInterview, setShowInterview] = useState(false)
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [interviewError, setInterviewError] = useState('')
  const [messages, setMessages] = useState<CaseMessage[] | null>(null)

  // Lets staff upload the actual reviewed-and-stamped PDF for this case so THAT file (not
  // the auto-generated one) is what "Send to Customer" attaches — see
  // app/api/admin/upload-reviewed-document/route.ts and lib/sendCaseEmail.ts.
  const [uploadingStamp, setUploadingStamp] = useState(false)
  const [stampError, setStampError] = useState('')
  const [stampUploaded, setStampUploaded] = useState(false)
  const stampInputRef = useRef<HTMLInputElement>(null)

  async function handleStampFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.type !== 'application/pdf') {
      setStampError('Please upload a PDF.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setStampError('File too large. Maximum size is 10 MB.')
      return
    }
    setStampError('')
    setUploadingStamp(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await authedFetch('/api/admin/upload-reviewed-document', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId: c.id, fileBase64: base64 }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setStampError(data.error || 'Upload failed. Please try again.')
        return
      }
      setStampUploaded(true)
    } catch {
      setStampError('Network error. Please try again.')
    } finally {
      setUploadingStamp(false)
    }
  }

  // WhatsApp service — see app/api/admin/service-records/route.ts and lib/whatsappService.ts.
  const [showServiceRecords, setShowServiceRecords] = useState(false)
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[] | null>(null)
  const [serviceRecordsLoading, setServiceRecordsLoading] = useState(false)
  const [serviceRecordsError, setServiceRecordsError] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [ackingId, setAckingId] = useState<string | null>(null)

  async function loadServiceRecords() {
    setServiceRecordsLoading(true)
    setServiceRecordsError('')
    try {
      const res = await authedFetch(`/api/admin/service-records?caseId=${c.id}`)
      const data = await res.json()
      if (!res.ok) { setServiceRecordsError(data.error || 'Failed to load service records.'); return }
      setServiceRecords(data.records ?? [])
    } catch {
      setServiceRecordsError('Network error. Please try again.')
    } finally {
      setServiceRecordsLoading(false)
    }
  }

  async function toggleServiceRecords() {
    if (showServiceRecords) { setShowServiceRecords(false); return }
    setShowServiceRecords(true)
    await loadServiceRecords()
  }

  async function dispatchWhatsAppService() {
    if (!c.client_phone) return
    setDispatching(true)
    setServiceRecordsError('')
    try {
      const res = await authedFetch('/api/admin/service-records', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId: c.id, phone: c.client_phone }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setServiceRecordsError(data.error || 'Failed to dispatch.')
        return
      }
      // Opens WhatsApp with the message pre-filled — staff still has to press send there
      // themselves; this app records the attempt, it can't press send on WhatsApp's behalf.
      window.open(data.whatsappLink, '_blank', 'noopener,noreferrer')
      await loadServiceRecords()
    } catch {
      setServiceRecordsError('Network error. Please try again.')
    } finally {
      setDispatching(false)
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

  async function toggleInterview() {
    if (showInterview) { setShowInterview(false); return }
    setShowInterview(true)
    if (messages) return // already loaded once — no need to refetch every toggle
    setInterviewLoading(true)
    setInterviewError('')
    try {
      const res = await authedFetch(`/api/admin/case-messages?caseId=${c.id}`)
      const data = await res.json()
      if (!res.ok) { setInterviewError(data.error || 'Failed to load the interview.'); return }
      setMessages(data.messages ?? [])
    } catch {
      setInterviewError('Network error. Please try again.')
    } finally {
      setInterviewLoading(false)
    }
  }

  return (
    <div id={domId} className="card" style={{ padding: '18px 22px', ...(accentColor ? { borderColor: accentColor } : {}) }}>
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
          <a href={`tel:${c.client_phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontWeight: 600 }}>
            <Phone size={13} strokeWidth={1.5} aria-hidden="true" /> {c.client_phone}
          </a>
        )}
        {!c.client_phone && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--danger)' }}>
            <AlertTriangle size={13} strokeWidth={1.5} aria-hidden="true" /> No contact number
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        {next && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={updatingId === c.id}
            onClick={() => onAction(c.id, next.action)}
          >
            {updatingId === c.id ? 'Updating…' : next.label}
          </button>
        )}
        {/* Recovery action for cases whose document never persisted — see the schema-drift
            note in app/api/admin/regenerate-document/route.ts. Only shown once a case has
            actually reached document drafting or beyond (status !== 'draft'); a case still
            mid-interview just hasn't gotten there yet, that's not a bug to recover from. */}
        {!c.document_body && c.status !== 'draft' && onRegenerateDocument && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={regeneratingId === c.id}
            onClick={() => onRegenerateDocument(c.id)}
          >
            {regeneratingId === c.id ? 'Regenerating…' : 'Regenerate from Conversation'}
          </button>
        )}
        {/* Staff can always download any drafted letter, paid or not — useful for following
            up on abandoned/unpaid leads on a sales call, not just reviewed-and-paid cases.
            Watermarked until it's actually paid AND reviewed — see isFinalClean above. */}
        {c.document_body && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => downloadTextDocument(c.document_title ?? 'Document', c.document_body!, { watermark: !isFinalClean })}
          >
            Download PDF
          </button>
        )}
        {/* Upload the actual signed/stamped PDF for this case — once present, that exact
            file (not the auto-generated one) is what "Send to Customer" attaches. Only
            shown once reviewed, matching "reviewed and stamped" being one step. */}
        {c.reviewed_at && (
          <>
            <input
              ref={stampInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handleStampFileSelect}
            />
            <button
              type="button"
              className="btn btn-sm"
              disabled={uploadingStamp}
              onClick={() => stampInputRef.current?.click()}
              title="Upload the signed/stamped PDF to send instead of the auto-generated one"
            >
              {uploadingStamp ? 'Uploading…' : stampUploaded ? 'Replace Stamped Document' : 'Upload Stamped Document'}
            </button>
            {stampUploaded && (
              <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <Check size={12} strokeWidth={2} aria-hidden="true" /> Stamped copy on file
              </span>
            )}
          </>
        )}
        {stampError && <span role="alert" style={{ color: 'var(--danger)', fontSize: 12 }}>{stampError}</span>}
        {c.status === 'paid' && c.reviewed_at && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={updatingId === c.id}
            onClick={() => onAction(c.id, 'sendReviewedDocument')}
          >
            {updatingId === c.id ? 'Sending…' : c.reviewed_document_sent_at ? 'Resend to Customer' : 'Send to Customer'}
          </button>
        )}
        {c.reviewed_document_sent_at && (
          <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <Check size={12} strokeWidth={2} aria-hidden="true" /> Sent {formatDate(c.reviewed_document_sent_at)}
          </span>
        )}
        {c.document_body && (
          <button type="button" className="btn btn-sm" onClick={() => setShowLetter((v) => !v)}>
            {showLetter ? 'Hide Letter' : 'View Letter'}
          </button>
        )}
        {/* Available on every case, letter drafted or not — the conversation itself is useful
            context for a lawyer follow-up call, and staff shouldn't lose access to it just
            because a document was drafted. */}
        <button type="button" className="btn btn-sm" onClick={toggleInterview}>
          {showInterview ? 'Hide Conversation' : 'View Conversation'}
        </button>
        {/* Needs a phone number and an actual document to serve — same gating as the
            "No contact number" warning shown above. */}
        {c.client_phone && c.document_body && (
          <button type="button" className="btn btn-sm" disabled={dispatching} onClick={dispatchWhatsAppService}>
            {dispatching ? 'Opening…' : 'Serve via WhatsApp'}
          </button>
        )}
        <button type="button" className="btn btn-sm" onClick={toggleServiceRecords}>
          {showServiceRecords ? 'Hide Service Log' : 'Service Log'}
        </button>
        {onDeleteAction && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {confirmDeleteId === c.id ? (
              <>
                <button type="button" className="btn btn-sm" onClick={() => onDeleteAction(c.id, 'cancel')}>Cancel</button>
                <button type="button" className="btn btn-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} disabled={deletingId === c.id} onClick={() => onDeleteAction(c.id, 'confirm')}>
                  {deletingId === c.id ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-sm" style={{ color: 'color-mix(in srgb, var(--text-muted) 60%, var(--danger))', borderColor: 'transparent' }} onClick={() => onDeleteAction(c.id, 'request')}>Delete</button>
            )}
          </div>
        )}
      </div>

      {showInterview && (
        <div
          style={{
            marginTop: 14,
            padding: '16px 18px',
            borderRadius: 10,
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            fontSize: 13,
            lineHeight: 1.7,
            maxHeight: 420,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {interviewLoading && <span style={{ color: 'var(--text-muted)' }}>Loading…</span>}
          {interviewError && <span style={{ color: 'var(--danger)' }}>{interviewError}</span>}
          {!interviewLoading && !interviewError && messages?.length === 0 && (
            <span style={{ color: 'var(--text-muted)' }}>No messages yet.</span>
          )}
          {!interviewLoading && messages?.map((m, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                {m.role === 'user' ? c.userEmail || 'Client' : 'Pandas LP Agent'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{renderFormattedText(m.content)}</div>
            </div>
          ))}
        </div>
      )}

      {showServiceRecords && (
        <div
          style={{
            marginTop: 14,
            padding: '16px 18px',
            borderRadius: 10,
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {serviceRecordsLoading && <span style={{ color: 'var(--text-muted)' }}>Loading…</span>}
          {serviceRecordsError && <span style={{ color: 'var(--danger)' }}>{serviceRecordsError}</span>}
          {!serviceRecordsLoading && serviceRecords?.length === 0 && (
            <span style={{ color: 'var(--text-muted)' }}>No service attempts recorded yet.</span>
          )}
          {!serviceRecordsLoading && serviceRecords?.map((r) => {
            const STATUS_LABEL: Record<ServiceRecordRow['status'], string> = {
              dispatched: 'Dispatched (staff sent — WhatsApp delivery not confirmed)',
              link_opened: 'Document link opened by recipient',
              acknowledged: 'Acknowledged by recipient',
            }
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div>{r.recipient_phone} <span style={{ color: 'var(--text-muted)' }}>· {STATUS_LABEL[r.status]}</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Dispatched {formatDate(r.dispatched_at)}
                    {r.link_opened_at && ` · Opened ${formatDate(r.link_opened_at)}`}
                    {r.acknowledged_at && ` · Acknowledged ${formatDate(r.acknowledged_at)} by ${r.acknowledged_by}`}
                  </div>
                </div>
                {r.status !== 'acknowledged' && (
                  <button type="button" className="btn btn-sm" disabled={ackingId === r.id} onClick={() => acknowledgeService(r.id)}>
                    {ackingId === r.id ? '…' : 'Mark Acknowledged'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showLetter && c.document_body && (
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
          {!isFinalClean && (
            <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--danger)' }}>
              SAMPLE: NOT FOR FILING
            </div>
          )}
          {renderFormattedText(c.document_body)}
          <AudioReader text={c.document_body} label="Listen to this letter" />
          {/* View-only — no replace action here. This document may already be reviewed/sent;
              silently swapping its text would bypass the mandatory lawyer-review gate. */}
          <TranslationPane originalText={c.document_body} allowReplace={false} />
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageInner />
    </Suspense>
  )
}

function AdminPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Deep link from the new-order alert email ("Click to Review Document →") — jump straight
  // to the Cases tab instead of the Queue, since that's the one with an unfiltered flat list
  // to scroll a specific case into view within.
  const deepLinkCaseId = searchParams.get('caseId')
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [tab, setTab] = useState<Tab>(deepLinkCaseId ? 'cases' : 'queue')

  const [cases, setCases] = useState<AdminCaseRow[]>([])
  const [claims, setClaims] = useState<CustomClaimRow[]>([])
  const [signups, setSignups] = useState<WaitlistRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  const [filterEmail, setFilterEmail] = useState('')
  // Defaults to all statuses — staff need visibility into unpaid/draft cases too (conversations
  // and drafted letters are useful for lawyer follow-up calls before a case ever gets paid).
  // "Paid+" is still available in the dropdown for when a paid-only view is actually wanted.
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

  useEffect(() => {
    if (!deepLinkCaseId || cases.length === 0) return
    document.getElementById(`case-${deepLinkCaseId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [deepLinkCaseId, cases])

  async function loadTab(which: Tab, overrideStatus?: string) {
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
        // "has_document" isn't a real case status — a case keeps its document_body forever
        // once drafted, but its `status` keeps moving (paid, letter_served, filed…), so
        // filtering by an exact status like "document_ready" only ever shows cases still
        // sitting at that one stage, hiding every drafted letter that went on to get paid,
        // served, etc. This option is handled client-side instead: fetch everything (no
        // status param) and keep only rows that actually have a letter.
        const statusToUse = overrideStatus !== undefined ? overrideStatus : filterStatus
        const hasDocumentOnly = statusToUse === 'has_document'
        const params = new URLSearchParams()
        if (filterEmail) params.set('email', filterEmail)
        if (statusToUse && !hasDocumentOnly) params.set('status', statusToUse)
        if (filterAgent) params.set('agentId', filterAgent)
        const res = await authedFetch(`/api/admin/cases?${params.toString()}`)
        if (res.status === 403) { setAccessDenied(true); return }
        const data = await res.json()
        if (!res.ok) { setLoadError(data.error || 'Failed to load cases.'); return }
        const loaded: AdminCaseRow[] = data.cases ?? []
        setCases(hasDocumentOnly ? loaded.filter((c) => c.document_body) : loaded)
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

  async function handleStatusAction(caseId: string, action: CaseAction) {
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

  async function handleDeleteAction(caseId: string, action: 'request' | 'cancel' | 'confirm') {
    if (action === 'request') {
      setConfirmDeleteId(caseId)
    } else if (action === 'cancel') {
      setConfirmDeleteId(null)
    } else if (action === 'confirm') {
      setDeletingId(caseId)
      try {
        const res = await authedFetch(`/api/admin/cases?caseId=${caseId}`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          setLoadError(data.error || 'Could not delete this case.')
          return
        }
        // Optimistic UI update
        setCases((prev) => prev.filter((c) => c.id !== caseId))
        setConfirmDeleteId(null)
      } catch {
        setLoadError('Network error. Please try again.')
      } finally {
        setDeletingId(null)
      }
    }
  }

  async function handleRegenerateDocument(caseId: string) {
    setRegeneratingId(caseId)
    setLoadError('')
    try {
      const res = await authedFetch('/api/admin/regenerate-document', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not regenerate this document.')
        return
      }
      await loadTab(tab)
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setRegeneratingId(null)
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

        <div role="tablist" aria-label="Admin sections" style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
          {(['queue', 'cases', 'claims', 'waitlist'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              style={{
                position: 'relative',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 4px', marginRight: 20, fontSize: 14, fontWeight: 600,
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {t === 'queue' ? 'Queue' : t === 'cases' ? 'Cases' : t === 'claims' ? 'Custom Claims' : 'Waitlist Signups'}
              {tab === t && (
                <motion.div
                  layoutId="admin-tab-underline"
                  style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: 'var(--accent)' }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                />
              )}
            </button>
          ))}
        </div>

        {loadError && (
          <div role="alert" className="card" style={{ borderColor: 'var(--danger)', marginBottom: 20, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--danger)', fontSize: 14 }}>{loadError}</span>
            <button type="button" className="btn btn-sm" onClick={() => setLoadError('')}>Dismiss</button>
          </div>
        )}

        <div role="tabpanel">

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
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                    <AlertTriangle size={16} strokeWidth={1.5} aria-hidden="true" />
                    Awaiting review or serving {unserved.length > 0 && `(${unserved.length})`}
                  </h2>
                  {unserved.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>Nothing waiting on review or serving.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
                    {unserved.map((c) => {
                      const daysSincePaid = Math.floor((now - new Date(c.paid_at ?? c.created_at).getTime()) / DAY_MS)
                      return (
                        <CaseCard
                          key={c.id}
                          c={c}
                          updatingId={updatingId}
                          deletingId={deletingId}
                          confirmDeleteId={confirmDeleteId}
                          regeneratingId={regeneratingId}
                          onRegenerateDocument={handleRegenerateDocument}
                          onAction={handleStatusAction}
                          onDeleteAction={handleDeleteAction}
                          accentColor={daysSincePaid >= 3 ? 'var(--danger)' : undefined}
                        />
                      )
                    })}
                  </div>

                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                    <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
                    Deadline passed {deadlinePassed.length > 0 && `(${deadlinePassed.length})`}
                  </h2>
                  {deadlinePassed.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>No cases past their response deadline.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
                    {deadlinePassed.map((c) => (
                      <CaseCard key={c.id} c={c} updatingId={updatingId} deletingId={deletingId} confirmDeleteId={confirmDeleteId} regeneratingId={regeneratingId} onAction={handleStatusAction} onDeleteAction={handleDeleteAction} onRegenerateDocument={handleRegenerateDocument} accentColor="var(--warning)" />
                    ))}
                  </div>

                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                    <Scale size={16} strokeWidth={1.5} aria-hidden="true" />
                    Filed, awaiting judgment {awaitingJudgment.length > 0 && `(${awaitingJudgment.length})`}
                  </h2>
                  {awaitingJudgment.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>No cases waiting on a judgment.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {awaitingJudgment.map((c) => (
                      <CaseCard key={c.id} c={c} updatingId={updatingId} deletingId={deletingId} confirmDeleteId={confirmDeleteId} regeneratingId={regeneratingId} onAction={handleStatusAction} onDeleteAction={handleDeleteAction} onRegenerateDocument={handleRegenerateDocument} />
                    ))}
                  </div>
                </>
              )}
            </>
          )
        })()}

        {tab === 'cases' && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <input
                className="input"
                aria-label="Filter by client email"
                placeholder="Filter by client email…"
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') loadTab('cases') }}
                style={{ maxWidth: 240, fontSize: 13 }}
              />
              <select className="input" aria-label="Filter by agent" value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} style={{ maxWidth: 200, fontSize: 13 }}>
                <option value="">All agents</option>
                {Object.values(AGENTS).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => loadTab('cases')}>Apply Search</button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
              {[
                { value: '', label: 'All' },
                { value: 'paid_plus', label: 'Paid+ (real customers)' },
                { value: 'has_document', label: 'Has Letter (any stage)' },
                ...Object.entries(STAGE_LABEL).map(([k, v]) => ({ value: k, label: v }))
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`btn btn-sm ${filterStatus === opt.value ? '' : 'btn-ghost'}`}
                  style={{ 
                    fontSize: 12, 
                    padding: '6px 12px',
                    ...(filterStatus === opt.value ? { background: 'var(--accent)', color: 'var(--bg)', borderColor: 'var(--accent)' } : {})
                  }}
                  onClick={() => {
                    setFilterStatus(opt.value)
                    loadTab('cases', opt.value)
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
            {!loading && cases.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No cases match these filters.</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cases.map((c) => (
                <CaseCard
                  key={c.id}
                  c={c}
                  updatingId={updatingId}
                  deletingId={deletingId}
                  confirmDeleteId={confirmDeleteId}
                  regeneratingId={regeneratingId}
                  onAction={handleStatusAction}
                  onDeleteAction={handleDeleteAction}
                  onRegenerateDocument={handleRegenerateDocument}
                  domId={`case-${c.id}`}
                  accentColor={c.id === deepLinkCaseId ? 'var(--accent)' : undefined}
                />
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
                <div
                  key={claim.id}
                  className="card"
                  style={{ padding: '18px 22px', ...(claim.notified ? {} : { borderColor: 'var(--danger)' }) }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>{claim.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                        {claim.email}{claim.phone ? ` · ${claim.phone}` : ''} · {formatDate(claim.created_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {!claim.notified && (
                        <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                          <AlertTriangle size={12} strokeWidth={1.5} aria-hidden="true" /> Needs response: notification never sent
                        </span>
                      )}
                      <span className="badge">{formatNaira(claim.amount_paid)}</span>
                    </div>
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
        </div>
      </main>
    </div>
  )
}
