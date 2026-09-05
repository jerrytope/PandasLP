'use client'

import { useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { formatNaira as naira } from '@/lib/formatNaira'

/* ─────────────────────────────────────────────────────────────
   Confirming that money was actually recovered for a client.

   Four things are asked for, and three of them are required: the
   amount, proof, whether it was the whole claim or only part, and,
   when it was only part, why the rest was not recovered.

   Whatever is confirmed here is summed into the public figure on
   the homepage (app/api/recovered/route.ts), so this form is the
   last human checkpoint before a number becomes a public claim.
   The same rules are enforced again in the API and once more as a
   CHECK constraint on the table.
   ───────────────────────────────────────────────────────────── */

type RecoveryRow = {
  id: string
  amount_recovered: number
  claim_amount: number | null
  is_full: boolean
  shortfall_reason: string | null
  proof_note: string
  confirmed_by: string
  confirmed_at: string
  client_notified_at: string | null
  proofUrl: string | null
}


const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg']

export default function RecoveryPanel({ caseId, expectedAmount }: { caseId: string; expectedAmount?: number | null }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<RecoveryRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  const [amount, setAmount] = useState('')
  const [isFull, setIsFull] = useState<boolean | null>(null)
  const [reason, setReason] = useState('')
  const [proofNote, setProofNote] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Default on: the recovery landing is the moment a client most wants to hear from us.
  const [notifyClient, setNotifyClient] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await authedFetch(`/api/admin/recoveries?caseId=${encodeURIComponent(caseId)}`)
      const data = await res.json()
      if (res.ok && !data.error) setRows(data.recoveries || [])
    } catch {
      /* the list is supplementary; the form still works without it */
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && rows === null) load()
  }

  function reset() {
    setAmount('')
    setIsFull(null)
    setReason('')
    setProofNote('')
    setProofFile(null)
    setNotifyClient(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')

    const parsed = Number(amount.replace(/[,\s₦]/g, ''))
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      setError('Enter the amount recovered as a whole number of naira.')
      return
    }
    if (isFull === null) {
      setError('Say whether this is the full amount claimed or only part of it.')
      return
    }
    if (!isFull && !reason.trim()) {
      setError('Give the reason the full amount was not recovered.')
      return
    }
    if (!proofNote.trim()) {
      setError('Give the proof of recovery: transfer reference, bank narration or receipt number.')
      return
    }

    let proofBase64: string | undefined
    let proofType: string | undefined
    if (proofFile) {
      if (!ACCEPTED.includes(proofFile.type)) {
        setError('Proof file must be a PDF, PNG or JPEG.')
        return
      }
      if (proofFile.size > 10 * 1024 * 1024) {
        setError('Proof file is too large. Maximum size is 10 MB.')
        return
      }
      proofType = proofFile.type
      proofBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(proofFile)
      })
    }

    setSaving(true)
    try {
      const res = await authedFetch('/api/admin/recoveries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId,
          amountRecovered: parsed,
          isFull,
          shortfallReason: isFull ? '' : reason.trim(),
          proofNote: proofNote.trim(),
          proofBase64,
          proofType,
          notifyClient,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not record the recovery.')
        return
      }
      // Three separate outcomes, reported separately, because "recorded" and "the client was
      // told" are different facts and staff need to know which one actually happened.
      const parts: string[] = ['Recovery recorded. It now counts towards the public total.']
      if (notifyClient && data.emailSent) parts.push('The client has been emailed.')
      if (notifyClient && !data.emailSent) {
        parts.push(`The client was NOT emailed: ${data.emailError || 'the send failed.'}`)
      }
      if (data.warning) parts.push(data.warning)
      setNotice(parts.join(' '))
      reset()
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const confirmedTotal = (rows || []).reduce((s, r) => s + r.amount_recovered, 0)

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={toggle}>
        {open ? 'Hide recovery' : 'Confirm recovery'}
        {confirmedTotal > 0 ? ` · ${naira(confirmedTotal)}` : ''}
      </button>

      {open && (
        <div style={{ marginTop: 10, padding: 14, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
          {loading && <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p>}

          {rows && rows.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {rows.map((r) => (
                <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{naira(r.amount_recovered)}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {r.is_full ? 'Full amount' : 'Part payment'} · {new Date(r.confirmed_at).toLocaleDateString('en-NG')}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>
                    Proof: {r.proof_note}
                    {r.proofUrl && (
                      <>
                        {' · '}
                        <a href={r.proofUrl} target="_blank" rel="noopener noreferrer">View file</a>
                      </>
                    )}
                  </div>
                  {!r.is_full && r.shortfall_reason && (
                    <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>Shortfall: {r.shortfall_reason}</div>
                  )}
                  <div style={{ color: 'var(--text-muted)', marginTop: 3, fontSize: 12 }}>
                    Confirmed by {r.confirmed_by}
                    {' · '}
                    {r.client_notified_at
                      ? `client emailed ${new Date(r.client_notified_at).toLocaleDateString('en-NG')}`
                      : 'client not emailed'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>Amount recovered (₦)</span>
              <input
                className="input"
                inputMode="numeric"
                placeholder={expectedAmount ? `Claim was ${naira(expectedAmount)}` : 'e.g. 850000'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </label>

            <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 4 }}>
              <legend style={{ padding: 0 }}>Was this the full amount claimed?</legend>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" name={`full-${caseId}`} checked={isFull === true} onChange={() => setIsFull(true)} />
                  Full amount
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" name={`full-${caseId}`} checked={isFull === false} onChange={() => setIsFull(false)} />
                  Part of it
                </label>
              </div>
            </fieldset>

            {isFull === false && (
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Why was the full amount not recovered?</span>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. Debtor settled at ₦850,000 after negotiation; client accepted in writing."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ fontSize: 13, resize: 'vertical' }}
                />
              </label>
            )}

            <label style={{ display: 'grid', gap: 4 }}>
              <span>Proof of recovery</span>
              <input
                className="input"
                placeholder="Transfer reference, bank narration or receipt number"
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </label>

            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Supporting file (optional, PDF/PNG/JPEG)</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 12 }}
              />
            </label>

            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={notifyClient}
                onChange={(e) => setNotifyClient(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                Email the client
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                  {isFull === false
                    ? 'They will be told the amount recovered, that it is only part of the claim, and the reason you gave above. No review is requested on a part payment.'
                    : 'They will be told the amount recovered, and invited back for the other work we can do today.'}
                </span>
              </span>
            </label>

            {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
            {notice && <p style={{ color: 'var(--text-muted)', margin: 0 }}>{notice}</p>}

            <div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Recording…' : 'Record recovery'}
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 12 }}>
              This is published. The total of every confirmed recovery appears on the homepage.
            </p>
          </form>
        </div>
      )}
    </>
  )
}
