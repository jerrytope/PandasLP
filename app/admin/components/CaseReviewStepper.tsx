'use client'

import { useState, useRef, type ChangeEvent } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { getReviewChecklist, isHighRiskDocument } from '@/lib/reviewChecklists'
import { buildStampedDocument } from '@/lib/pdfGenerator'
import { formatDate, type AdminCaseRow, type CaseAction } from './types'
import { Check, CheckCircle2, FileCheck, Send, MessageSquare, AlertCircle, Eye, Upload } from 'lucide-react'

interface CaseReviewStepperProps {
  c: AdminCaseRow
  updatingId: string | null
  onAction: (caseId: string, action: CaseAction, reviewChecklist?: Record<string, boolean>) => void
  onSecondReview?: (caseId: string, email: string) => void
  secondReviewingId?: string | null
  onReloadCase?: () => void
}

export default function CaseReviewStepper({
  c,
  updatingId,
  onAction,
  onSecondReview,
  secondReviewingId,
  onReloadCase,
}: CaseReviewStepperProps) {
  // Step 1 state
  const checklist = getReviewChecklist(c.document_title)
  const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>(c.review_checklist ?? {})
  const allChecked = checklist.every((item) => checklistChecked[item.id])
  const [secondReviewerEmail, setSecondReviewerEmail] = useState('')

  // Step 2 state (Stamping)
  const [uploadingStamp, setUploadingStamp] = useState(false)
  const [stampError, setStampError] = useState('')
  const [stampUploaded, setStampUploaded] = useState(false)
  const [stampPreviewBase64, setStampPreviewBase64] = useState<string | null>(null)
  const [generatingStamp, setGeneratingStamp] = useState(false)
  const stampInputRef = useRef<HTMLInputElement>(null)

  // Step 3 state (Dispatch)
  const [dispatchingWhatsApp, setDispatchingWhatsApp] = useState(false)
  const [whatsAppError, setWhatsAppError] = useState('')

  const isReviewed = Boolean(c.reviewed_at)
  const hasStamp = c.hasStampedDocument || stampUploaded
  const isSent = Boolean(c.reviewed_document_sent_at)

  // Determine current active step (1, 2, or 3)
  const currentStep = !isReviewed ? 1 : !hasStamp ? 2 : 3

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
      onReloadCase?.()
    } catch {
      setStampError('Network error. Please try again.')
    } finally {
      setUploadingStamp(false)
    }
  }

  function handleAttachStamp() {
    if (!c.document_title || !c.document_body) return
    setStampError('')
    setGeneratingStamp(true)
    try {
      const doc = buildStampedDocument(c.document_title, c.document_body)
      const blobUrl = doc.output('bloburl')
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

  async function dispatchWhatsAppService() {
    if (!c.recipient_phone) return
    setDispatchingWhatsApp(true)
    setWhatsAppError('')
    try {
      const res = await authedFetch('/api/admin/service-records', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId: c.id, phone: c.recipient_phone }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setWhatsAppError(data.error || 'Failed to dispatch.')
        return
      }
      window.open(data.whatsappLink, '_blank', 'noopener,noreferrer')
      onReloadCase?.()
    } catch {
      setWhatsAppError('Network error while dispatching.')
    } finally {
      setDispatchingWhatsApp(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Stepper Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)' }}>
          Legal Review & Delivery Workflow
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: isReviewed ? '#16a34a' : currentStep === 1 ? 'var(--text-1)' : 'var(--text-3)' }}>
            1. Review
          </span>
          <span style={{ color: 'var(--text-3)' }}>➔</span>
          <span style={{ color: hasStamp ? '#16a34a' : currentStep === 2 ? 'var(--text-1)' : 'var(--text-3)' }}>
            2. Stamp
          </span>
          <span style={{ color: 'var(--text-3)' }}>➔</span>
          <span style={{ color: isSent ? '#16a34a' : currentStep === 3 ? 'var(--text-1)' : 'var(--text-3)' }}>
            3. Serve
          </span>
        </div>
      </div>

      {/* STEP 1: Checklist & Review */}
      <div
        style={{
          background: 'var(--bg-2)',
          border: `1px solid ${currentStep === 1 ? 'var(--accent)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isReviewed ? (
              <CheckCircle2 size={16} strokeWidth={2.2} style={{ color: '#16a34a' }} />
            ) : (
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                1
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
              NBA Compliance Review Checklist
            </span>
          </div>
          {isReviewed && (
            <span className="badge badge-green" style={{ fontSize: 10 }}>
              Reviewed by {c.reviewed_by || 'staff'} · {formatDate(c.reviewed_at)}
            </span>
          )}
        </div>

        {!isReviewed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {checklist.map((item) => (
              <label
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 13,
                  cursor: 'pointer',
                  lineHeight: 1.4,
                  padding: '4px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!checklistChecked[item.id]}
                  onChange={(e) => setChecklistChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                  style={{ marginTop: 2, accentColor: 'var(--accent)' }}
                />
                <span style={{ color: checklistChecked[item.id] ? 'var(--text-1)' : 'var(--text-2)' }}>
                  {item.label}
                </span>
              </label>
            ))}

            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={updatingId === c.id || !allChecked}
                onClick={() => onAction(c.id, 'markReviewed', checklistChecked)}
              >
                {updatingId === c.id ? 'Saving Review…' : 'Approve & Mark Reviewed'}
              </button>
              {!allChecked && (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Confirm all checklist items to approve
                </span>
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
            All legal checks verified. Ready for stamping and formal issuance.
          </div>
        )}

        {/* High Risk Second Reviewer Box */}
        {isHighRiskDocument(c.document_title) && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-1)',
              border: '1px solid var(--border-subtle)',
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--warning)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={13} strokeWidth={2} />
              High-risk document — second lawyer review (recommended)
            </div>
            {c.second_reviewed_at ? (
              <span style={{ color: '#16a34a', fontWeight: 500 }}>
                ✓ Second review confirmed by {c.second_reviewer_email} on {formatDate(c.second_reviewed_at)}
              </span>
            ) : onSecondReview ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="email"
                  className="input"
                  placeholder="Second reviewer email"
                  value={secondReviewerEmail}
                  onChange={(e) => setSecondReviewerEmail(e.target.value)}
                  style={{ maxWidth: 220, fontSize: 12, minHeight: 36, padding: '6px 10px' }}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ minHeight: 36, padding: '6px 12px', fontSize: 12 }}
                  disabled={secondReviewingId === c.id || !secondReviewerEmail.trim()}
                  onClick={() => onSecondReview(c.id, secondReviewerEmail.trim())}
                >
                  {secondReviewingId === c.id ? 'Recording…' : 'Confirm'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* STEP 2: Practicing Stamp */}
      <div
        style={{
          background: 'var(--bg-2)',
          border: `1px solid ${currentStep === 2 ? 'var(--accent)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasStamp ? (
              <CheckCircle2 size={16} strokeWidth={2.2} style={{ color: '#16a34a' }} />
            ) : (
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: isReviewed ? 'var(--accent)' : 'var(--border-subtle)',
                  color: isReviewed ? 'white' : 'var(--text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                2
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
              NBA Practicing Stamp
            </span>
          </div>
          {hasStamp && (
            <span className="badge badge-green" style={{ fontSize: 10, gap: 4 }}>
              <Check size={11} strokeWidth={2.5} /> Official Stamp On File
            </span>
          )}
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
          Embeds the practicing seal of Counsel onto the final deliverable for court and service validity.
        </p>

        {isReviewed && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={generatingStamp}
              onClick={handleAttachStamp}
            >
              <FileCheck size={14} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
              {generatingStamp ? 'Generating…' : 'Generate & Attach Stamp'}
            </button>

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
            >
              <Upload size={13} strokeWidth={1.8} />
              {uploadingStamp ? 'Uploading…' : hasStamp ? 'Replace PDF' : 'Upload External PDF'}
            </button>
          </div>
        )}

        {stampPreviewBase64 && (
          <div
            style={{
              marginTop: 10,
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: 12,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-1)' }}>
              <Eye size={14} style={{ color: 'var(--accent)' }} /> Preview opened in new tab.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
                disabled={uploadingStamp}
                onClick={confirmStampUpload}
              >
                {uploadingStamp ? 'Uploading…' : 'Looks Good — Confirm Upload'}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                onClick={() => setStampPreviewBase64(null)}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {stampError && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{stampError}</div>
        )}
      </div>

      {/* STEP 3: Delivery (Email / WhatsApp) */}
      <div
        style={{
          background: 'var(--bg-2)',
          border: `1px solid ${currentStep === 3 ? 'var(--accent)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isSent ? (
              <CheckCircle2 size={16} strokeWidth={2.2} style={{ color: '#16a34a' }} />
            ) : (
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: hasStamp ? 'var(--accent)' : 'var(--border-subtle)',
                  color: hasStamp ? 'white' : 'var(--text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                3
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
              Service & Client Delivery
            </span>
          </div>
          {isSent && (
            <span className="badge badge-green" style={{ fontSize: 10 }}>
              Sent {formatDate(c.reviewed_document_sent_at)}
            </span>
          )}
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
          Deliver the finalized document to the client via email, and formally serve the debtor via verified WhatsApp dispatch.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Email Send to Customer */}
          {c.status === 'paid' && isReviewed && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={updatingId === c.id}
              onClick={() => onAction(c.id, 'sendReviewedDocument')}
            >
              <Send size={13} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
              {updatingId === c.id ? 'Sending…' : isSent ? 'Resend to Customer' : 'Send to Customer'}
            </button>
          )}

          {/* Serve via WhatsApp */}
          {c.recipient_phone && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!hasStamp || dispatchingWhatsApp}
              onClick={dispatchWhatsAppService}
              title={!hasStamp ? 'Upload or attach practicing stamp before serving' : undefined}
            >
              <MessageSquare size={13} strokeWidth={2} />
              {dispatchingWhatsApp ? 'Opening WhatsApp…' : 'Serve Debtor via WhatsApp'}
            </button>
          )}

          {!c.recipient_phone && (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              (Set Debtor's phone number in metadata to enable WhatsApp service)
            </span>
          )}
        </div>

        {whatsAppError && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{whatsAppError}</div>
        )}
      </div>
    </div>
  )
}
