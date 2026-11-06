'use client'

import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { authedFetch, supabase } from '@/lib/supabaseClient'
import { renderFormattedText } from '@/lib/renderFormattedText'
import { EVIDENCE_ACCEPT, EVIDENCE_BUCKET, EVIDENCE_TYPES, isVideo, maxBytesFor, sizeLimitText } from '@/lib/evidence'
import { parseEvidenceText, type Electronic, type EvidenceNote } from '@/lib/evidenceNote'
import { formatDate, type CaseEvidenceRow } from './types'

/* ─────────────────────────────────────────────────────────────
   Evidence Files: everything the client sent and everything staff
   added, each with a lawyer's note (what it is, what it proves, its
   date or reference, whether it was printed from a phone or computer).
   The filing-pack drafts read these notes as the authoritative
   description of each document.
   ───────────────────────────────────────────────────────────── */

const lbl: React.CSSProperties = { display: 'grid', gap: 4, fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }
const box: React.CSSProperties = { border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md, 10px)', background: 'var(--bg-2)', padding: 14 }
const emptyNote: EvidenceNote = { what: '', proves: '', dateRef: '', electronic: undefined, other: '' }

function NoteFields({ note, onChange }: { note: EvidenceNote; onChange: (n: EvidenceNote) => void }) {
  const set = (patch: Partial<EvidenceNote>) => onChange({ ...note, ...patch })
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <label style={lbl}>What is this document? (required)
        <input className="input" value={note.what} placeholder="e.g. Access Bank statement of account of the client, 1 Jan – 31 Dec 2025" onChange={(e) => set({ what: e.target.value })} />
      </label>
      <label style={lbl}>What does it prove?
        <input className="input" value={note.proves ?? ''} placeholder="e.g. The client paid ₦600,000 to the defendant: ₦400,000 and ₦100,000 on 3 Nov 2025, ₦100,000 on 6 Nov 2025" onChange={(e) => set({ proves: e.target.value })} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <label style={lbl}>Date / reference
          <input className="input" value={note.dateRef ?? ''} placeholder="e.g. Account 1709035131; transfer refs on pages 55–56" onChange={(e) => set({ dateRef: e.target.value })} />
        </label>
        <label style={lbl}>Printed from a phone or computer?
          <select className="input" value={note.electronic ?? ''} onChange={(e) => set({ electronic: (e.target.value || undefined) as Electronic | undefined })}>
            <option value="">—</option>
            <option value="yes">Yes — the Section 84 certificate must cover it</option>
            <option value="no">No — a physical original</option>
            <option value="unsure">Not sure</option>
          </select>
        </label>
      </div>
      <label style={lbl}>Anything else worth knowing
        <textarea className="input" rows={2} value={note.other ?? ''} placeholder="e.g. Client to bring the original. The payee name on the statement differs from the defendant's name." onChange={(e) => set({ other: e.target.value })} />
      </label>
    </div>
  )
}

