'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { EVIDENCE_BUCKET, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from '@/lib/evidence'
import { FIRM_WHATSAPP, FIRM_WHATSAPP_URL } from '@/lib/courtPackEmail'

type Row = { file: File; state: 'waiting' | 'uploading' | 'done' | 'failed'; error?: string; path?: string }

const sendable = (f: File) => DOCUMENT_TYPES.includes(f.type) && f.size <= MAX_DOCUMENT_BYTES

// The client uploads the signed court forms from the private link in our e-mail. Each file goes
// straight into the case's private evidence folder; then the firm is told they came back.
export default function UploadSignedForms() {
  const t = useSearchParams().get('t') ?? ''
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const h1: React.CSSProperties = { fontSize: 34, lineHeight: 1.1, letterSpacing: '-0.025em', fontWeight: 500, marginBottom: 14 }
  const p: React.CSSProperties = { fontSize: 16.5, color: '#3A3A38', lineHeight: 1.55, margin: '0 0 12px' }
  const btn: React.CSSProperties = { background: '#1A1A1A', color: '#FAFAF8', border: 'none', padding: '15px 22px', fontSize: 16, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }
  const help = <p style={{ ...p, fontSize: 15 }}>Questions? Chat or call us on WhatsApp: <a href={FIRM_WHATSAPP_URL}>{FIRM_WHATSAPP}</a>.</p>

  if (!t) {
    return (
      <>
        <h1 style={h1}>Upload your signed forms</h1>
        <p style={p}>This link is incomplete. Please open the link from our e-mail again, or send the scans to us on WhatsApp.</p>
        {help}
      </>
    )
  }

  function choose(list: FileList | null) {
    setError('')
    const picked = Array.from(list ?? []).map((file): Row => {
      if (!DOCUMENT_TYPES.includes(file.type)) return { file, state: 'failed', error: 'Please send PDFs or photos (JPG or PNG).' }
      if (file.size > MAX_DOCUMENT_BYTES) return { file, state: 'failed', error: 'Over 10 MB. Please take a smaller photo or scan.' }
      return { file, state: 'waiting' }
    })
    setRows((r) => [...r.filter((x) => x.state === 'done'), ...picked])
  }

  async function upload() {
    setBusy(true)
    setError('')
    const next = [...rows]
    const update = (i: number, patch: Partial<Row>) => { next[i] = { ...next[i], ...patch }; setRows([...next]) }
    for (let i = 0; i < next.length; i++) {
      if ((next[i].state !== 'waiting' && next[i].state !== 'failed') || !sendable(next[i].file)) continue
      const f = next[i].file
      update(i, { state: 'uploading', error: undefined })
      try {
        const res = await fetch('/api/upload-link/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t, filename: f.name, mediaType: f.type, size: f.size }) })
        const slot = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(slot.error || 'Could not start the upload.')
        const { error: upErr } = await supabase.storage.from(EVIDENCE_BUCKET).uploadToSignedUrl(slot.path, slot.token, f, { contentType: f.type })
        if (upErr) throw new Error('The upload did not finish. Please check your connection and try again.')
        update(i, { state: 'done', path: slot.path })
      } catch (err) {
        update(i, { state: 'failed', error: err instanceof Error ? err.message : 'Upload failed.' })
      }
    }
    const uploaded = next.filter((r) => r.state === 'done' && r.path)
    if (uploaded.length) {
      try {
        const res = await fetch('/api/upload-link/done', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t, files: uploaded.map((r) => ({ path: r.path, filename: r.file.name, mediaType: r.file.type, size: r.file.size })) }) })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Your files were uploaded but could not be recorded.')
        if (next.every((r) => r.state === 'done' || !sendable(r.file))) setDone(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please tell us on WhatsApp.')
      }
    }
    setBusy(false)
  }

  if (done) {
    return (
      <>
        <h1 style={h1}>Thank you, we have your forms</h1>
        <p style={p}>We received {rows.filter((r) => r.state === 'done').length} file{rows.filter((r) => r.state === 'done').length === 1 ? '' : 's'}. Your lawyer will check them and tell you the next step, including when to come to the registry.</p>
        <p style={p}>Please keep the signed originals safe. They are needed for filing.</p>
        {help}
      </>
    )
  }

  const waiting = rows.filter((r) => (r.state === 'waiting' || r.state === 'failed') && sendable(r.file)).length
  return (
    <>
      <h1 style={h1}>Upload your signed forms</h1>
      <p style={p}>Add a scan or a clear photo of every signed page. PDFs and photos (JPG or PNG) up to 10 MB each. You can add several at once.</p>
      <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={(e) => { choose(e.target.files); e.target.value = '' }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
        <button type="button" style={{ ...btn, background: 'transparent', color: '#1A1A1A', border: '1.5px solid #1A1A1A' }} disabled={busy} onClick={() => inputRef.current?.click()}>{rows.length ? 'Add more files' : 'Choose files'}</button>
        {waiting > 0 && <button type="button" style={btn} disabled={busy} onClick={upload}>{busy ? 'Uploading…' : `Send ${waiting} file${waiting === 1 ? '' : 's'}`}</button>}
      </div>
      {rows.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'grid', gap: 8 }}>
          {rows.map((r, i) => (
            <li key={`${r.file.name}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15, padding: '10px 12px', border: '1px solid #E4E2DC', background: '#FFF' }}>
              <span style={{ overflowWrap: 'anywhere' }}>{r.file.name}{r.error && <span style={{ display: 'block', color: 'var(--danger)', fontSize: 13.5 }}>{r.error}</span>}</span>
              <span style={{ whiteSpace: 'nowrap', color: r.state === 'done' ? '#16794A' : r.state === 'failed' ? 'var(--danger)' : '#6B6B66' }}>
                {r.state === 'done' ? 'Sent ✓' : r.state === 'uploading' ? 'Sending…' : r.state === 'failed' ? 'Not sent' : 'Ready'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: 14.5 }}>{error}</p>}
      {help}
    </>
  )
}
