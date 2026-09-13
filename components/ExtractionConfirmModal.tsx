'use client'

import { useMemo, useState } from 'react'
import { wordDiff, hasChanges } from '@/lib/wordDiff'
import styles from './ExtractionConfirmModal.module.css'

export interface PendingExtraction {
  filename: string
  mediaType: string
  /** Data URL (includes the data:<mime>;base64, prefix) — for rendering the original preview. */
  fileDataUrl: string
  /** Raw text Claude extracted, before any user edits. */
  originalFacts: string
}

interface ExtractionConfirmModalProps {
  extraction: PendingExtraction
  // Set only when several files were selected in one go (see AgentChat.tsx's handleFileSelect
  // and its `multiple` file input) — shows "File X of Y" so review doesn't feel like it lost
  // track of the batch. Omitted entirely for a single-file upload.
  batchIndex?: number
  batchTotal?: number
  onConfirm: (editedFacts: string) => void
  onCancel: () => void
}

// Human-in-the-loop gate on the /api/extract pipeline (lib fact-extraction from an uploaded
// document — see AgentChat.tsx's handleFileSelect). Extraction is an AI read of a scanned
// document; for a law firm, treating that read as fact without a human glancing at it first
// is exactly the kind of silent-error risk this modal exists to close off. Nothing extracted
// reaches the case/agent until the user explicitly confirms it here.
export default function ExtractionConfirmModal({ extraction, batchIndex, batchTotal, onConfirm, onCancel }: ExtractionConfirmModalProps) {
  const [editedFacts, setEditedFacts] = useState(extraction.originalFacts)
  const [tab, setTab] = useState<'edit' | 'diff'>('edit')

  const diffParts = useMemo(() => wordDiff(extraction.originalFacts, editedFacts), [extraction.originalFacts, editedFacts])
  const edited = hasChanges(diffParts)

  const isPdf = extraction.mediaType === 'application/pdf'

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Confirm extracted document facts">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <div className={styles.headerTitle}>
              Review what we found in {extraction.filename}
              {batchIndex && batchTotal ? (
                <span className={styles.headerBatch}> — File {batchIndex} of {batchTotal}</span>
              ) : null}
            </div>
            <div className={styles.headerSub}>
              {batchTotal
                ? "Confirm each file is accurate before it's used in your case — edit anything that's wrong. You'll move to the next file automatically."
                : "Confirm this is accurate before it's used in your case — edit anything that's wrong."}
            </div>
          </div>
        </div>

        <div className={styles.body}>
          <div className={`${styles.pane} ${styles.paneLeft}`}>
            <div className={styles.paneLabel}>Original document</div>
            <div className={styles.previewArea}>
              {isPdf ? (
                <iframe title="Uploaded document preview" src={extraction.fileDataUrl} className={styles.previewFrame} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={extraction.fileDataUrl} alt="Uploaded document" className={styles.previewImg} />
              )}
            </div>
          </div>

          <div className={styles.pane}>
            <div className={styles.paneLabel}>Extracted facts</div>
            <div className={styles.editArea}>
              <div className={styles.tabRow}>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${tab === 'edit' ? styles.tabBtnActive : ''}`}
                  onClick={() => setTab('edit')}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${tab === 'diff' ? styles.tabBtnActive : ''}`}
                  onClick={() => setTab('diff')}
                >
                  Changes {edited ? '●' : ''}
                </button>
              </div>

              {tab === 'edit' ? (
                <textarea
                  className={styles.textarea}
                  value={editedFacts}
                  onChange={(e) => setEditedFacts(e.target.value)}
                  aria-label="Extracted facts — editable"
                />
              ) : (
                <div className={styles.diffView} aria-live="polite">
                  {edited ? (
                    diffParts.map((part, i) => {
                      if (part.type === 'same') return <span key={i}>{part.text}</span>
                      if (part.type === 'added') return <span key={i} className={styles.diffAdded}>{part.text}</span>
                      return <span key={i} className={styles.diffRemoved}>{part.text}</span>
                    })
                  ) : (
                    <span className={styles.diffEmpty}>No edits yet — this will show exactly what you changed vs. what was extracted.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.footerNote}>
            {edited ? 'Edited — the version you send is what actually reaches your case.' : 'Sending exactly what was extracted, unedited.'}
          </span>
          <div className={styles.footerActions}>
            <button type="button" className="btn btn-sm" onClick={onCancel}>
              {batchIndex && batchTotal && batchIndex < batchTotal ? 'Discard — Next File →' : 'Discard'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!editedFacts.trim()}
              onClick={() => onConfirm(editedFacts.trim())}
            >
              {batchIndex && batchTotal && batchIndex < batchTotal ? 'Confirm & Send — Next File →' : 'Confirm & Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