export default function EvidenceTab({ caseId, evidence, loading, error, onChange }: { caseId: string; evidence: CaseEvidenceRow[] | null; loading: boolean; error: string; onChange: () => void | Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState<EvidenceNote>(emptyNote)
  const [read, setRead] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editNote, setEditNote] = useState<EvidenceNote>(emptyNote)

  async function add() {
    if (!file) { setErr('Choose a file first.'); return }
    if (!EVIDENCE_TYPES.includes(file.type)) { setErr('Upload a PDF, an image (JPG, PNG, WEBP) or a video (MP4, MOV, WEBM, 3GP).'); return }
    if (file.size > maxBytesFor(file.type)) { setErr(`The file must be under ${sizeLimitText(file.type)}.`); return }
    if (!note.what.trim()) { setErr('Say what the document is.'); return }
    setBusy(true); setErr(''); setMsg(read && !isVideo(file.type) ? 'Uploading, then reading it… a long PDF can take up to a minute.' : 'Uploading… a video can take a few minutes.')
    try {
      const slotRes = await authedFetch('/api/admin/case-evidence/upload-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId, filename: file.name, mediaType: file.type, size: file.size }) })
      const slot = await slotRes.json()
      if (!slotRes.ok) throw new Error(slot.error || 'Could not start the upload.')
      const { error: upErr } = await supabase.storage.from(EVIDENCE_BUCKET).uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type })
      if (upErr) throw new Error('The upload did not finish. Please try again.')
      const res = await authedFetch('/api/admin/case-evidence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId, path: slot.path, filename: file.name, mediaType: file.type, size: file.size, note, read }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save the document.')
      setMsg(`${file.name}: ${data.readNote || 'Saved.'}`)
      setFile(null); setNote(emptyNote); setAdding(false)
      if (fileRef.current) fileRef.current.value = ''
      await onChange()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.'); setMsg('')
    } finally {
      setBusy(false)
    }
  }

  async function saveNote(id: string) {
    if (!editNote.what.trim()) { setErr('Say what the document is.'); return }
    setBusy(true); setErr('')
    try {
      const res = await authedFetch('/api/admin/case-evidence', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, note: editNote }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save the note.')
      setEditing(null)
      await onChange()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the note.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...box, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>Add a document</strong>
          <span style={{ fontSize: 12.5, color: 'var(--text-3)', flex: 1 }}>Bank statements, agreements, receipts, proof of service (PDF and images up to 10 MB, videos up to 50 MB). Your note tells the filing-pack drafts what each document is and proves.</span>
          {!adding && <button type="button" className="btn btn-sm btn-primary" onClick={() => { setAdding(true); setMsg('') }}>Add a document</button>}
        </div>
        {adding && (
          <>
            <input ref={fileRef} type="file" accept={EVIDENCE_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <NoteFields note={note} onChange={setNote} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-2)' }}>
              <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
              Also have the AI read it and pull out the facts that matter (dates, amounts, references). Videos are kept but not read, so describe them in your note.
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={add}>{busy ? 'Working…' : 'Add to Evidence Files'}</button>
              <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => { setAdding(false); setErr('') }}>Cancel</button>
            </div>
          </>
        )}
        {msg && <p style={{ margin: 0, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{msg}</p>}
        {err && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{err}</p>}
      </div>

      {loading && <p style={{ color: 'var(--text-3)' }}>Loading evidence…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {!loading && !error && evidence?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-3)' }}>
          <Paperclip size={32} style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14 }}>No evidence files yet for this case.</div>
        </div>
      )}
      {!loading && evidence && evidence.map((ev) => {
        const { note: n, facts } = parseEvidenceText(ev.extractedFacts)
        const kb = ev.sizeBytes ? ev.sizeBytes / 1024 : null
        const size = kb == null ? null : kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`
        return (
          <div key={ev.id} className="card" style={{ padding: '14px 18px', background: 'var(--bg-2)', display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div>
                {ev.url ? <a href={ev.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>{ev.filename} ↗</a> : <span style={{ fontWeight: 600, fontSize: 14 }}>{ev.filename}</span>}
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{ev.mediaType} {size ? `· ${size}` : ''} · {formatDate(ev.createdAt)}</div>
              </div>
              {editing !== ev.id && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setEditing(ev.id); setEditNote(n ?? emptyNote); setErr('') }}>{n ? 'Edit note' : 'Add note'}</button>}
            </div>
            {editing === ev.id ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <NoteFields note={editNote} onChange={setEditNote} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => saveNote(ev.id)}>Save note</button>
                  <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : n && (
              <div style={{ padding: 10, borderRadius: 6, background: 'var(--bg-1)', fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)', display: 'grid', gap: 2 }}>
                <strong style={{ color: 'var(--text-1)' }}>Lawyer’s note</strong>
                <span><b>What it is:</b> {n.what}</span>
                {n.proves && <span><b>What it proves:</b> {n.proves}</span>}
                {n.dateRef && <span><b>Date / reference:</b> {n.dateRef}</span>}
                {n.electronic && <span><b>Printed from a phone or computer:</b> {n.electronic === 'yes' ? 'Yes (Section 84)' : n.electronic === 'no' ? 'No' : 'Not sure'}</span>}
                {n.other && <span><b>Other:</b> {n.other}</span>}
                {n.by && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Added by {n.by}</span>}
              </div>
            )}
            {facts && (
              <div style={{ padding: 10, borderRadius: 4, background: 'var(--bg-1)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
                <strong style={{ color: 'var(--text-1)', display: 'block', marginBottom: 4 }}>What the AI read from it:</strong>
                {renderFormattedText(facts)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
