'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, AlertTriangle } from 'lucide-react'
import { authedFetch } from '@/lib/supabaseClient'
import { BRAND_CASE_STATUS_LABELS, type BrandCaseStatus } from '@/lib/brandSheet'
import { formatDate } from '../types'

interface BrandCaseInfo {
  id: string
  case_ref: string
  status: BrandCaseStatus
  borrower: Record<string, string> | null
  letter_url: string | null
  last_error: string | null
  served_at: string | null
  day7_sent_at: string | null
  day14_sent_at: string | null
  awaiting_brand_decision_at: string | null
  billable_at: string | null
  court_approved_at: string | null
  court_approved_by: string | null
  court_approval_note: string | null
  court_approval_evidence_url: string | null
  brands: { name: string; code: string } | null
}

export interface EventRow {
  id: string
  event_type: string
  detail: Record<string, unknown>
  actor: string
  created_at: string
}

/** Plain-English line for each audit event (lib/brandSync.ts, lib/brandServing.ts). */
export function describe(e: EventRow): string {
  const d = e.detail ?? {}
  switch (e.event_type) {
    case 'case_created':
      return d.source === 'api'
        ? `Sent by API${d.test ? ' with the TEST key' : ''} (their loan ID ${d.loan_id ?? '?'}, ${d.documents ?? 0} document${d.documents === 1 ? '' : 's'})`
        : `Case ID given to the row the brand added (row ${d.row ?? '?'})`
    case 'status_changed':
      return `Status: ${label(d.from)} → ${label(d.to)}`
    case 'missing_documents':
      return `Missing documents: ${Array.isArray(d.missing) ? d.missing.join('; ') : ''}`
    case 'resubmitted':
      return d.source === 'api' ? (d.notes_changed ? 'The brand added a note; checking again' : 'The brand resent the loan with corrections; checking again') : 'The brand corrected the row; checking again'
    case 'letter_drafted':
      return `Letter drafted: ${d.title ?? ''}`
    case 'draft_failed':
      return `Drafting failed: ${d.error ?? ''}`
    case 'stale_claim_reset':
      return 'A sync stopped part-way; the row went back to New'
    case 'retry_requested':
      return 'Retry requested'
    case 'lawyer_approved':
      return d.test ? 'Test mode: approved (SAMPLE letter, never billed)' : `Approved by ${d.reviewer ?? e.actor}; the letter is now billable`
    case 'final_letter_saved':
      return 'FINAL letter saved to the brand’s Letters folder'
    case 'served':
      return d.method === 'email' ? `Served by email to ${d.to ?? 'the borrower'} (brand copied)` : 'Marked served by staff'
    case 'serve_failed':
      return `Serving failed, nothing was sent: ${d.error ?? ''}`
    case 'day7_reminder':
      return `Day 7 reminder emailed to ${d.to ?? 'the borrower'}`
    case 'day14_reminder':
      return `Day 14 reminder emailed to ${d.to ?? 'the borrower'}`
    case 'reminder_failed':
      return `${d.kind === 'day14' ? 'Day 14' : 'Day 7'} reminder failed, will retry: ${d.error ?? ''}`
    case 'awaiting_brand_decision':
      return 'Response period over: waiting for the brand’s decision'
    case 'court_approved':
      return `Brand’s written approval to go to court recorded: ${d.note ?? ''}`
    case 'outcome':
      return `Marked ${label(d.outcome)}${d.note ? `: ${d.note}` : ''}`
    case 'edited_after_processing':
      return `The brand edited ${d.column ?? 'a column'} after we started (${d.from || '(empty)'} → ${d.to || '(empty)'}); not acted on`
    case 'notes_updated':
      return d.source === 'api' ? `The brand added a note by API: “${String(d.to ?? '').split('\n').pop()}”` : `The brand updated Notes: “${d.to ?? ''}”`
    case 'flag_resolved':
      return `Flag resolved (${d.decision ?? ''}): ${d.note ?? ''}`
    case 'row_missing':
      return 'The row disappeared from the brand’s sheet'
    case 'row_back':
      return 'The row is back in the sheet'
    case 'billed':
      return `Billed on invoice ${d.invoice_number ?? ''}`
    case 'unbilled':
      return 'Back to unbilled (its invoice was voided)'
    default:
      return e.event_type
  }
}

function label(status: unknown): string {
  return typeof status === 'string' && status in BRAND_CASE_STATUS_LABELS ? BRAND_CASE_STATUS_LABELS[status as BrandCaseStatus] : String(status)
}

