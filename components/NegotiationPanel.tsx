'use client'

import { useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { formatNaira as naira } from '@/lib/formatNaira'
import { buildReplyLetterPdf } from '@/lib/pdfGenerator'
import { downloadReplyLetterDocx } from '@/lib/docxGenerator'
import { referenceFor } from '@/lib/replyLetter.js'
import {
  NEGOTIATION_STATUSES,
  NEGOTIATION_STATUS_LABEL,
  defaultStatusFor,
  isNegotiationStatus,
  lagosToday,
  type NegotiationStatus,
} from '@/lib/negotiationStatus'

/* ─────────────────────────────────────────────────────────────
   The negotiation thread for a case, and the workflow for
   answering the debtor's lawyer:

     1. Their response is logged (attach their letter and the
        fields fill themselves in).
     2. The agent drafts an advice note to OUR client; the lawyer
        edits it and emails it.
     3. The lawyer records the client's instructions.
     4. The agent drafts the reply body in the firm's house style
        (NEGOTIATION_HOUSE_STYLE in lib/agents.ts) from those
        instructions; the lawyer fills the letter details and
        any dates. The agent never writes dates.
     5. The lawyer previews it on letterhead with the NBA stamp,
        downloads the Word copy if needed, and logs it as sent,
        which attaches the stamped PDF, emails the client, sets
        the status and schedules the follow-up.

   Same "AI drafts, a lawyer commits it" shape as everywhere
   else in this app.
   ───────────────────────────────────────────────────────────── */

type Party = 'debtor_counsel' | 'pandas_lp'

type NegotiationRound = {
  id: string
  party: Party
  counsel_name: string | null
  proposed_amount: number | null
  summary: string
  attachment_path: string | null
  attachmentUrl: string | null
  ai_drafted: boolean
  logged_by: string
  occurred_at: string
  status: string | null
  next_action: string | null
  next_action_due: string | null
  next_action_done_at: string | null
  advice_note: string | null
  advice_sent_at: string | null
  client_instructions: string | null
  instructions_received_at: string | null
}

const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg']
const DEFAULT_SIGNATORY = 'Adeyemo Adedeji'

function formatDue(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function formatWhen(ts: string) {
  return new Date(ts).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const box: React.CSSProperties = { padding: 12, border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 8 }
const stepTitle: React.CSSProperties = { fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }
const muted: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 12, margin: 0 }
const field: React.CSSProperties = { display: 'grid', gap: 4 }

export default function NegotiationPanel({
  caseId,
  caseTitle,
  caseNumber,
  recipientPhone,
}: {
  caseId: string
  caseTitle?: string | null
  // Used for the letter's "Our Ref: PLP/<year>/<number>" — same format as the demand letter.
  caseNumber?: number | null
  // The debtor's phone, for serving a reply via WhatsApp (never client_phone).
  recipientPhone?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [rounds, setRounds] = useState<NegotiationRound[] | null>(null)
  const [loading, setLoading] = useState(false)

  // Logging form: a response we received, or a reply sent outside the workflow below.
  const [party, setParty] = useState<Party>('debtor_counsel')
  const [counselName, setCounselName] = useState('')
  const [proposedAmount, setProposedAmount] = useState('')
  const [summary, setSummary] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [statusChoice, setStatusChoice] = useState<NegotiationStatus | ''>('')
  const [nextAction, setNextAction] = useState('')
  const [nextActionDue, setNextActionDue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')

  // Per-round controls.
  const [updatingRoundId, setUpdatingRoundId] = useState<string | null>(null)
  const [dueEdits, setDueEdits] = useState<Record<string, string>>({})
  const [roundError, setRoundError] = useState('')
  const [servingRoundId, setServingRoundId] = useState<string | null>(null)
  const [serveError, setServeError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await authedFetch(`/api/admin/negotiations?caseId=${encodeURIComponent(caseId)}`)
      const data = await res.json()
      if (res.ok && !data.error) setRounds(data.rounds || [])
    } catch {
      /* the thread is supplementary; the form still works without it */
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && rounds === null) load()
  }

  function patchLocal(id: string, patch: Partial<NegotiationRound>) {
    setRounds((prev) => (prev || []).map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function updateRound(id: string, patch: Record<string, unknown>): Promise<boolean> {
    setRoundError('')
    setUpdatingRoundId(id)
    try {
      const res = await authedFetch('/api/admin/negotiations', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setRoundError(data.error || 'Could not update this entry.')
        return false
      }
      patchLocal(id, data.round)
      setDueEdits((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return true
    } catch {
      setRoundError('Network error. Please try again.')
      return false
    } finally {
      setUpdatingRoundId(null)
    }
  }

  async function handleAttachmentSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setAttachmentFile(file)
    setExtractError('')
    if (!file || party !== 'debtor_counsel') return
    if (!ACCEPTED.includes(file.type)) {
      setExtractError('Attachment must be a PDF, PNG or JPEG to read automatically. Fill the fields in by hand instead.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setExtractError('File is too large to read automatically (max 10 MB). Fill the fields in by hand instead.')
      return
    }
    setExtracting(true)
    try {
      const res = await authedFetch('/api/admin/negotiations/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileBase64: await readAsBase64(file), mediaType: file.type }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setExtractError(data.error || 'Could not read this file. Fill the fields in by hand instead.')
        return
      }
      if (data.counselName) setCounselName(data.counselName)
      if (data.proposedAmount != null) setProposedAmount(String(data.proposedAmount))
      if (data.summary) setSummary(data.summary)
    } catch {
      setExtractError('Network error while reading the file. Fill the fields in by hand instead.')
    } finally {
      setExtracting(false)
    }
  }

  async function serveRoundViaWhatsApp(negotiationId: string) {
    if (!recipientPhone) return
    setServeError('')
    setServingRoundId(negotiationId)
    try {
      const res = await authedFetch('/api/admin/service-records', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, phone: recipientPhone, negotiationId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setServeError(data.error || 'Failed to dispatch.')
        return
      }
      // Staff still press send inside WhatsApp; this opens it pre-filled and records the attempt.
      window.open(data.whatsappLink, '_blank', 'noopener,noreferrer')
    } catch {
      setServeError('Network error. Please try again.')
    } finally {
      setServingRoundId(null)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!summary.trim()) {
      setError(party === 'debtor_counsel' ? 'Give a summary of what they said or offered.' : 'The reply text is required.')
      return
    }
    if (nextActionDue && !nextAction.trim()) {
      setError('Say what the next action is, or clear the due date.')
      return
    }
    let amountNum: number | undefined
    if (proposedAmount.trim()) {
      const parsed = Number(proposedAmount.replace(/[,\s₦]/g, ''))
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Amount must be a valid non-negative number, or left blank.')
        return
      }
      amountNum = parsed
    }
    let attachmentBase64: string | undefined
    let attachmentType: string | undefined
    if (attachmentFile) {
      if (!ACCEPTED.includes(attachmentFile.type)) {
        setError('Attachment must be a PDF, PNG or JPEG.')
        return
      }
      if (attachmentFile.size > 10 * 1024 * 1024) {
        setError('Attachment is too large. Maximum size is 10 MB.')
        return
      }
      attachmentType = attachmentFile.type
      attachmentBase64 = await readAsBase64(attachmentFile)
    }

    setSaving(true)
    try {
      const res = await authedFetch('/api/admin/negotiations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId,
          party,
          counselName: party === 'debtor_counsel' ? counselName.trim() : undefined,
          proposedAmount: amountNum,
          summary: summary.trim(),
          attachmentBase64,
          attachmentType,
          status: statusChoice || defaultStatusFor(party),
          nextAction: nextAction.trim() || undefined,
          nextActionDue: nextAction.trim() && nextActionDue ? nextActionDue : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not save this entry.')
        return
      }
      setNotice(data.warning || (party === 'debtor_counsel' ? 'Logged. Advise the client below.' : 'Logged.'))
      setCounselName('')
      setProposedAmount('')
      setSummary('')
      setAttachmentFile(null)
      setStatusChoice('')
      setNextAction('')
      setNextActionDue('')
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const latest = rounds && rounds.length > 0 ? rounds[rounds.length - 1] : null
  const latestStatus: NegotiationStatus | null = latest
    ? isNegotiationStatus(latest.status) ? latest.status : defaultStatusFor(latest.party)
    : null
  const today = lagosToday()
  // The workflow answers the most recent response from the debtor's lawyer, as long as we
  // haven't replied to it yet.
  const pendingResponse = latest && latest.party === 'debtor_counsel' ? latest : null

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={toggle}>
        {open ? 'Hide negotiation' : 'Negotiation'}
        {latestStatus ? ` · ${NEGOTIATION_STATUS_LABEL[latestStatus].toLowerCase()}` : ''}
      </button>

      {open && (
        <div style={{ marginTop: 10, padding: 14, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, display: 'grid', gap: 14 }}>
          {loading && <p style={{ ...muted, fontSize: 13 }}>Loading…</p>}

          {rounds && rounds.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rounds.map((r) => {
                const actionOpen = !!r.next_action && !r.next_action_done_at
                const overdue = actionOpen && !!r.next_action_due && r.next_action_due < today
                const dueToday = actionOpen && r.next_action_due === today
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: r.party === 'debtor_counsel' ? 'var(--bg-1)' : 'color-mix(in srgb, var(--accent) 6%, var(--bg-2))',
                      borderLeft: `3px solid ${r.party === 'debtor_counsel' ? 'var(--text-muted)' : 'var(--accent)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <strong>{r.party === 'debtor_counsel' ? `Debtor's counsel${r.counsel_name ? ` (${r.counsel_name})` : ''}` : 'Pandas LP'}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(r.occurred_at).toLocaleDateString('en-NG')}
                        {r.proposed_amount != null ? ` · ${naira(r.proposed_amount)}` : ''}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto' }}>{r.summary}</div>
                    <div style={{ marginTop: 4, ...muted }}>
                      {r.ai_drafted && 'AI-drafted, reviewed by a lawyer · '}
                      Logged by {r.logged_by}
                      {r.attachmentUrl && (
                        <>
                          {' · '}
                          <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer">View attachment</a>
                        </>
                      )}
                      {r.advice_sent_at && ` · Advice emailed to client ${formatWhen(r.advice_sent_at)}`}
                      {r.instructions_received_at && ` · Instructions recorded ${formatWhen(r.instructions_received_at)}`}
                    </div>

                    {(isNegotiationStatus(r.status) || r.next_action) && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle, var(--border))', display: 'grid', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
                          {isNegotiationStatus(r.status) && <span className="badge" style={{ fontSize: 11 }}>{NEGOTIATION_STATUS_LABEL[r.status]}</span>}
                          {r.next_action && (
                            <span style={{ color: actionOpen ? 'inherit' : 'var(--text-muted)', textDecoration: actionOpen ? 'none' : 'line-through' }}>
                              Next: {r.next_action}
                            </span>
                          )}
                          {r.next_action && r.next_action_due && (
                            <span style={{ color: overdue ? 'var(--danger)' : dueToday ? 'var(--warning)' : 'var(--text-muted)', fontWeight: overdue || dueToday ? 600 : 400 }}>
                              {overdue ? 'Overdue since ' : dueToday ? 'Due today, ' : 'Due '}
                              {formatDue(r.next_action_due)}
                            </span>
                          )}
                          {r.next_action && r.next_action_done_at && <span style={{ color: 'var(--text-muted)' }}>Done</span>}
                        </div>
                        {actionOpen && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button type="button" className="btn btn-sm" disabled={updatingRoundId === r.id} onClick={() => updateRound(r.id, { done: true })}>
                              {updatingRoundId === r.id ? 'Saving…' : 'Mark done'}
                            </button>
                            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                              <span>Move due date</span>
                              <input
                                id={`due-${r.id}`}
                                type="date"
                                className="input"
                                value={dueEdits[r.id] ?? r.next_action_due ?? ''}
                                onChange={(e) => setDueEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                style={{ fontSize: 12, minHeight: 32, padding: '4px 8px' }}
                              />
                            </label>
                            {dueEdits[r.id] !== undefined && dueEdits[r.id] !== (r.next_action_due ?? '') && (
                              <button type="button" className="btn btn-sm" disabled={updatingRoundId === r.id} onClick={() => updateRound(r.id, { nextActionDue: dueEdits[r.id] || null })}>
                                Save date
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {r.party === 'pandas_lp' && r.attachment_path && recipientPhone && (
                      <div style={{ marginTop: 8 }}>
                        <button type="button" className="btn btn-sm" disabled={servingRoundId === r.id} onClick={() => serveRoundViaWhatsApp(r.id)}>
                          {servingRoundId === r.id ? 'Opening…' : 'Serve This Reply via WhatsApp'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {serveError && <p style={{ color: 'var(--danger)', margin: 0 }}>{serveError}</p>}
              {roundError && <p style={{ color: 'var(--danger)', margin: 0 }}>{roundError}</p>}
            </div>
          )}

          {pendingResponse && (
            <ReplyWorkflow
              key={pendingResponse.id}
              caseId={caseId}
              caseTitle={caseTitle}
              caseNumber={caseNumber}
              response={pendingResponse}
              onRoundPatched={patchLocal}
              onLogged={load}
            />
          )}

          <form onSubmit={submit} style={{ ...box, gap: 10 }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 4 }}>
              <legend style={{ padding: 0, fontWeight: 600 }}>Log correspondence</legend>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" name={`party-${caseId}`} checked={party === 'debtor_counsel'} onChange={() => setParty('debtor_counsel')} />
                  A response from the debtor&rsquo;s lawyer
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" name={`party-${caseId}`} checked={party === 'pandas_lp'} onChange={() => setParty('pandas_lp')} />
                  A reply we sent outside this panel
                </label>
              </div>
            </fieldset>

            <label style={field}>
              <span>{party === 'debtor_counsel' ? 'Their letter (PDF/PNG/JPEG): attach it and the fields below fill in automatically' : 'Copy of what we sent (optional)'}</span>
              <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={handleAttachmentSelect} style={{ fontSize: 12 }} />
              {extracting && <span style={muted}>Reading the letter…</span>}
              {extractError && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{extractError}</span>}
            </label>

            {party === 'debtor_counsel' && (
              <label style={field}>
                <span>Debtor&rsquo;s lawyer / firm name</span>
                <input id={`neg-counsel-${caseId}`} className="input" value={counselName} onChange={(e) => setCounselName(e.target.value)} style={{ fontSize: 13 }} />
              </label>
            )}

            <label style={field}>
              <span>Figure named, if any (₦)</span>
              <input id={`neg-amount-${caseId}`} className="input" inputMode="numeric" placeholder="Leave blank if no figure was named" value={proposedAmount} onChange={(e) => setProposedAmount(e.target.value)} style={{ fontSize: 13 }} />
            </label>

            <label style={field}>
              <span>{party === 'debtor_counsel' ? 'What did they say or offer?' : 'What we sent'}</span>
              <textarea id={`neg-summary-${caseId}`} className="input" rows={party === 'pandas_lp' ? 6 : 3} value={summary} onChange={(e) => setSummary(e.target.value)} style={{ fontSize: 13, resize: 'vertical' }} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <label style={field}>
                <span>Where does it stand?</span>
                <select id={`neg-status-${caseId}`} className="input" value={statusChoice || defaultStatusFor(party)} onChange={(e) => setStatusChoice(e.target.value as NegotiationStatus)} style={{ fontSize: 13 }}>
                  {NEGOTIATION_STATUSES.map((s) => <option key={s} value={s}>{NEGOTIATION_STATUS_LABEL[s]}</option>)}
                </select>
              </label>
              <label style={field}>
                <span>Next action (optional)</span>
                <input id={`neg-next-${caseId}`} className="input" placeholder={party === 'debtor_counsel' ? 'e.g. Advise client and reply' : 'e.g. Receive signed undertaking'} value={nextAction} onChange={(e) => setNextAction(e.target.value)} style={{ fontSize: 13 }} />
              </label>
              <label style={field}>
                <span>Due by</span>
                <input id={`neg-due-${caseId}`} type="date" className="input" value={nextActionDue} onChange={(e) => setNextActionDue(e.target.value)} style={{ fontSize: 13 }} />
              </label>
            </div>

            {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
            {notice && <p style={{ ...muted, fontSize: 13 }}>{notice}</p>}
            <div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Logging…' : party === 'debtor_counsel' ? 'Log their response' : 'Log our reply'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

/* ── Steps 2–5 for one response from the debtor's lawyer ───────────── */

function ReplyWorkflow({
  caseId,
  caseTitle,
  caseNumber,
  response,
  onRoundPatched,
  onLogged,
}: {
  caseId: string
  caseTitle?: string | null
  caseNumber?: number | null
  response: NegotiationRound
  onRoundPatched: (id: string, patch: Partial<NegotiationRound>) => void
  onLogged: () => Promise<void> | void
}) {
  // Step 2: advice to the client.
  const [advice, setAdvice] = useState(response.advice_note ?? '')
  const [adviceHints, setAdviceHints] = useState('')
  const [adviceBusy, setAdviceBusy] = useState<'' | 'drafting' | 'saving' | 'sending'>('')
  const [adviceMsg, setAdviceMsg] = useState('')
  const [adviceErr, setAdviceErr] = useState('')

  // Step 3: the client's instructions.
  const [instructions, setInstructions] = useState(response.client_instructions ?? '')
  const [instrBusy, setInstrBusy] = useState(false)
  const [instrErr, setInstrErr] = useState('')

  // Step 4: the letter. Only the body comes from the agent; every other field is the lawyer's.
  const [ourRef, setOurRef] = useState(referenceFor(caseNumber ?? null))
  const [letterDate, setLetterDate] = useState('')
  const [firm, setFirm] = useState(response.counsel_name ?? '')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [attention, setAttention] = useState('')
  const [salutation, setSalutation] = useState('Dear Sir,')
  const [re, setRe] = useState('')
  const [signatory, setSignatory] = useState(DEFAULT_SIGNATORY)
  const [body, setBody] = useState('')
  const [staffNote, setStaffNote] = useState('')
  const [extraDraftNotes, setExtraDraftNotes] = useState('')
  const [aiDrafted, setAiDrafted] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftErr, setDraftErr] = useState('')

  // Step 5: stamp, send, track.
  const [followUp, setFollowUp] = useState('')
  const [followUpDue, setFollowUpDue] = useState('')
  const [logging, setLogging] = useState(false)
  const [logErr, setLogErr] = useState('')
  const [docxBusy, setDocxBusy] = useState(false)

  const instructionsSaved = !!response.client_instructions?.trim()
  const placeholdersLeft = /\[DATE\]|\[[A-Z ]{3,}\]/.test(body) || /\[DATE\]/.test(re)

  const letter = () => ({
    date: letterDate,
    ourRef,
    addressee: { firm, email, address, attention },
    salutation,
    re,
    body,
    signatory,
    stamp: true,
  })

  async function draftAdvice() {
    setAdviceErr('')
    setAdviceMsg('')
    setAdviceBusy('drafting')
    try {
      const res = await authedFetch('/api/admin/negotiations/advice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ negotiationId: response.id, notes: adviceHints.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAdviceErr(data.error || 'Could not draft the advice note.')
        return
      }
      setAdvice(data.advice)
    } catch {
      setAdviceErr('Network error. Please try again.')
    } finally {
      setAdviceBusy('')
    }
  }

  async function saveAdvice() {
    setAdviceErr('')
    setAdviceMsg('')
    setAdviceBusy('saving')
    try {
      const res = await authedFetch('/api/admin/negotiations', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: response.id, adviceNote: advice }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAdviceErr(data.error || 'Could not save the note.')
        return
      }
      onRoundPatched(response.id, data.round)
      setAdviceMsg('Saved.')
    } catch {
      setAdviceErr('Network error. Please try again.')
    } finally {
      setAdviceBusy('')
    }
  }

  async function emailAdvice() {
    setAdviceErr('')
    setAdviceMsg('')
    setAdviceBusy('sending')
    try {
      const res = await authedFetch('/api/admin/negotiations/advice/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ negotiationId: response.id, adviceNote: advice }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAdviceErr(data.error || 'Could not email the note.')
        return
      }
      onRoundPatched(response.id, { advice_note: advice.trim(), advice_sent_at: data.adviceSentAt })
      setAdviceMsg('Emailed to the client. Their reply comes to the firm inbox; record their instructions below.')
    } catch {
      setAdviceErr('Network error. Please try again.')
    } finally {
      setAdviceBusy('')
    }
  }

  async function saveInstructions() {
    setInstrErr('')
    setInstrBusy(true)
    try {
      const res = await authedFetch('/api/admin/negotiations', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: response.id, clientInstructions: instructions }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setInstrErr(data.error || 'Could not save the instructions.')
        return
      }
      onRoundPatched(response.id, data.round)
    } catch {
      setInstrErr('Network error. Please try again.')
    } finally {
      setInstrBusy(false)
    }
  }

  async function draftReply() {
    setDraftErr('')
    setDrafting(true)
    try {
      const res = await authedFetch('/api/admin/negotiations/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, negotiationId: response.id, instructions: extraDraftNotes.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setDraftErr(data.error || 'Could not draft the reply.')
        return
      }
      setBody(data.draft)
      if (data.re) setRe(data.re)
      setStaffNote(data.staffNote || '')
      setAiDrafted(true)
    } catch {
      setDraftErr('Network error. Please try again.')
    } finally {
      setDrafting(false)
    }
  }

  function previewPdf() {
    try {
      const doc = buildReplyLetterPdf(letter())
      window.open(doc.output('bloburl').toString(), '_blank', 'noopener')
    } catch (err) {
      console.error('Failed to build the reply PDF:', err)
      setLogErr('Could not build the PDF preview.')
    }
  }

  async function downloadWord() {
    setDocxBusy(true)
    try {
      await downloadReplyLetterDocx(`reply ${ourRef} ${caseTitle || ''}`, letter())
    } catch (err) {
      console.error('Failed to build the Word copy:', err)
      setLogErr('Could not build the Word copy.')
    } finally {
      setDocxBusy(false)
    }
  }

  async function logAsSent() {
    setLogErr('')
    if (!body.trim()) {
      setLogErr('The letter body is empty.')
      return
    }
    if (placeholdersLeft) {
      setLogErr('Fill in every [DATE] or other placeholder in the letter before logging it as sent.')
      return
    }
    if (followUpDue && !followUp.trim()) {
      setLogErr('Say what the follow-up is, or clear its due date.')
      return
    }
    setLogging(true)
    try {
      // Built from the fields as they are now, so the attachment always matches the text logged.
      const pdfBase64 = buildReplyLetterPdf(letter()).output('datauristring').split(',')[1]
      const res = await authedFetch('/api/admin/negotiations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId,
          party: 'pandas_lp',
          summary: body.trim(),
          aiDrafted,
          attachmentBase64: pdfBase64,
          attachmentType: 'application/pdf',
          status: 'awaiting_their_reply',
          nextAction: followUp.trim() || undefined,
          nextActionDue: followUp.trim() && followUpDue ? followUpDue : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLogErr(data.error || 'Could not log the reply.')
        return
      }
      await onLogged()
    } catch {
      setLogErr('Network error. Please try again.')
    } finally {
      setLogging(false)
    }
  }

  return (
    <div style={{ ...box, borderColor: 'var(--accent)', gap: 12 }}>
      <div style={{ fontWeight: 700 }}>
        Answer their response of {new Date(response.occurred_at).toLocaleDateString('en-NG')}
      </div>

      {/* 2 — Advise the client */}
      <div style={box}>
        <div style={stepTitle}>
          <span>1. Advise the client</span>
          {response.advice_sent_at && <span style={muted}>Emailed {formatWhen(response.advice_sent_at)}</span>}
        </div>
        <p style={muted}>The agent summarises their response, sets out the client&rsquo;s options and lists the instructions we need. Edit it, then email it to the client.</p>
        <label style={field}>
          <span style={muted}>Anything the note should cover (optional)</span>
          <input id={`adv-hints-${response.id}`} className="input" value={adviceHints} onChange={(e) => setAdviceHints(e.target.value)} style={{ fontSize: 13 }} />
        </label>
        <div>
          <button type="button" className="btn btn-sm" disabled={adviceBusy !== ''} onClick={draftAdvice}>
            {adviceBusy === 'drafting' ? 'Drafting…' : advice ? 'Redraft advice note' : 'Draft advice note'}
          </button>
        </div>
        <textarea id={`adv-note-${response.id}`} className="input" rows={advice ? 12 : 3} placeholder="The advice note appears here for you to edit." value={advice} onChange={(e) => setAdvice(e.target.value)} style={{ fontSize: 13, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm" disabled={!advice.trim() || adviceBusy !== ''} onClick={saveAdvice}>
            {adviceBusy === 'saving' ? 'Saving…' : 'Save note'}
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!advice.trim() || adviceBusy !== ''} onClick={emailAdvice}>
            {adviceBusy === 'sending' ? 'Sending…' : response.advice_sent_at ? 'Email again' : 'Email to client'}
          </button>
        </div>
        {adviceMsg && <p style={muted}>{adviceMsg}</p>}
        {adviceErr && <p style={{ color: 'var(--danger)', margin: 0 }}>{adviceErr}</p>}
      </div>

      {/* 3 — Client's instructions */}
      <div style={box}>
        <div style={stepTitle}>
          <span>2. Record the client&rsquo;s instructions</span>
          {response.instructions_received_at && <span style={muted}>Recorded {formatWhen(response.instructions_received_at)}</span>}
        </div>
        <textarea
          id={`instr-${response.id}`}
          className="input"
          rows={4}
          placeholder="e.g. Accept ₦3,300,000 as full and final. Reject instalments. Demand full payment by [date] and a signed undertaking within three business days."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          style={{ fontSize: 13, resize: 'vertical' }}
        />
        <div>
          <button type="button" className="btn btn-sm" disabled={!instructions.trim() || instrBusy} onClick={saveInstructions}>
            {instrBusy ? 'Saving…' : instructionsSaved ? 'Update instructions' : 'Save instructions'}
          </button>
        </div>
        {instrErr && <p style={{ color: 'var(--danger)', margin: 0 }}>{instrErr}</p>}
      </div>

      {/* 4 — Draft the reply */}
      <div style={box}>
        <div style={stepTitle}><span>3. Draft the reply</span></div>
        <p style={muted}>
          The agent writes the body in the firm&rsquo;s house style from the client&rsquo;s instructions. It never writes dates: it leaves [DATE] wherever one is needed.
        </p>
        <label style={field}>
          <span style={muted}>Extra instructions for this draft (optional)</span>
          <input id={`draft-extra-${response.id}`} className="input" value={extraDraftNotes} onChange={(e) => setExtraDraftNotes(e.target.value)} style={{ fontSize: 13 }} />
        </label>
        <div>
          <button type="button" className="btn btn-sm" disabled={!instructionsSaved || drafting} onClick={draftReply} title={instructionsSaved ? undefined : 'Save the client’s instructions first'}>
            {drafting ? 'Drafting…' : body ? 'Redraft from instructions' : 'Draft reply from instructions'}
          </button>
          {!instructionsSaved && <span style={{ ...muted, marginLeft: 8 }}>Save the client&rsquo;s instructions first.</span>}
        </div>
        {draftErr && <p style={{ color: 'var(--danger)', margin: 0 }}>{draftErr}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          <label style={field}><span>Our Ref</span><input id={`l-ref-${response.id}`} className="input" value={ourRef} onChange={(e) => setOurRef(e.target.value)} style={{ fontSize: 13 }} /></label>
          <label style={field}><span>Date (blank to write by hand)</span><input id={`l-date-${response.id}`} className="input" placeholder="e.g. 26th September, 2026" value={letterDate} onChange={(e) => setLetterDate(e.target.value)} style={{ fontSize: 13 }} /></label>
          <label style={field}><span>Their firm / chambers</span><input id={`l-firm-${response.id}`} className="input" value={firm} onChange={(e) => setFirm(e.target.value)} style={{ fontSize: 13 }} /></label>
          <label style={field}><span>Their email</span><input id={`l-email-${response.id}`} className="input" value={email} onChange={(e) => setEmail(e.target.value)} style={{ fontSize: 13 }} /></label>
          <label style={field}><span>Their address</span><input id={`l-addr-${response.id}`} className="input" value={address} onChange={(e) => setAddress(e.target.value)} style={{ fontSize: 13 }} /></label>
          <label style={field}><span>Attention</span><input id={`l-attn-${response.id}`} className="input" placeholder="e.g. O. D. Onokpa Esq." value={attention} onChange={(e) => setAttention(e.target.value)} style={{ fontSize: 13 }} /></label>
          <label style={field}>
            <span>Salutation</span>
            <select id={`l-sal-${response.id}`} className="input" value={salutation} onChange={(e) => setSalutation(e.target.value)} style={{ fontSize: 13 }}>
              {['Dear Sir,', 'Dear Madam,', 'Dear Sir/Madam,', 'Dear Colleague,'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={field}><span>Signatory</span><input id={`l-sign-${response.id}`} className="input" value={signatory} onChange={(e) => setSignatory(e.target.value)} style={{ fontSize: 13 }} /></label>
        </div>
        <label style={field}>
          <span>RE line</span>
          <input id={`l-re-${response.id}`} className="input" placeholder="LETTER OF DEMAND FOR RECOVERY OF OUTSTANDING SUM OF ₦… (… NAIRA)" value={re} onChange={(e) => setRe(e.target.value)} style={{ fontSize: 13 }} />
        </label>
        <label style={field}>
          <span>Letter body</span>
          <textarea id={`l-body-${response.id}`} className="input" rows={body ? 18 : 4} value={body} onChange={(e) => { setBody(e.target.value); setAiDrafted(false) }} style={{ fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
        </label>
        {staffNote && (
          <div style={{ padding: '8px 10px', background: 'var(--bg-1)', borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap' }}>
            <strong>For the reviewing lawyer:</strong> {staffNote}
          </div>
        )}
        {placeholdersLeft && body && <p style={{ color: 'var(--warning)', margin: 0, fontSize: 12 }}>The letter still has placeholders such as [DATE] to fill in.</p>}
      </div>

      {/* 5 — Stamp, send, track */}
      <div style={box}>
        <div style={stepTitle}><span>4. Stamp, send and track</span></div>
        <p style={muted}>
          Preview puts the letter on letterhead with the NBA stamp. Logging it as sent attaches that stamped PDF, emails the client a copy, sets the status to &ldquo;Awaiting their reply&rdquo; and schedules the follow-up. Serve it on WhatsApp from the thread once logged.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm" disabled={!body.trim()} onClick={previewPdf}>Preview stamped PDF</button>
          <button type="button" className="btn btn-sm" disabled={!body.trim() || docxBusy} onClick={downloadWord}>{docxBusy ? 'Preparing…' : 'Download Word copy'}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 8 }}>
          <label style={field}>
            <span>Follow-up</span>
            <input id={`l-fu-${response.id}`} className="input" placeholder="e.g. Receive signed undertaking" value={followUp} onChange={(e) => setFollowUp(e.target.value)} style={{ fontSize: 13 }} />
          </label>
          <label style={field}>
            <span>Due by</span>
            <input id={`l-fudue-${response.id}`} type="date" className="input" value={followUpDue} onChange={(e) => setFollowUpDue(e.target.value)} style={{ fontSize: 13 }} />
          </label>
        </div>
        <div>
          <button type="button" className="btn btn-primary btn-sm" disabled={!body.trim() || logging} onClick={logAsSent}>
            {logging ? 'Logging…' : 'Log reply as sent'}
          </button>
        </div>
        {logErr && <p style={{ color: 'var(--danger)', margin: 0 }}>{logErr}</p>}
      </div>
    </div>
  )
}
