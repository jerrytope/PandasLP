'use client'

import { Suspense, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase, authedFetch } from '@/lib/supabaseClient'
import RecoveryPanel from '@/components/RecoveryPanel'
import NegotiationPanel from '@/components/NegotiationPanel'
import { AGENTS } from '@/lib/agents'
import type { AgentId } from '@/lib/agents'
import { getAgentPayment } from '@/lib/agentServiceMap'
import AgentChat from '@/components/AgentChat'
import { getReviewChecklist, isHighRiskDocument } from '@/lib/reviewChecklists'
import { formatNaira } from '@/lib/formatNaira'
import { renderFormattedText } from '@/lib/renderFormattedText'
import { downloadTextDocument, buildStampedDocument } from '@/lib/pdfGenerator'
import { downloadDemandLetterDocx } from '@/lib/docxGenerator'
import AudioReader from '@/components/AudioReader'
import TranslationPane from '@/components/TranslationPane'
import { Phone, AlertTriangle, Scale, Check, Clock, Mail } from 'lucide-react'

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
  client_email: string | null
  recipient_phone: string | null
  // Computed server-side from actual storage contents, not a stored column — see
  // app/api/admin/cases/route.ts's own comment for why. True once a reviewed-and-stamped
  // PDF exists for this case, whether uploaded manually or via Attach Stamp's confirm step.
  hasStampedDocument: boolean
  // Derived from the latest case_negotiations row, not a stored column — see
  // app/api/admin/cases/route.ts's own comment. null means no negotiation thread exists yet.
  negotiationStatus: 'awaiting_our_reply' | 'awaiting_their_reply' | null
  created_at: string
  paid_at: string | null
  deadline_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  reviewed_document_sent_at: string | null
  source: string | null
  is_test: boolean
  review_checklist: Record<string, boolean> | null
  second_reviewer_email: string | null
  second_reviewed_at: string | null
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

