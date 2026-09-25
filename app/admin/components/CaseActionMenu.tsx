'use client'

import { useState } from 'react'
import { downloadTextDocument } from '@/lib/pdfGenerator'
import { downloadDemandLetterDocx } from '@/lib/docxGenerator'
import type { AdminCaseRow, CaseAction } from './types'
import { Download, RefreshCw, Trash2, CheckCircle2, ShieldAlert, MoreVertical } from 'lucide-react'

interface CaseActionMenuProps {
  c: AdminCaseRow
  updatingId: string | null
  deletingId?: string | null
  confirmDeleteId?: string | null
  regeneratingId?: string | null
  togglingTestId?: string | null
  onAction: (caseId: string, action: CaseAction) => void
  onDeleteAction?: (caseId: string, action: 'request' | 'cancel' | 'confirm') => void
  onRegenerateDocument?: (caseId: string) => void
  onToggleTest?: (caseId: string, isTest: boolean) => void
}

export default function CaseActionMenu({
  c,
  updatingId,
  deletingId,
  confirmDeleteId,
  regeneratingId,
  togglingTestId,
  onAction,
  onDeleteAction,
  onRegenerateDocument,
  onToggleTest,
}: CaseActionMenuProps) {
  const [downloadingDocx, setDownloadingDocx] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const canDownloadReviewCopy = c.status === 'paid'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      {/* Quick Download Buttons */}
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
          title="Download unwatermarked editable DOCX for internal review"
        >
          <Download size={13} strokeWidth={1.8} />
          {downloadingDocx ? 'Preparing…' : 'DOCX'}
        </button>
      )}

      {c.document_body && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => downloadTextDocument(c.document_title ?? 'Document', c.document_body!, { watermark: !canDownloadReviewCopy })}
          title="Download PDF deliverable"
        >
          <Download size={13} strokeWidth={1.8} />
          PDF
        </button>
      )}

      {/* Offline Payment button (if unpaid) */}
      {(c.status === 'draft' || c.status === 'document_ready') && (
        <button
          type="button"
          className="btn btn-sm"
          disabled={updatingId === c.id}
          onClick={() => onAction(c.id, 'markPaidOffline')}
          title="Record offline client payment (transfer / cash)"
        >
          <CheckCircle2 size={13} strokeWidth={1.8} style={{ color: '#16a34a' }} />
          {updatingId === c.id ? 'Saving…' : 'Mark Paid (Offline)'}
        </button>
      )}

      {/* Overflow Menu Toggle */}
      <button
        type="button"
        className="btn btn-sm"
        style={{ padding: '8px 10px' }}
        onClick={() => setShowMenu((v) => !v)}
        title="More administrative options"
        aria-label="More options"
      >
        <MoreVertical size={14} />
      </button>

      {/* Dropdown Menu Popup */}
      {showMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
            onClick={() => setShowMenu(false)}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: 6,
              minWidth: 220,
              background: 'var(--bg-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              padding: 6,
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {/* Toggle Test / Live */}
            {onToggleTest && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: 13 }}
                disabled={togglingTestId === c.id}
                onClick={() => {
                  setShowMenu(false)
                  onToggleTest(c.id, !c.is_test)
                }}
              >
                <ShieldAlert size={14} style={{ color: 'var(--text-3)' }} />
                <span>{c.is_test ? 'Convert to Live Matter' : 'Mark as Test Lead'}</span>
              </button>
            )}

            {/* Regenerate document from transcript */}
            {!c.document_body && c.status !== 'draft' && onRegenerateDocument && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: 13 }}
                disabled={regeneratingId === c.id}
                onClick={() => {
                  setShowMenu(false)
                  onRegenerateDocument(c.id)
                }}
              >
                <RefreshCw size={14} style={{ color: 'var(--accent)' }} />
                <span>Regenerate Document</span>
              </button>
            )}

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

            {/* Delete Case Option */}
            {onDeleteAction && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  justifyContent: 'flex-start',
                  padding: '8px 12px',
                  fontSize: 13,
                  color: 'var(--danger)',
                }}
                onClick={() => {
                  setShowMenu(false)
                  onDeleteAction(c.id, 'request')
                }}
              >
                <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                <span>Delete Matter</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId === c.id && onDeleteAction && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 6,
            minWidth: 260,
            background: 'var(--bg-2)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            padding: 14,
            zIndex: 110,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
            Delete Case #{c.case_number || c.id.slice(0, 6)}?
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
            This permanently removes all messages, documents, and records associated with this case.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onDeleteAction(c.id, 'cancel')}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: 'var(--danger)', color: 'white', borderColor: 'var(--danger)' }}
              disabled={deletingId === c.id}
              onClick={() => onDeleteAction(c.id, 'confirm')}
            >
              {deletingId === c.id ? 'Deleting…' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