export default function BrandCaseTimeline({ caseId }: { caseId: string }) {
  const [info, setInfo] = useState<BrandCaseInfo | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)

  useEffect(() => {
    let cancelled = false
    authedFetch(`/api/admin/brands/cases?caseId=${encodeURIComponent(caseId)}`)
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) return setError(data.error || 'Could not load the borrower’s history.')
        setInfo(data.brandCase)
        setEvents(data.events)
      })
      .catch(() => !cancelled && setError('Network error while loading the borrower’s history.'))
    return () => {
      cancelled = true
    }
  }, [caseId, version])

  if (error) return <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>
  if (!info) return null

  const dates: [string, string | null][] = [
    ['Served', info.served_at],
    ['Day 7 reminder', info.day7_sent_at],
    ['Day 14 reminder', info.day14_sent_at],
  ]

  return (
    <div className="card" style={{ padding: '16px 18px', background: 'var(--bg-2)', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>
          Brand borrower · {info.brands?.name ?? ''} · <span style={{ fontFamily: 'var(--font-mono)' }}>{info.case_ref}</span>
        </div>
        <span className="badge">{label(info.status)}</span>
      </div>

      {info.awaiting_brand_decision_at && info.status === 'day14_sent' && !info.court_approved_at && (
        <div style={{ fontSize: 13, color: 'var(--warning)', display: 'flex', gap: 6 }}>
          <AlertTriangle size={14} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          Awaiting the brand’s decision since {formatDate(info.awaiting_brand_decision_at)}. Nothing goes to court without their written approval.
        </div>
      )}
      {info.last_error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{info.last_error}</div>}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-2)' }}>
        {dates.map(([name, at]) => (
          <span key={name}>
            {name}: <strong style={{ color: 'var(--text-1)' }}>{at ? formatDate(at) : '—'}</strong>
          </span>
        ))}
        {info.letter_url && (
          <a href={info.letter_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Letter in the brand’s Drive <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>

      <CourtApproval info={info} onDone={reload} />
      <Outcomes info={info} onDone={reload} />

      {events.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, fontSize: 12.5, color: 'var(--text-2)' }}>
          {events.map((e) => (
            <li key={e.id}>
              <span style={{ color: 'var(--text-3)' }}>{formatDate(e.created_at)}</span> · {describe(e)}
              {e.actor !== 'system' && <span style={{ color: 'var(--text-3)' }}> ({e.actor})</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

async function post(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await authedFetch('/api/admin/brands/cases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return res.ok ? null : data.error || 'Something went wrong.'
  } catch {
    return 'Network error.'
  }
}

const COURT_STAGES: BrandCaseStatus[] = ['served', 'day7_sent', 'day14_sent', 'disputed']

// Nothing goes to court without the brand's written approval: a note and a copy (PDF or image).
function CourtApproval({ info, onDone }: { info: BrandCaseInfo; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (info.court_approved_at) {
    return (
      <div style={{ fontSize: 13, color: 'var(--success)' }}>
        ✓ Brand’s written approval to go to court recorded by {info.court_approved_by} on {formatDate(info.court_approved_at)}: {info.court_approval_note}{' '}
        {info.court_approval_evidence_url && (
          <a href={info.court_approval_evidence_url} target="_blank" rel="noopener noreferrer">
            View copy
          </a>
        )}
      </div>
    )
  }
  if (!COURT_STAGES.includes(info.status)) return null

  async function submit() {
    if (!file) return
    if (file.size > 3 * 1024 * 1024) return setError('File too large. Maximum size is 3 MB.')
    setBusy(true)
    setError('')
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const err = await post({ action: 'court_approval', brandCaseId: info.id, note, fileBase64: base64 })
    setBusy(false)
    if (err) return setError(err)
    setOpen(false)
    onDone()
  }

  return (
    <div style={{ fontSize: 13, display: 'grid', gap: 6 }}>
      <div style={{ color: 'var(--text-2)' }}>Court filing is blocked until the brand’s written approval is recorded.</div>
      {!open ? (
        <div>
          <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
            Record brand’s written approval
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          <input
            className="input"
            placeholder="Who approved it, and when (e.g. email from Ade, Head of Recoveries, 3 Nov)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ fontSize: 12, minHeight: 34 }}
            aria-label="Approval note"
          />
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-label="Copy of the approval (PDF or image)"
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !file || note.trim().length < 5} onClick={submit}>
              {busy ? 'Saving…' : 'Save approval'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <div role="alert" style={{ color: 'var(--danger)' }}>{error}</div>}
    </div>
  )
}

// Mirrors OUTCOME_FROM in lib/brandExceptions.ts (the server checks it again).
const OUTCOME_FROM: Record<'paid' | 'disputed' | 'closed', BrandCaseStatus[]> = {
  paid: ['letter_drafted', 'lawyer_approved', 'served', 'day7_sent', 'day14_sent', 'disputed'],
  disputed: ['served', 'day7_sent', 'day14_sent'],
  closed: ['new', 'missing_documents', 'letter_drafted', 'lawyer_approved', 'served', 'day7_sent', 'day14_sent', 'paid', 'disputed'],
}

// Paid, Disputed or Closed. Reminders stop for all three.
function Outcomes({ info, onDone }: { info: BrandCaseInfo; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const options = (Object.keys(OUTCOME_FROM) as (keyof typeof OUTCOME_FROM)[]).filter((o) => OUTCOME_FROM[o].includes(info.status))
  if (options.length === 0) return null

  async function mark(outcome: string) {
    setBusy(true)
    setError('')
    const err = await post({ action: 'outcome', brandCaseId: info.id, outcome, note })
    setBusy(false)
    if (err) return setError(err)
    setNote('')
    onDone()
  }

  return (
    <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          placeholder="Note (optional): e.g. paid in full by transfer on 3 Nov"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ flex: '1 1 220px', fontSize: 12, minHeight: 32, padding: '4px 10px' }}
          aria-label="Outcome note"
        />
        {options.map((o) => (
          <button key={o} type="button" className="btn btn-sm" disabled={busy} onClick={() => mark(o)}>
            Mark {BRAND_CASE_STATUS_LABELS[o]}
          </button>
        ))}
      </div>
      {error && <div role="alert" style={{ color: 'var(--danger)' }}>{error}</div>}
    </div>
  )
}