interface CaseEvidenceRow {
  id: string
  filename: string
  mediaType: string
  sizeBytes: number | null
  extractedFacts: string | null
  createdAt: string
  url: string | null
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

type CaseAction = 'markReviewed' | 'sendReviewedDocument' | 'markServed' | 'markFiled' | 'markJudgment' | 'markClosed' | 'markPaidOffline'

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
  onToggleTest,
  togglingTestId,
  onSecondReview,
  secondReviewingId,
  onSaveClientEmail,
  savingClientEmailId,
  onSaveRecipientPhone,
  savingRecipientPhoneId,
  accentColor,
  domId,
}: {
  c: AdminCaseRow
  updatingId: string | null
  deletingId?: string | null
  confirmDeleteId?: string | null
  regeneratingId?: string | null
  onAction: (caseId: string, action: CaseAction, reviewChecklist?: Record<string, boolean>) => void
  onDeleteAction?: (caseId: string, action: 'request' | 'cancel' | 'confirm') => void
  onRegenerateDocument?: (caseId: string) => void
  onToggleTest?: (caseId: string, isTest: boolean) => void
  togglingTestId?: string | null
  onSecondReview?: (caseId: string, email: string) => void
  secondReviewingId?: string | null
  onSaveClientEmail?: (caseId: string, email: string) => void
  savingClientEmailId?: string | null
  onSaveRecipientPhone?: (caseId: string, phone: string) => void
  savingRecipientPhoneId?: string | null
  accentColor?: string
  domId?: string
}) {
  const agent = AGENTS[c.agent_id as AgentId]
  const next = nextActionFor(c)
  const [showLetter, setShowLetter] = useState(false)
  const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>(c.review_checklist ?? {})
  const [secondReviewerEmail, setSecondReviewerEmail] = useState('')
  const [clientEmailInput, setClientEmailInput] = useState(c.client_email ?? '')
  const [recipientPhoneInput, setRecipientPhoneInput] = useState(c.recipient_phone ?? '')
  // Only a document that's actually been paid for AND reviewed by a lawyer is the real,
  // clean deliverable — everything before that (still drafting, paid-but-unreviewed) shows
  // the same watermarked version the client saw in their own preview, so staff never end up
  // with an unreviewed clean copy floating around just because they wanted to check on a lead.
  // This gates the in-page "SAMPLE: NOT FOR FILING" banner below — it does NOT gate the DOCX
  // download (see canDownloadReviewCopy), which is deliberately available before review: that
  // download IS the reviewer's editable working copy, not a preview of the final letter.
  const isFinalClean = c.status === 'paid' && !!c.reviewed_at
  // Once a case is paid, staff need the real, unwatermarked, editable letter to actually
  // review it — a watermarked read-only PDF can't be marked up. See lib/docxGenerator.js's
  // own "INTERNAL REVIEW COPY" footer, which is what keeps this from being confused with a
  // final, sendable document even though it carries no watermark.
  const canDownloadReviewCopy = c.status === 'paid'
  const [downloadingDocx, setDownloadingDocx] = useState(false)

  const [showInterview, setShowInterview] = useState(false)
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [interviewError, setInterviewError] = useState('')
  const [messages, setMessages] = useState<CaseMessage[] | null>(null)

  const [showEvidence, setShowEvidence] = useState(false)
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [evidenceError, setEvidenceError] = useState('')
  const [evidence, setEvidence] = useState<CaseEvidenceRow[] | null>(null)

  // Lets staff upload the actual reviewed-and-stamped PDF for this case so THAT file (not
  // the auto-generated one) is what "Send to Customer" attaches — see
  // app/api/admin/upload-reviewed-document/route.ts and lib/sendCaseEmail.ts.
  const [uploadingStamp, setUploadingStamp] = useState(false)
  const [stampError, setStampError] = useState('')
  const [stampUploaded, setStampUploaded] = useState(false)
  const stampInputRef = useRef<HTMLInputElement>(null)

  // Shared by both paths onto the same endpoint: a staff member's own externally-stamped PDF
  // (handleStampFileSelect) and the one-click "Attach Stamp" flow below, which generates the
  // PDF in-browser instead of asking staff to produce one outside the app first.
  async function uploadReviewedBase64(base64: string) {
    setStampError('')
    setUploadingStamp(true)
    try {
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
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    await uploadReviewedBase64(base64)
  }

  // The one-click path: build the reviewed letter with Adedeji Adeyemo's real NBA stamp
  // placed over the signature line (see lib/pdfGenerator.js's buildStampedDocument), open it
  // in a new tab so staff can actually look at it, and hold the same generated file's base64
  // ready — confirmStampUpload sends that exact previewed file, never a freshly regenerated
  // one, so what gets uploaded is guaranteed to be what was just reviewed.
  const [stampPreviewBase64, setStampPreviewBase64] = useState<string | null>(null)
  const [generatingStamp, setGeneratingStamp] = useState(false)

  function handleAttachStamp() {
    if (!c.document_title || !c.document_body) return
    setStampError('')
    setGeneratingStamp(true)
    try {
      const doc = buildStampedDocument(c.document_title, c.document_body)
      const blobUrl = doc.output('bloburl') // a URL instance, not a string — see jspdf's types
      setStampPreviewBase64(doc.output('datauristring').split(',')[1])
      window.open(blobUrl.toString(), '_blank', 'noopener')
    } catch (err) {
      console.error('Failed to generate stamped document:', err)
      setStampError('Could not generate the stamped document. Please try again.')
    } finally {
      setGeneratingStamp(false)
    }
  }

  async function confirmStampUpload() {
    if (!stampPreviewBase64) return
    await uploadReviewedBase64(stampPreviewBase64)
    setStampPreviewBase64(null)
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
    // The debtor's number, not the client's — see recipient_phone's own comment in
    // supabase-schema.sql. Serving to the client's own phone would defeat the point of service.
    if (!c.recipient_phone) return
    setDispatching(true)
    setServiceRecordsError('')
    try {
      const res = await authedFetch('/api/admin/service-records', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId: c.id, phone: c.recipient_phone }),
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

  async function toggleEvidence() {
    if (showEvidence) { setShowEvidence(false); return }
    setShowEvidence(true)
    // Signed URLs expire (see the route's SIGNED_URL_TTL_SECONDS) — unlike the conversation
    // transcript, staying open a while shouldn't mean the links quietly go stale, so this
    // refetches every time the panel opens rather than caching after the first load.
    setEvidenceLoading(true)
    setEvidenceError('')
    try {
      const res = await authedFetch(`/api/admin/case-evidence?caseId=${c.id}`)
      const data = await res.json()
      if (!res.ok) { setEvidenceError(data.error || 'Failed to load evidence.'); return }
      setEvidence(data.evidence ?? [])
    } catch {
      setEvidenceError('Network error. Please try again.')
    } finally {
      setEvidenceLoading(false)
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {c.is_test && (
            <span className="badge" style={{ background: 'color-mix(in srgb, var(--secondary) 25%, transparent)', color: 'var(--secondary)' }}>
              TEST
            </span>
          )}
          {c.negotiationStatus === 'awaiting_our_reply' && (
            <span className="badge" style={{ background: 'color-mix(in srgb, var(--danger) 20%, transparent)', color: 'var(--danger)' }}>
              COUNTER RECEIVED
            </span>
          )}
          <span className="badge">{STAGE_LABEL[c.status] ?? c.status}</span>
        </div>
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

      {/* The address sendCaseEmail actually mails to — see its preference for client_email
          over the case owner's auth email. Editable on every case (a signup address can be
          wrong or outdated), and the ONLY way to set one at all for a case built through the
          Custom Claims "lawyer intake" flow, whose client has no account/auth email at all. */}
      {onSaveClientEmail && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <Mail size={13} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="email"
            className="input"
            placeholder="Client email (for sending the reviewed letter)"
            value={clientEmailInput}
            onChange={(e) => setClientEmailInput(e.target.value)}
            style={{ maxWidth: 280, fontSize: 13 }}
          />
          <button
            type="button"
            className="btn btn-sm"
            disabled={savingClientEmailId === c.id || clientEmailInput.trim() === (c.client_email ?? '')}
            onClick={() => onSaveClientEmail(c.id, clientEmailInput.trim())}
          >
            {savingClientEmailId === c.id ? 'Saving…' : 'Save Email'}
          </button>
          {c.client_email && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Emails currently go to this address, not {c.userEmail || 'the account email'}.
            </span>
          )}
        </div>
      )}

      {/* The debtor's/tenant's own phone — who "Serve via WhatsApp" above actually serves.
          Never the client's own number (client_phone above is that, a different person
          entirely). The agent asks for this once the ₦25,000 "Pandas LP serves it" tier is
          chosen (see lib/agents.ts's RECIPIENT_PHONE block), but most existing cases predate
          that and need it set here directly before Serve via WhatsApp will work at all. */}
      {onSaveRecipientPhone && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <Phone size={13} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="tel"
            className="input"
            placeholder="Debtor's phone (for Serve via WhatsApp)"
            value={recipientPhoneInput}
            onChange={(e) => setRecipientPhoneInput(e.target.value)}
            style={{ maxWidth: 280, fontSize: 13 }}
          />
          <button
            type="button"
            className="btn btn-sm"
            disabled={savingRecipientPhoneId === c.id || recipientPhoneInput.trim() === (c.recipient_phone ?? '')}
            onClick={() => onSaveRecipientPhone(c.id, recipientPhoneInput.trim())}
          >
            {savingRecipientPhoneId === c.id ? 'Saving…' : 'Save Phone'}
          </button>
        </div>
      )}

      {next?.action === 'markReviewed' && (() => {
        const checklist = getReviewChecklist(c.document_title)
        const allChecked = checklist.every((item) => checklistChecked[item.id])
        return (
          <div style={{ marginTop: 14, padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-1)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Review checklist — confirm before marking reviewed
            </div>
            {checklist.map((item) => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, marginBottom: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!checklistChecked[item.id]}
                  onChange={(e) => setChecklistChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                  style={{ marginTop: 2 }}
                />
                <span>{item.label}</span>
              </label>
            ))}
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: 8 }}
              disabled={updatingId === c.id || !allChecked}
              onClick={() => onAction(c.id, 'markReviewed', checklistChecked)}
            >
              {updatingId === c.id ? 'Updating…' : 'Mark Reviewed'}
            </button>
          </div>
        )
      })()}

      {isHighRiskDocument(c.document_title) && c.status !== 'draft' && (
        <div style={{ marginTop: 10, padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-1)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            High-risk document — independent second reviewer (recommended)
          </div>
          {c.second_reviewed_at ? (
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              Confirmed by {c.second_reviewer_email} on {formatDate(c.second_reviewed_at)}
            </div>
          ) : onSecondReview ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="email"
                className="input"
                placeholder="Second reviewer's email"
                value={secondReviewerEmail}
                onChange={(e) => setSecondReviewerEmail(e.target.value)}
                style={{ maxWidth: 220, fontSize: 13 }}
              />
              <button
                type="button"
                className="btn btn-sm"
                disabled={secondReviewingId === c.id || !secondReviewerEmail.trim()}
                onClick={() => onSecondReview(c.id, secondReviewerEmail.trim())}
              >
                {secondReviewingId === c.id ? 'Saving…' : 'Confirm Second Review'}
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--danger)' }}>No second reviewer recorded.</div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        {next && next.action !== 'markReviewed' && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={updatingId === c.id}
            onClick={() => onAction(c.id, next.action)}
          >
            {updatingId === c.id ? 'Updating…' : next.label}
          </button>
        )}
        {/* For a case with no Paystack transaction behind it at all — built through the
            Custom Claims "lawyer intake" flow, where the client paid Pandas LP directly,
            offline. Records the payment and unlocks the exact same review/stamp/send
            pipeline every other paid case uses. Not shown once a case is already paid or
            beyond — there's nothing left to mark. */}
        {(c.status === 'draft' || c.status === 'document_ready') && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={updatingId === c.id}
            title="Record that the client paid Pandas LP directly (cash, transfer, etc.) rather than through the site"
            onClick={() => onAction(c.id, 'markPaidOffline')}
          >
            {updatingId === c.id ? 'Updating…' : 'Mark Paid (Offline)'}
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
            Once paid, this switches from a watermarked read-only PDF to the real, editable,
            unwatermarked DOCX (see canDownloadReviewCopy / lib/docxGenerator.js) — that's the
            reviewer's actual working copy, not a preview, so a client's payment is exactly the
            moment it needs to stop being watermarked. */}
        {c.document_body && canDownloadReviewCopy && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={downloadingDocx}
            onClick={async () => {
              setDownloadingDocx(true)
              try {
                await downloadDemandLetterDocx(c.document_title ?? 'Document', c.document_body!)
              } catch (err) {
                console.error('Failed to build review DOCX:', err)
                alert('Could not generate the DOCX. Please try again.')
              } finally {
                setDownloadingDocx(false)
              }
            }}
          >
            {downloadingDocx ? 'Preparing…' : 'Download DOCX'}
          </button>
        )}
        {c.document_body && !canDownloadReviewCopy && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => downloadTextDocument(c.document_title ?? 'Document', c.document_body!, { watermark: true })}
          >
            Download PDF
          </button>
        )}
        {/* One click: places Pandas LP's real NBA practicing stamp over the signature line
            (see lib/pdfGenerator.js's buildStampedDocument) and opens it in a new tab so
            staff actually look at it before it goes anywhere — nothing uploads on this
            click alone. Same gating as the manual upload below: only once reviewed, since
            a stamp belongs on the reviewed final, not a draft still being worked on. */}
        {c.reviewed_at && c.document_body && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={generatingStamp}
            onClick={handleAttachStamp}
            title="Generate the reviewed letter with the practicing stamp attached, and preview it in a new tab"
          >
            {generatingStamp ? 'Preparing…' : 'Attach Stamp'}
          </button>
        )}
        {stampPreviewBase64 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Preview opened in a new tab.
            <button type="button" className="btn btn-sm" disabled={uploadingStamp} onClick={confirmStampUpload}>
              {uploadingStamp ? 'Uploading…' : 'Looks good — upload it'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setStampPreviewBase64(null)}>
              Discard
            </button>
          </span>
        )}
        {/* Upload the actual signed/stamped PDF for this case — once present, that exact
            file (not the auto-generated one) is what "Send to Customer" attaches. Only
            shown once reviewed, matching "reviewed and stamped" being one step. Kept
            alongside "Attach Stamp" above for a case that needs a different signatory, a
            hand-signed scan, or any document Attach Stamp's own template can't produce. */}
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
              title="Upload a different signed/stamped PDF to send instead of the auto-generated one"
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
        {/* Same "available regardless of document state" reasoning as View Conversation — a
            client can attach evidence before a letter's even drafted, and staff following up
            on a lead should be able to see it just as easily as a paid, reviewed case. */}
        <button type="button" className="btn btn-sm" onClick={toggleEvidence}>
          {showEvidence ? 'Hide Evidence' : 'View Evidence'}
        </button>
        {/* Needs the DEBTOR's phone (recipient_phone) — never client_phone, a different
            person's number entirely (see its own comment in supabase-schema.sql) — AND a
            reviewed-and-stamped PDF actually uploaded first (via Attach Stamp or Upload
            Stamped Document below). Serving an unstamped draft on the debtor is exactly the
            mistake this gate exists to block; stampUploaded covers "uploaded just now, this
            session" immediately, hasStampedDocument covers "uploaded in an earlier session"
            once the page has reloaded. If recipient_phone is missing, the "Recipient phone"
            field further down is where staff set it directly. */}
        {c.recipient_phone && c.document_body && (c.hasStampedDocument || stampUploaded) && (
          <button type="button" className="btn btn-sm" disabled={dispatching} onClick={dispatchWhatsAppService}>
            {dispatching ? 'Opening…' : 'Serve via WhatsApp'}
          </button>
        )}
        {c.recipient_phone && c.document_body && !c.hasStampedDocument && !stampUploaded && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
            Upload the stamped document before serving on WhatsApp.
          </span>
        )}
        <button type="button" className="btn btn-sm" onClick={toggleServiceRecords}>
          {showServiceRecords ? 'Hide Service Log' : 'Service Log'}
        </button>
        {onToggleTest && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={togglingTestId === c.id}
            onClick={() => onToggleTest(c.id, !c.is_test)}
          >
            {togglingTestId === c.id ? 'Updating…' : c.is_test ? 'Mark as Live' : 'Mark as Test'}
          </button>
        )}
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

      {/* Recording money actually recovered. Only offered on the money agents — there is
          nothing to recover on a deed of assignment or a tenancy agreement. What is
          confirmed here feeds the public total on the homepage. */}
      {(c.agent_id === 'small-claims' || c.agent_id === 'judgment-enforcement') && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RecoveryPanel caseId={c.id} expectedAmount={c.expected_amount} />
          {/* A counter from the debtor's own lawyer is a real, common response to a demand
              letter — not just payment or silence. Same practice area as recovery above,
              debt claims specifically, since a counter-offer only makes sense against a
              liquidated sum. */}
          <NegotiationPanel caseId={c.id} caseTitle={c.document_title} recipientPhone={c.recipient_phone} />
        </div>
      )}

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

      {showEvidence && (
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
            gap: 14,
          }}
        >
          {evidenceLoading && <span style={{ color: 'var(--text-muted)' }}>Loading…</span>}
          {evidenceError && <span style={{ color: 'var(--danger)' }}>{evidenceError}</span>}
          {!evidenceLoading && !evidenceError && evidence?.length === 0 && (
            <span style={{ color: 'var(--text-muted)' }}>
              No evidence uploaded on this case yet.
            </span>
          )}
          {!evidenceLoading && evidence?.map((ev) => {
            const kb = ev.sizeBytes ? ev.sizeBytes / 1024 : null
            const sizeLabel = kb == null ? null : kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`
            return (
              <div key={ev.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {ev.url ? (
                    <a href={ev.url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                      {ev.filename}
                    </a>
                  ) : (
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                      {ev.filename} (link unavailable)
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {ev.mediaType}
                    {sizeLabel ? ` · ${sizeLabel}` : ''} · {formatDate(ev.createdAt)}
                  </span>
                </div>
                {ev.extractedFacts && (
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', fontSize: 12.5 }}>
                    {renderFormattedText(ev.extractedFacts)}
                  </div>
                )}
              </div>
            )
          })}
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
  // 'live' (default) hides cases flagged as just someone testing an agent — see the
  // "Mark as Test" button on each CaseCard and app/api/admin/cases/route.ts's testFilter param.
  const [filterTest, setFilterTest] = useState<'live' | 'test' | 'all'>('live')
  const [togglingTestId, setTogglingTestId] = useState<string | null>(null)
  const [secondReviewingId, setSecondReviewingId] = useState<string | null>(null)
  const [savingClientEmailId, setSavingClientEmailId] = useState<string | null>(null)
  const [savingRecipientPhoneId, setSavingRecipientPhoneId] = useState<string | null>(null)

  // The lawyer-intake case's user_id — see components/AgentChat.tsx's lawyerIntake prop and
  // lib/agents.ts's SMALL_CLAIMS_LAWYER_INTAKE_PROMPT. There is no client account for an
  // offline case, so it's owned by whichever staff member actually ran the session.
  const [adminUserId, setAdminUserId] = useState<string | null>(null)
  // Non-null while the Custom Claims tab's agent session is open; holds the seed message
  // (an existing claim's own description, if launched from one) or '' for a blank session.
  const [lawyerIntakeSeed, setLawyerIntakeSeed] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/')
        return
      }
      setAdminUserId(session.user.id)
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

  async function loadTab(which: Tab, overrideStatus?: string, overrideTest?: 'live' | 'test' | 'all', overrideAgent?: string) {
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
        const agentToUse = overrideAgent !== undefined ? overrideAgent : filterAgent
        if (agentToUse) params.set('agentId', agentToUse)
        params.set('testFilter', overrideTest !== undefined ? overrideTest : filterTest)
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

  async function handleStatusAction(caseId: string, action: CaseAction, reviewChecklist?: Record<string, boolean>) {
    setUpdatingId(caseId)
    try {
      const res = await authedFetch('/api/update-case-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, action, reviewChecklist }),
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

  async function handleToggleTest(caseId: string, isTest: boolean) {
    setTogglingTestId(caseId)
    try {
      const res = await authedFetch('/api/admin/cases', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, isTest }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not update this case.')
        return
      }
      // Flipping to "test" while viewing "Live" (or vice versa while viewing "Test") should
      // drop the case out of the current list immediately, matching what a fresh reload would
      // show — not leave a stale row sitting in a filtered view it no longer belongs in.
      if (filterTest === 'live' && isTest) setCases((prev) => prev.filter((c) => c.id !== caseId))
      else if (filterTest === 'test' && !isTest) setCases((prev) => prev.filter((c) => c.id !== caseId))
      else setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, is_test: isTest } : c)))
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setTogglingTestId(null)
    }
  }

  async function handleSecondReview(caseId: string, email: string) {
    setSecondReviewingId(caseId)
    try {
      const res = await authedFetch('/api/admin/cases', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, secondReviewerEmail: email }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not record the second reviewer.')
        return
      }
      const now = new Date().toISOString()
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, second_reviewer_email: email, second_reviewed_at: now } : c)))
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setSecondReviewingId(null)
    }
  }

  // Corrects or sets the address a case's emails actually go to — see sendCaseEmail.ts's
  // preference for client_email over the case owner's auth email. Useful for any case with a
  // wrong signup address, and the ONLY way to set one at all for a lawyer-intake case whose
  // client has no account — see lib/agents.ts's SMALL_CLAIMS_LAWYER_INTAKE_PROMPT.
  async function handleSaveClientEmail(caseId: string, email: string) {
    setSavingClientEmailId(caseId)
    try {
      const res = await authedFetch('/api/admin/cases', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, clientEmail: email }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not save the client email.')
        return
      }
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, client_email: email || null } : c)))
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setSavingClientEmailId(null)
    }
  }

  // Sets or corrects the debtor's/tenant's phone — who Serve via WhatsApp actually serves.
  // See recipient_phone's own comment in supabase-schema.sql for why this is never client_phone.
  async function handleSaveRecipientPhone(caseId: string, phone: string) {
    setSavingRecipientPhoneId(caseId)
    try {
      const res = await authedFetch('/api/admin/cases', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, recipientPhone: phone }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not save the recipient phone.')
        return
      }
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, recipient_phone: phone || null } : c)))
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setSavingRecipientPhoneId(null)
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
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/health" className="btn" style={{ fontSize: 13 }}>System Health</Link>
            <Link href="/dashboard" className="btn" style={{ fontSize: 13 }}>My Dashboard</Link>
          </div>
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
                          onToggleTest={handleToggleTest}
                          togglingTestId={togglingTestId}
                          onSecondReview={handleSecondReview}
                          secondReviewingId={secondReviewingId}
                          onSaveClientEmail={handleSaveClientEmail}
                          savingClientEmailId={savingClientEmailId}
                          onSaveRecipientPhone={handleSaveRecipientPhone}
                          savingRecipientPhoneId={savingRecipientPhoneId}
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
                      <CaseCard key={c.id} c={c} updatingId={updatingId} deletingId={deletingId} confirmDeleteId={confirmDeleteId} regeneratingId={regeneratingId} onAction={handleStatusAction} onDeleteAction={handleDeleteAction} onRegenerateDocument={handleRegenerateDocument} onToggleTest={handleToggleTest} togglingTestId={togglingTestId} onSecondReview={handleSecondReview} secondReviewingId={secondReviewingId} onSaveClientEmail={handleSaveClientEmail} savingClientEmailId={savingClientEmailId} onSaveRecipientPhone={handleSaveRecipientPhone} savingRecipientPhoneId={savingRecipientPhoneId} accentColor="var(--warning)" />
                    ))}
                  </div>

                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                    <Scale size={16} strokeWidth={1.5} aria-hidden="true" />
                    Filed, awaiting judgment {awaitingJudgment.length > 0 && `(${awaitingJudgment.length})`}
                  </h2>
                  {awaitingJudgment.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>No cases waiting on a judgment.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {awaitingJudgment.map((c) => (
                      <CaseCard key={c.id} c={c} updatingId={updatingId} deletingId={deletingId} confirmDeleteId={confirmDeleteId} regeneratingId={regeneratingId} onAction={handleStatusAction} onDeleteAction={handleDeleteAction} onRegenerateDocument={handleRegenerateDocument} onToggleTest={handleToggleTest} togglingTestId={togglingTestId} onSecondReview={handleSecondReview} secondReviewingId={secondReviewingId} onSaveClientEmail={handleSaveClientEmail} savingClientEmailId={savingClientEmailId} onSaveRecipientPhone={handleSaveRecipientPhone} savingRecipientPhoneId={savingRecipientPhoneId} />
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
              <button type="button" className="btn btn-primary btn-sm" onClick={() => loadTab('cases')}>Apply Search</button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[{ id: '', name: 'All agents' }, ...Object.values(AGENTS)].map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`btn btn-sm ${filterAgent === a.id ? '' : 'btn-ghost'}`}
                  style={{
                    fontSize: 12,
                    padding: '6px 12px',
                    ...(filterAgent === a.id ? { background: 'var(--accent)', color: 'var(--bg)', borderColor: 'var(--accent)' } : {}),
                  }}
                  onClick={() => {
                    setFilterAgent(a.id)
                    loadTab('cases', undefined, undefined, a.id)
                  }}
                >
                  {a.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {([
                { value: 'live', label: 'Live cases' },
                { value: 'test', label: 'Test cases' },
                { value: 'all', label: 'All (live + test)' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`btn btn-sm ${filterTest === opt.value ? '' : 'btn-ghost'}`}
                  style={{
                    fontSize: 12,
                    padding: '6px 12px',
                    ...(filterTest === opt.value ? { background: 'var(--secondary)', color: 'var(--bg)', borderColor: 'var(--secondary)' } : {}),
                  }}
                  onClick={() => {
                    setFilterTest(opt.value)
                    loadTab('cases', undefined, opt.value)
                  }}
                >
                  {opt.label}
                </button>
              ))}
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
                  onToggleTest={handleToggleTest}
                  togglingTestId={togglingTestId}
                  onSecondReview={handleSecondReview}
                  secondReviewingId={secondReviewingId}
                  onSaveClientEmail={handleSaveClientEmail}
                  savingClientEmailId={savingClientEmailId}
                  onSaveRecipientPhone={handleSaveRecipientPhone}
                  savingRecipientPhoneId={savingRecipientPhoneId}
                  domId={`case-${c.id}`}
                  accentColor={c.id === deepLinkCaseId ? 'var(--accent)' : undefined}
                />
              ))}
            </div>
          </>
        )}

        {tab === 'claims' && (
          <>
            {/* Runs the real Small Claims Court Agent for a lawyer relaying a case picked up
                offline (a call, a walk-in, a referral) rather than a client typing it in
                themselves — see lib/agents.ts's SMALL_CLAIMS_LAWYER_INTAKE_PROMPT and
                components/AgentChat.tsx's lawyerIntake prop. Blank start: no seed message,
                the lawyer just tells the agent what they've got. */}
            <div style={{ marginBottom: 18 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setLawyerIntakeSeed('')}>
                Start Offline Case With Agent
              </button>
            </div>

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
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        setLawyerIntakeSeed(
                          `Here's what the client (${claim.name}, ${claim.email}) told us in their own words:\n\n${claim.description}`,
                        )
                      }
                    >
                      Work This Claim With Agent
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {lawyerIntakeSeed !== null && adminUserId && (
          <AgentChat
            lawyerIntake
            agent={AGENTS['small-claims']}
            amount={getAgentPayment('small-claims').amount}
            paymentDescription={getAgentPayment('small-claims').description}
            userId={adminUserId}
            initialAutoMessage={lawyerIntakeSeed || undefined}
            onClose={() => setLawyerIntakeSeed(null)}
            onApproved={() => {
              setLawyerIntakeSeed(null)
              setTab('cases')
            }}
          />
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
