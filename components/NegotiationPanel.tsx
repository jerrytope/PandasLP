'use client'

import { useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { formatNaira as naira } from '@/lib/formatNaira'

/* ─────────────────────────────────────────────────────────────
   A demand letter doesn't just get paid or ignored — the debtor's
   own lawyer often responds instead, disputing the amount or
   proposing terms. This panel is the thread for that: log what
   they said, then either log our reply by hand or have the AI
   draft one from the case facts and the thread so far, which staff
   review and edit before it's logged as sent. Same "AI drafts, a
   human commits it" shape as everywhere else in this app.

   The stance/target-figure fields the AI draft form asks for exist
   because lib/agents.ts's NEGOTIATION_REPLY_PROMPT refuses to guess
   a settlement position on its own — a careless concession here
   can be quoted back in court, so the model asks rather than assumes.
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
}

const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg']

export default function NegotiationPanel({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false)
  const [rounds, setRounds] = useState<NegotiationRound[] | null>(null)
  const [loading, setLoading] = useState(false)

  const [party, setParty] = useState<Party>('debtor_counsel')
  const [counselName, setCounselName] = useState('')
  const [proposedAmount, setProposedAmount] = useState('')
  const [summary, setSummary] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [aiDrafted, setAiDrafted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Reads the attached letter as soon as it's selected so staff don't have to retype what it
  // already says — see app/api/admin/negotiations/extract/route.ts. Fields stay editable
  // either way: a wrong or missing read is a form staff can correct, not a blocker.
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')

  // AI-draft sub-form — only relevant while logging our own reply.
  const [showDraftForm, setShowDraftForm] = useState(false)
  const [stance, setStance] = useState<'accept' | 'reject' | 'counter' | 'request_info'>('counter')
  const [authorizedAmount, setAuthorizedAmount] = useState('')
  const [draftInstructions, setDraftInstructions] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState('')

  const hasDebtorRound = (rounds || []).some((r) => r.party === 'debtor_counsel')

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

  function resetForm() {
    setCounselName('')
    setProposedAmount('')
    setSummary('')
    setAttachmentFile(null)
    setAiDrafted(false)
    setShowDraftForm(false)
    setDraftInstructions('')
    setAuthorizedAmount('')
    setDraftError('')
  }

  const STANCE_LABEL: Record<typeof stance, string> = {
    accept: 'Accept their offer',
    reject: 'Reject, hold firm on the original amount',
    counter: 'Counter at a different figure',
    request_info: 'Ask for more time or information before responding',
  }

  async function generateDraft() {
    setDraftError('')
    setDrafting(true)
    try {
      const res = await authedFetch('/api/admin/negotiations/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId,
          stance: STANCE_LABEL[stance],
          authorizedAmount: authorizedAmount.trim() || undefined,
          instructions: draftInstructions.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setDraftError(data.error || 'Could not generate a draft.')
        return
      }
      setSummary(data.draft)
      setAiDrafted(true)
      if (authorizedAmount.trim()) setProposedAmount(authorizedAmount.trim())
    } catch {
      setDraftError('Network error. Please try again.')
    } finally {
      setDrafting(false)
    }
  }

  async function handleAttachmentSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setAttachmentFile(file)
    setExtractError('')
    if (!file || party !== 'debtor_counsel') return
    if (!ACCEPTED.includes(file.type)) {
      setExtractError('Attachment must be a PDF, PNG or JPEG to read automatically — fill the fields in by hand instead.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setExtractError('File is too large to read automatically (max 10 MB) — fill the fields in by hand instead.')
      return
    }

    setExtracting(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await authedFetch('/api/admin/negotiations/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, mediaType: file.type }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setExtractError(data.error || 'Could not read this file — fill the fields in by hand instead.')
        return
      }
      if (data.counselName) setCounselName(data.counselName)
      if (data.proposedAmount != null) setProposedAmount(String(data.proposedAmount))
      if (data.summary) setSummary(data.summary)
    } catch {
      setExtractError('Network error while reading the file — fill the fields in by hand instead.')
    } finally {
      setExtracting(false)
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
      attachmentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(attachmentFile)
      })
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
          aiDrafted,
          attachmentBase64,
          attachmentType,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not save this entry.')
        return
      }
      setNotice(data.warning || 'Logged.')
      resetForm()
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const latest = rounds && rounds.length > 0 ? rounds[rounds.length - 1] : null

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={toggle}>
        {open ? 'Hide negotiation' : 'Negotiation'}
        {latest ? ` · ${latest.party === 'debtor_counsel' ? 'awaiting our reply' : 'awaiting their reply'}` : ''}
      </button>

      {open && (
        <div style={{ marginTop: 10, padding: 14, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
          {loading && <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p>}

          {rounds && rounds.length > 0 && (
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rounds.map((r) => (
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
                    <strong>
                      {r.party === 'debtor_counsel' ? `Debtor's counsel${r.counsel_name ? ` — ${r.counsel_name}` : ''}` : 'Pandas LP'}
                    </strong>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {new Date(r.occurred_at).toLocaleDateString('en-NG')}
                      {r.proposed_amount != null ? ` · ${naira(r.proposed_amount)}` : ''}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.summary}</div>
                  <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                    {r.ai_drafted && 'AI-drafted, reviewed by staff · '}
                    Logged by {r.logged_by}
                    {r.attachmentUrl && (
                      <>
                        {' · '}
                        <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer">View attachment</a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 4 }}>
              <legend style={{ padding: 0 }}>What are you logging?</legend>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" name={`party-${caseId}`} checked={party === 'debtor_counsel'} onChange={() => { setParty('debtor_counsel'); setShowDraftForm(false) }} />
                  A counter we received
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" name={`party-${caseId}`} checked={party === 'pandas_lp'} onChange={() => setParty('pandas_lp')} />
                  Our reply
                </label>
              </div>
            </fieldset>

            {party === 'debtor_counsel' && (
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Their letter (PDF/PNG/JPEG) — attach it and the fields below fill in automatically</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={handleAttachmentSelect}
                  style={{ fontSize: 12 }}
                />
                {extracting && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Reading the letter…</span>}
                {extractError && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{extractError}</span>}
              </label>
            )}

            {party === 'debtor_counsel' && (
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Debtor&rsquo;s lawyer / firm name</span>
                <input
                  className="input"
                  placeholder="Filled in automatically once a letter is attached — or type it in directly"
                  value={counselName}
                  onChange={(e) => setCounselName(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </label>
            )}

            <label style={{ display: 'grid', gap: 4 }}>
              <span>Figure named, if any (₦)</span>
              <input
                className="input"
                inputMode="numeric"
                placeholder="Leave blank if no figure was named"
                value={proposedAmount}
                onChange={(e) => setProposedAmount(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </label>

            {party === 'pandas_lp' && hasDebtorRound && (
              <div style={{ padding: 10, border: '1px dashed var(--border)', borderRadius: 6 }}>
                {!showDraftForm ? (
                  <button type="button" className="btn btn-sm" onClick={() => setShowDraftForm(true)}>
                    Draft this reply with AI
                  </button>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span>How should we respond?</span>
                      <select className="input" value={stance} onChange={(e) => setStance(e.target.value as typeof stance)} style={{ fontSize: 13 }}>
                        {(Object.keys(STANCE_LABEL) as (typeof stance)[]).map((s) => (
                          <option key={s} value={s}>{STANCE_LABEL[s]}</option>
                        ))}
                      </select>
                    </label>
                    {(stance === 'accept' || stance === 'counter') && (
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span>Authorized figure {stance === 'counter' ? 'to offer' : 'to accept'} (₦)</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          placeholder="Required — the draft will not invent a number"
                          value={authorizedAmount}
                          onChange={(e) => setAuthorizedAmount(e.target.value)}
                          style={{ fontSize: 13 }}
                        />
                      </label>
                    )}
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Anything else the draft should know (optional)</span>
                      <textarea
                        className="input"
                        rows={2}
                        value={draftInstructions}
                        onChange={(e) => setDraftInstructions(e.target.value)}
                        style={{ fontSize: 13, resize: 'vertical' }}
                      />
                    </label>
                    {draftError && <p style={{ color: 'var(--danger)', margin: 0 }}>{draftError}</p>}
                    <div>
                      <button type="button" className="btn btn-primary btn-sm" disabled={drafting} onClick={generateDraft}>
                        {drafting ? 'Drafting…' : 'Generate draft'}
                      </button>
                    </div>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 12 }}>
                      Fills the reply below. Read it before logging — nothing is sent from here, this only records what you send yourself.
                    </p>
                  </div>
                )}
              </div>
            )}

            <label style={{ display: 'grid', gap: 4 }}>
              <span>{party === 'debtor_counsel' ? 'What did they say or offer?' : 'Our reply'}</span>
              <textarea
                className="input"
                rows={party === 'pandas_lp' ? 8 : 3}
                placeholder={party === 'debtor_counsel' ? 'Filled in automatically once a letter is attached above — or describe it yourself if there’s nothing to attach.' : 'The reply text, as it will be sent to opposing counsel.'}
                value={summary}
                onChange={(e) => { setSummary(e.target.value); setAiDrafted(false) }}
                style={{ fontSize: 13, resize: 'vertical' }}
              />
            </label>

            {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
            {notice && <p style={{ color: 'var(--text-muted)', margin: 0 }}>{notice}</p>}

            <div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Logging…' : party === 'debtor_counsel' ? 'Log counter' : 'Log our reply'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
