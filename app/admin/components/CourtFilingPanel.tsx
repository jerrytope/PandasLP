'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import {
  DEFAULT_COSTS_NOTE, INTEREST_RATE, STATE_RULES, STEPS, claimFigures, costsOf, currentStep, deadlinesFor, docTitle, formLabel, interestRateOf, naira, packDraftOrder, packKinds, readiness, rulesFor, stepDone,
  type DocKind, type FilingFacts, type FilingRow, type Party, type StepKey,
} from '@/lib/courtFiling'
import { clientPackMessage, unfilledPlaceholders } from '@/lib/courtPackEmail'
import { isLagosForm } from '@/lib/lagosForms'
import type { AdminCaseRow, CaseAction } from './types'

/* ─────────────────────────────────────────────────────────────
   Court filing tab: the Small Claims Court process, step by step,
   with an AI draft at every step that needs a document.

   Each step shows what the Practice Direction requires, the dates to
   record, and the deadline that follows. AI drafts are saved as
   versions; a practitioner edits, completes, dates and signs them.
   Nothing here files or sends anything.
   ───────────────────────────────────────────────────────────── */

type Filing = FilingRow & { id: string; defence_summary?: string | null; hearing_notes?: string | null; notes?: string | null }
type Doc = { id: string; kind: string; title: string; body: string; ai_generated: boolean; created_at: string; created_by: string | null }
type Svc = { channel: string; status: string; dispatched_at: string; acknowledged_at: string | null }

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (iso?: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—')

const box: React.CSSProperties = { border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md, 10px)', background: 'var(--bg-2)', padding: 16 }
const lbl: React.CSSProperties = { display: 'grid', gap: 4, fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }
const note: React.CSSProperties = { margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }
const row: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }

/* The editable draft for one document kind. Lives outside the panel so typing in it is not
   reset when the panel re-renders. */
function DocEditor({ doc, versions, busy, caseNumber, onSave }: { doc: Doc | undefined; versions: number; busy: boolean; caseNumber: number; onSave: (body: string) => void }) {
  const [text, setText] = useState(doc?.body ?? '')
  useEffect(() => { setText(doc?.body ?? '') }, [doc?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!doc) return null
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12.5, color: 'var(--warning)', fontWeight: 600 }}>
        {doc.ai_generated ? 'AI draft. ' : ''}A practitioner must check, complete, date and sign this before it is filed.
      </div>
      <textarea className="input" rows={16} value={text} onChange={(e) => setText(e.target.value)} style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 12.5, lineHeight: 1.55 }} />
      <div style={row}>
        <button type="button" className="btn btn-sm" disabled={busy || text === doc.body} onClick={() => onSave(text)}>Save edited version</button>
        <button type="button" className="btn btn-sm" onClick={async () => { const { downloadCourtFormDocx } = await import('@/lib/courtFormDocx'); await downloadCourtFormDocx(`${doc.title} case ${caseNumber}`, text) }}>Download Word</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard.writeText(text).catch(() => {})}>Copy</button>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Version {versions} · {doc.ai_generated ? 'AI draft' : doc.created_by ?? 'staff'} · {new Date(doc.created_at).toLocaleString('en-NG')}</span>
      </div>
    </div>
  )
}

export default function CourtFilingPanel({ c, onAction }: { c: AdminCaseRow; onAction?: (caseId: string, action: CaseAction) => void | Promise<void> }) {
  const [filing, setFiling] = useState<Filing | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [svc, setSvc] = useState<Svc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<StepKey | null>(null)
  const [form, setForm] = useState<Partial<Filing>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [packing, setPacking] = useState<string | null>(null)
  // The e-mail to the client: null means "use the generated text", so the figures stay current
  // until staff edit it.
  const [sendTo, setSendTo] = useState<string | null>(null)
  const [sendSubject, setSendSubject] = useState<string | null>(null)
  const [sendMessage, setSendMessage] = useState<string | null>(null)
  const [sentNote, setSentNote] = useState('')
  // Upload of forms edited in Google Docs (or Word). One hidden input; the target is either one
  // form (its own "Upload edited version" button) or the whole pack.
  const importInputRef = useRef<HTMLInputElement>(null)
  const importTargetRef = useRef<DocKind | null>(null)
  const [importNote, setImportNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await authedFetch(`/api/admin/court-filing?caseId=${c.id}`)
      const data = await res.json()
      if (!res.ok) {
        setSetupNeeded(!!data.setupNeeded)
        setError(data.error || 'Could not load the court filing.')
        return
      }
      setFiling(data.filing)
      setDocs(data.documents ?? [])
      setSvc(data.serviceRecords ?? [])
      setOpen((o) => o ?? currentStep({ state: 'lagos', facts: {}, ...(data.filing ?? {}) }))
    } catch {
      setError('Network error while loading the court filing.')
    } finally {
      setLoading(false)
    }
  }, [c.id])

  useEffect(() => { load() }, [load])

  // The working copy every input edits; saved explicitly.
  const f: Filing = useMemo(() => ({ state: 'lagos', facts: {}, ...(filing ?? {}), ...form } as Filing), [filing, form])
  const set = (patch: Partial<Filing>) => setForm((p) => ({ ...p, ...patch }))
  const setFacts = (patch: Partial<FilingFacts>) => set({ facts: { ...f.facts, ...patch } })
  const setParty = (who: 'claimant' | 'defendant', patch: Partial<Party>) => setFacts({ [who]: { ...(f.facts[who] ?? {}), ...patch } })

  async function post(payload: object) {
    const res = await authedFetch('/api/admin/court-filing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId: c.id, ...payload }) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not save.')
    setFiling(data.filing)
    setDocs(data.documents ?? [])
  }

  async function save(then?: () => void | Promise<void>) {
    setBusy('save')
    setError('')
    try {
      await post({ patch: form })
      setForm({})
      await then?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while saving.')
    } finally {
      setBusy(null)
    }
  }

  async function draft(kind: DocKind, staffInput?: string): Promise<boolean> {
    setError('')
    try {
      // Unsaved edits first, so the AI works from what is on screen.
      if (Object.keys(form).length) { setBusy('save'); await post({ patch: form }); setForm({}) }
      setBusy(kind)
      const res = await authedFetch('/api/admin/court-filing/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId: c.id, kind, staffInput }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'The AI draft failed.'); return false }
      if (data.filing) setFiling(data.filing)
      if (data.document) setDocs((d) => [data.document, ...d])
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while drafting.')
      return false
    } finally {
      setBusy(null)
    }
  }

  // What staff typed for the pack, plus the device details for the Section 84 certificate.
  const packInput = (kind: DocKind) => [notes.pack, kind === 's84_certificate' || kind === 'exhibits' ? notes.s84 : ''].filter((x) => x?.trim()).join('\n\n') || undefined

  function canAIDraft(kind: DocKind): boolean {
    return kind === 'facts'
      || isLagosForm(kind, f.state)
      || (f.state === 'delta' && (kind === 'demand_form' || kind === 'garnishee'))
  }

  // Drafts every form in the filing pack, one after another, stopping at the first failure. The
  // exhibit list goes first so every later form uses its exhibit marks.
  async function draftPack() {
    const kinds = packDraftOrder(f.state).filter(canAIDraft)
    for (const [i, kind] of kinds.entries()) {
      setPacking(`${i + 1} of ${kinds.length}: ${docTitle(kind, f.state)}`)
      if (!(await draft(kind, packInput(kind)))) break
    }

    setPacking(null)
  }

  // Saves the text of an uploaded .docx as the new version of each form it contains, so the PDF
  // that goes to the client is built from the edited wording (lib/courtFormImport.ts).
  async function importDocx(file: File, only: DocKind | null) {
    setError('')
    setImportNote('')
    if (!/\.docx$/i.test(file.name)) {
      setError('Upload the Word version: in Google Docs choose File → Download → Microsoft Word (.docx).')
      return
    }
    setBusy('import')
    try {
      const { docxToText, splitIntoForms, PAGE_BREAK } = await import('@/lib/courtFormImport')
      const text = await docxToText(await file.arrayBuffer())
      if (!text.trim()) throw new Error('That document is empty.')
      const allowed = packKinds(f.state)
      const split = only ? { forms: [{ kind: only, body: text.split(PAGE_BREAK).map((p) => p.trim()).filter(Boolean).join('\n\n') }], unrecognised: [] } : splitIntoForms(text)
      const forms = split.forms.filter((x) => allowed.includes(x.kind))
      if (!forms.length) throw new Error('No forms were recognised in that file. Each form should start with its heading, for example "FORM SCA 2".')
      for (const x of forms) await post({ document: { kind: x.kind, title: docTitle(x.kind, f.state), body: x.body } })
      const skipped = split.unrecognised.length ? ` Not recognised (left out): ${split.unrecognised.map((u) => `“${u}”`).join(', ')}.` : ''
      setImportNote(`Updated from ${file.name}: ${forms.map((x) => docTitle(x.kind, f.state)).join('; ')}. The PDF now uses this wording.${skipped}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setBusy(null)
    }
  }

  const pickDocx = (only: DocKind | null) => {
    importTargetRef.current = only
    importInputRef.current?.click()
  }

  // E-mails the saved forms as one PDF with the instructions shown on screen.
  async function sendPack(to: string, subject: string, message: string, kinds: DocKind[], gaps: string[]) {
    const warn = gaps.length ? `\n\nThese are still not filled in: ${gaps.join(', ')}.` : ''
    if (!window.confirm(`Send the filing pack to ${to}?${warn}`)) return
    setBusy('send')
    setError('')
    setSentNote('')
    try {
      const res = await authedFetch('/api/admin/court-filing/send-pack', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId: c.id, to, subject, message, kinds }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'The email did not send.'); return }
      setSentNote(`Sent to ${to}, with ${data.sent} form${data.sent === 1 ? '' : 's'} attached.`)
      const again = await authedFetch(`/api/admin/court-filing?caseId=${c.id}`)
      if (again.ok) setDocs((await again.json()).documents ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while sending.')
    } finally {
      setBusy(null)
    }
  }

  async function saveDoc(kind: string, title: string, body: string) {
    setBusy(`doc-${kind}`)
    setError('')
    try {
      await post({ document: { kind, title, body } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the document.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p style={{ color: 'var(--text-3)' }}>Loading court filing…</p>
  if (setupNeeded) return <div style={box}><strong>One-time setup needed.</strong><p style={{ margin: '8px 0 0', color: 'var(--text-2)' }}>{error}</p></div>

  const deadlines = deadlinesFor(f)
  const checks = readiness(f)
  const now = today()
  const soonLimit = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
  const current = currentStep(f)
  const F = (n: number | string) => formLabel(f.state, n)
  const dirty = Object.keys(form).length > 0

  // Small render helpers (plain functions, not components, so inputs keep focus).
  const dateInput = (k: keyof Filing, label: string) => (
    <label style={lbl}>{label}<input className="input" type="date" value={(f[k] as string | null | undefined)?.slice(0, 10) ?? ''} onChange={(e) => set({ [k]: e.target.value } as Partial<Filing>)} /></label>
  )
  const textInput = (k: keyof Filing, label: string, placeholder?: string) => (
    <label style={lbl}>{label}<input className="input" value={(f[k] as string | null | undefined) ?? ''} placeholder={placeholder} onChange={(e) => set({ [k]: e.target.value } as Partial<Filing>)} /></label>
  )
  const moneyInput = (k: 'filing_fee' | 'judgment_sum', label: string) => (
    <label style={lbl}>{label}<input className="input" type="number" min={0} value={f[k] ?? ''} onChange={(e) => set({ [k]: e.target.value === '' ? null : Number(e.target.value) })} /></label>
  )
  const aiButton = (kind: DocKind, label: string, noteKey?: string) => canAIDraft(kind) ? (
    <button type="button" className="btn btn-sm btn-primary" disabled={!!busy || !!packing} onClick={() => draft(kind, noteKey ? notes[noteKey] : packKinds(f.state).includes(kind) ? packInput(kind) : undefined)}>
      {busy === kind ? 'Drafting…' : `✦ ${label}`}
    </button>
  ) : (
    <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>No approved form template; upload or enter a practitioner-prepared version.</span>
  )
  const saveButton = (label = 'Save', then?: () => void | Promise<void>, disabled = false, primary = false, title?: string) => (
    <button type="button" className={`btn btn-sm${primary ? ' btn-primary' : ''}`} disabled={!!busy || disabled} title={title} onClick={() => save(then)}>{busy === 'save' ? 'Saving…' : label}</button>
  )
  const staffNote = (key: string, label: string, placeholder: string) => (
    <label style={lbl}>{label}<textarea className="input" rows={3} placeholder={placeholder} value={notes[key] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))} /></label>
  )
  const editor = (kind: DocKind) => {
    const all = docs.filter((d) => d.kind === kind)
    return <DocEditor key={kind} doc={all[0]} versions={all.length} busy={!!busy} caseNumber={c.case_number} onSave={(body) => saveDoc(kind, all[0].title, body)} />
  }
  const partyFields = (who: 'claimant' | 'defendant', title: string) => {
    const p = f.facts[who] ?? {}
    const field = (k: keyof Party, label: string) => (
      <label style={lbl}>{label}<input className="input" value={p[k] ?? ''} onChange={(e) => setParty(who, { [k]: e.target.value })} /></label>
    )
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <div style={grid2}>
          {field('name', 'Full name')}
          {field('workAddress', 'Work address')}
          {field('residentialAddress', 'Residential address')}
          {field('phone', 'Telephone')}
          {field('email', 'E-mail')}
          {who === 'defendant' && field('otherContacts', 'WhatsApp / other accounts (for substituted service)')}
        </div>
      </div>
    )
  }

  const sendBox = (kinds: DocKind[], latest: Doc[]) => {
    const attached = latest.map((d) => d.kind as DocKind)
    const generated = clientPackMessage({
      clientName: f.facts.claimant?.name,
      defendantName: f.facts.defendant?.name,
      state: f.state,
      registry: f.registry,
      kinds: attached,
      caseNumber: c.case_number,
      figures: claimFigures(f.facts, f.filed_at ?? undefined),
    })
    const to = sendTo ?? (f.facts.claimant?.email || c.client_email || c.userEmail || '')
    const subject = sendSubject ?? generated.subject
    const message = sendMessage ?? generated.text
    const gaps = unfilledPlaceholders(latest.map((d) => d.body))
    const history = docs.filter((d) => d.kind === 'client_email')
    const returned = docs.filter((d) => d.kind === 'signed_received')
    return (
      <div style={{ ...box, display: 'grid', gap: 10 }}>
        <strong style={{ fontSize: 14, color: 'var(--text-1)' }}>Send to the client to sign</strong>
        <p style={note}>Sends the latest saved version of each form ({latest.length} of {kinds.length}), including versions uploaded from Google Docs, as one PDF, with these instructions and the amounts claimed. Save any edits to the forms first. The {'{{UPLOAD_LINK}}'} in the message becomes the client’s private upload link when sent (valid 30 days, no sign-in): her scans go straight into Evidence Files and you get an e-mail.</p>
        {returned.length > 0 && (
          <div style={{ display: 'grid', gap: 4, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
            {returned.map((r) => <span key={r.id}>✓ {r.title} on {new Date(r.created_at).toLocaleString('en-NG')} — open Evidence Files to see them</span>)}
          </div>
        )}
        {gaps.length > 0 && <p style={{ ...note, color: 'var(--warning)', fontWeight: 600 }}>Still to fill in before sending: {gaps.join(', ')}</p>}
        <div style={grid2}>
          <label style={lbl}>Client’s e-mail<input className="input" type="email" value={to} onChange={(e) => setSendTo(e.target.value)} /></label>
          <label style={lbl}>Subject<input className="input" value={subject} onChange={(e) => setSendSubject(e.target.value)} /></label>
        </div>
        <label style={lbl}>Message<textarea className="input" rows={20} value={message} onChange={(e) => setSendMessage(e.target.value)} style={{ lineHeight: 1.55, fontSize: 13 }} /></label>
        <div style={row}>
          <button type="button" className="btn btn-sm btn-primary" disabled={!!busy || !!packing || !to.trim()} onClick={() => sendPack(to.trim(), subject, message, attached, gaps)}>{busy === 'send' ? 'Sending…' : 'Email the pack to the client (PDF)'}</button>
          {(sendMessage !== null || sendSubject !== null) && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setSendMessage(null); setSendSubject(null) }}>Reset the message</button>}
          {sentNote && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{sentNote}</span>}
        </div>
        {history.length > 0 && (
          <div style={{ display: 'grid', gap: 4, fontSize: 12.5, color: 'var(--text-3)' }}>
            {history.map((h) => <span key={h.id}>{h.title} · {new Date(h.created_at).toLocaleString('en-NG')} · by {h.created_by ?? 'staff'}</span>)}
          </div>
        )}
      </div>
    )
  }

  function stepBody(key: StepKey) {
    switch (key) {
      case 'prepare':
        return (
          <>
            <div style={{ display: 'grid', gap: 6 }}>
              {checks.map((ch) => (
                <div key={ch.key} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                  <span style={{ color: ch.ok ? '#16a34a' : 'var(--danger)', fontWeight: 700 }}>{ch.ok ? '✓' : '✗'}</span>
                  <span><span style={{ color: 'var(--text-1)' }}>{ch.label}</span>{ch.detail && <span style={{ color: 'var(--text-3)' }}> · {ch.detail}</span>}</span>
                </div>
              ))}
            </div>
            <div style={row}>{aiButton('facts', 'Extract the facts from the case')}</div>
            <p style={note}>The firm’s letter of demand must be served, and 14 days must pass after the debtor receives it, before the claim can be filed. {F(1)} is filled in from that demand with the filing pack; the served letter and its proof of service go in as exhibits.</p>
            <div style={grid2}>
              {dateInput('demand_served_at', 'Date the debtor received the letter')}
              {textInput('demand_service_proof', 'How it was served (proof)', svc.length ? `e.g. ${svc[0].channel}, ${svc[0].status} ${fmt(svc[0].acknowledged_at ?? svc[0].dispatched_at)}` : 'e.g. delivered by hand, acknowledged copy on file')}
            </div>
            {partyFields('claimant', 'Claimant')}
            {partyFields('defendant', 'Defendant')}
            <div style={grid2}>
              <label style={lbl}>Sum claimed (₦, excluding interest and costs)<input className="input" type="number" min={0} value={f.facts.amount ?? ''} onChange={(e) => setFacts({ amount: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
              <label style={lbl}>Date the sum fell due (interest runs from it)<input className="input" type="date" value={f.facts.dueDate?.slice(0, 10) ?? ''} onChange={(e) => setFacts({ dueDate: e.target.value || undefined })} /></label>
              <label style={lbl}>Interest rate (% a year, {INTEREST_RATE.min}–{INTEREST_RATE.max})
                <select className="input" value={interestRateOf(f.facts)} onChange={(e) => setFacts({ interestRate: Number(e.target.value) })}>
                  {Array.from({ length: INTEREST_RATE.max - INTEREST_RATE.min + 1 }, (_, i) => INTEREST_RATE.min + i).map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </label>
              <label style={lbl}>Interest amount (₦) — leave blank to calculate<input className="input" type="number" min={0} value={f.facts.interestAmount ?? ''} placeholder="Calculated from the due date and rate" onChange={(e) => setFacts({ interestAmount: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
              <label style={lbl}>Costs (₦, flat fee)<input className="input" type="number" min={0} value={costsOf(f.facts)} onChange={(e) => setFacts({ costs: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
              <label style={lbl}>What the costs are for<input className="input" value={f.facts.costsNote ?? ''} placeholder={DEFAULT_COSTS_NOTE} onChange={(e) => setFacts({ costsNote: e.target.value })} /></label>
            </div>
            {(() => {
              const fig = claimFigures(f.facts, f.filed_at ?? undefined)
              return (
                <div style={{ ...box, background: 'var(--bg-1)', display: 'grid', gap: 4, fontSize: 13, color: 'var(--text-2)' }}>
                  <strong style={{ color: 'var(--text-1)' }}>What the forms will claim</strong>
                  <span>Debt: {naira(fig.sum)}</span>
                  <span>Interest: {fig.interestFixed ? `${naira(fig.interest)} (amount entered by hand)` : fig.interestFrom ?`${naira(fig.interest)} (${fig.rate}% a year for ${fig.days} days, ${fmt(fig.interestFrom)} to ${fmt(fig.interestTo)}${f.filed_at ? '' : ', today'}), and continuing until judgment` : `${fig.rate}% a year until judgment. Enter the date the sum fell due to state an amount.`}</span>
                  <span>Costs: {naira(fig.costs)}, being {fig.costsNote}</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>Total before court fees: {naira(fig.total)}</span>
                </div>
              )
            })()}
            <label style={lbl}>What the debt is for<textarea className="input" rows={2} value={f.facts.particulars ?? ''} onChange={(e) => setFacts({ particulars: e.target.value })} /></label>
            <label style={lbl}>Steps already taken to recover it<textarea className="input" rows={2} value={f.facts.stepsTaken ?? ''} onChange={(e) => setFacts({ stepsTaken: e.target.value })} /></label>
            <label style={lbl}>Documents to attach (one per line)<textarea className="input" rows={3} value={(f.facts.documents ?? []).join('\n')} onChange={(e) => setFacts({ documents: e.target.value.split('\n') })} /></label>
            {/* Where the money went: the garnishee bank if a judgment has to be enforced. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {(['bank', 'branch', 'accountNumber', 'accountName'] as const).map((k) => (
                <label key={k} style={lbl}>
                  {{ bank: "Debtor's bank (for enforcement)", branch: 'Branch', accountNumber: 'Account number', accountName: 'Account name' }[k]}
                  <input className="input" value={f.facts.debtorBank?.[k] ?? ''} onChange={(e) => setFacts({ debtorBank: { ...(f.facts.debtorBank ?? {}), [k]: e.target.value } })} />
                </label>
              ))}
            </div>
            <div style={row}>{saveButton()}</div>
          </>
        )
      case 'pack': {
        const kinds = packKinds(f.state)
        const sj = rulesFor(f.state).summaryJudgment
        const latest = kinds.map((k) => docs.find((d) => d.kind === k)).filter((d): d is Doc => !!d)
        return (
          <>
            <p style={note}>
              Everything filed together at the registry: {F(1)} (letter of demand), {F(2)} (complaint form), {F(3)} (summons)
              {sj ? <>, {F('3A')} (application for summary judgment) with {F('3B')} (affidavit in support)</> : null}, the exhibits, and a Section 84 certificate for anything printed from a phone or computer (e-mails, e-receipts, statements, chats).
              The claimant signs the forms personally, so they are drafted in the claimant’s voice.
            </p>
            <p style={{ ...note, fontWeight: 600 }}>
              Before drafting: add every document to this case’s Evidence Files tab (bank statement, receipts, the agreement, proof of service) with a note on what it is and proves, and set the due date and interest above. The drafts take every date, amount and reference from those notes, and number the exhibits from them.
            </p>
            <div style={{ ...box, background: 'var(--bg-1)', display: 'grid', gap: 6 }}>
              <strong style={{ fontSize: 13 }}>Get from the client before filing</strong>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                <li>A passport photograph (fixed to {F(2)}).</li>
                <li>Signature or thumbprint on {F(1)}, {F(2)}{sj ? ` and ${F('3A')}` : ''}.</li>
                {sj && <li>Attendance at the registry to swear {F('3B')} before the Commissioner for Oaths.</li>}
                <li>Every document relied on, printed, with originals available; and who printed the electronic ones, on what device.</li>
              </ul>
            </div>
            {staffNote('pack', 'Anything to add for the pack (optional)', 'e.g. The defendant is a company; serve at its head office. Costs are the lawyer’s fees for the demand.')}
            {staffNote('s84', 'Section 84: who printed the electronic documents, and on what device and printer', 'e.g. Printed by the client on a Lenovo T480 laptop, serial 20L5000WUS, Windows 10, Microsoft Word; HP LaserJet MFP M725, serial CNDVN18084.')}
            <div style={row}>
              <button type="button" className="btn btn-sm btn-primary" disabled={!!busy || !!packing} onClick={draftPack}>{packing ? `Drafting ${packing}…` : '✦ Draft forms with approved templates'}</button>
              {latest.length > 0 && (
                <button type="button" className="btn btn-sm" onClick={async () => { const { downloadCourtPackDocx } = await import('@/lib/courtFormDocx'); await downloadCourtPackDocx(`Filing pack case ${c.case_number}`, latest.map((d) => d.body)) }}>
                  Download the pack (Word, {latest.length} of {kinds.length})
                </button>
              )}
              {latest.length > 0 && (
                <button type="button" className="btn btn-sm" onClick={async () => { const { buildCourtPackPdf } = await import('@/lib/courtFormPdf'); buildCourtPackPdf(latest.map((d) => d.body)).save(`filing-pack-case-${c.case_number}.pdf`) }}>
                  Download the pack (PDF)
                </button>
              )}
              {latest.length > 0 && (
                <button type="button" className="btn btn-sm" onClick={async () => { const { downloadFilingBundle } = await import('./ReadyToFile'); const err = await downloadFilingBundle(c.id, c.case_number); if (err) setError(err) }}>
                  Download the filing bundle (pack, letter, evidence, checklist)
                </button>
              )}
              <button type="button" className="btn btn-sm" disabled={!!busy || !!packing} onClick={() => pickDocx(null)}>{busy === 'import' ? 'Reading…' : 'Upload edited forms (.docx)'}</button>
              <input ref={importInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) importDocx(file, importTargetRef.current) }} />
            </div>
            <p style={{ ...note, fontSize: 12.5 }}>Editing in Google Docs: download the pack (Word), open it in Google Drive with Google Docs, make your changes, then File → Download → Microsoft Word (.docx) and upload it here. Each form is saved as a new version and the PDF sent to the client uses your wording. Keep each form’s heading (e.g. “FORM SCA 2”) at the top of its page so it is recognised.</p>
            {importNote && <p style={{ ...note, color: '#16a34a', fontWeight: 600 }}>{importNote}</p>}
            {kinds.map((k) => (
              <div key={k} style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                <div style={row}>
                  <strong style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{docTitle(k, f.state)}</strong>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="btn btn-sm" disabled={!!busy || !!packing} onClick={() => pickDocx(k)}>Upload edited version</button>
                  {aiButton(k, docs.some((d) => d.kind === k) ? 'Redraft' : 'Draft')}
                </div>
                {editor(k)}
              </div>
            ))}
            {latest.length > 0 && sendBox(kinds, latest)}
          </>
        )
      }
      case 'file':
        return (
          <>
            <p style={note}>At the registry the claimant swears {rulesFor(f.state).summaryJudgment ? F('3B') : 'any affidavit'} before the Commissioner for Oaths, the fees are paid at the cash office, and the registry stamps and paginates the bundle and allocates the claim number (in Lagos, in the form MCL/SCC/…/year). Record the dates from the issued summons.</p>
            <div style={grid2}>
              {dateInput('filed_at', 'Date filed')}
              {moneyInput('filing_fee', 'Filing fee paid (₦)')}
              {dateInput('summons_issued_at', `Summons (${F(3)}) issued`)}
              {dateInput('first_hearing_at', 'First hearing date (on the summons)')}
            </div>
            <div style={row}>
              {saveButton()}
              {c.status === 'letter_served' && onAction && saveButton('Save and mark the case “Filed in Court”', () => onAction(c.id, 'markFiled'), !f.filed_at || !f.claim_number, true, !f.filed_at || !f.claim_number ? 'Enter the filing date and claim number first' : undefined)}
            </div>
          </>
        )
      case 'service':
        return (
          <>
            <p style={note}>The court bailiff serves the summons{rulesFor(f.state).summaryJudgment ? `, the complaint form and the summary judgment application (${F('3A')}, ${F('3B')})` : ''} within 7 days of filing and files an affidavit of service ({F(6)}){rulesFor(f.state).affidavitOfServiceDays ? ` within ${rulesFor(f.state).affidavitOfServiceDays} days of service` : ''} or of non-service ({F(4)}). For a company, service at its head office is normal. Get a copy of the affidavit of service for the hearing. If service fails, apply for substituted service ({F(7)}): pasting at the last known address, registered post, or verified e-mail, WhatsApp or other accounts. SMS is for hearing notices only.</p>
            <div style={grid2}>
              <label style={lbl}>Outcome
                <select className="input" value={f.service_outcome ?? ''} onChange={(e) => set({ service_outcome: (e.target.value || null) as Filing['service_outcome'] })}>
                  <option value="">Not yet known</option>
                  <option value="served">Served by the bailiff</option>
                  <option value="not_served">Could not be served</option>
                  <option value="substituted_ordered">Substituted service ordered</option>
                  <option value="served_substituted">Served by substituted means</option>
                </select>
              </label>
              {dateInput('served_at', 'Date served')}
            </div>
            <div style={row}>{saveButton()}</div>
            {(f.service_outcome === 'not_served' || f.service_outcome === 'substituted_ordered' || docs.some((d) => d.kind === 'substituted_service')) && (
              <>
                {staffNote('subst', "Why service failed, and the defendant's e-mail, WhatsApp or other accounts, with how we know they are theirs", 'e.g. Bailiff found the shop locked on two visits. Defendant uses WhatsApp +234… (the number used to discuss the order).')}
                <div style={row}>{aiButton('substituted_service', `Draft ${F(7)} with affidavit`, 'subst')}</div>
              </>
            )}
            {editor('substituted_service')}
          </>
        )
      case 'defence':
        return (
          <>
            <p style={note}>The defendant has 7 days from service to file an admission, defence or counterclaim ({F(5)}). If nothing is filed, the defendant may be held to have admitted the claim. Our reply to a defence or counterclaim is due within 5 days.</p>
            <div style={grid2}>
              <label style={lbl}>What the defendant filed
                <select className="input" value={f.defence_type ?? ''} onChange={(e) => set({ defence_type: (e.target.value || null) as Filing['defence_type'] })}>
                  <option value="">Waiting</option>
                  <option value="none">Nothing within 7 days</option>
                  <option value="admission">Admission (perhaps asking for time or instalments)</option>
                  <option value="defence">Defence</option>
                  <option value="counterclaim">Counterclaim</option>
                </select>
              </label>
              {dateInput('defence_received_at', 'Date we received it')}
            </div>
            <label style={lbl}>What they say (summary, or paste the defence)<textarea className="input" rows={4} value={f.defence_summary ?? ''} onChange={(e) => set({ defence_summary: e.target.value })} /></label>
            <div style={row}>
              {saveButton()}
              {(f.defence_type === 'defence' || f.defence_type === 'counterclaim') && aiButton('reply', 'Draft our reply')}
            </div>
            {f.defence_type === 'none' && <p style={note}>With proof of service, the court can hear the claim and enter judgment as far as the claimant proves it, even if the defendant does not appear (Art. 8(2)). Prepare the hearing pack next.</p>}
            {editor('reply')}
          </>
        )
      case 'hearing':
        return (
          <>
            <p style={note}>At the first appearance the court refers the parties to mediation for up to 7 days; a settlement can be entered as a consent judgment. Otherwise a preliminary hearing sets directions, and the hearing must finish within 30 days, with at most one adjournment.</p>
            <label style={lbl}>Hearing notes (directions, adjournments, what happened)<textarea className="input" rows={3} value={f.hearing_notes ?? ''} onChange={(e) => set({ hearing_notes: e.target.value })} /></label>
            <div style={grid2}>{dateInput('settled_at', 'Settled on (if it settles)')}</div>
            <div style={row}>
              {saveButton()}
              {aiButton('hearing_pack', 'Prepare the hearing pack')}
              {aiButton('settlement', 'Draft terms of settlement')}
            </div>
            {editor('hearing_pack')}
            {editor('settlement')}
          </>
        )
      case 'judgment':
        return (
          <>
            <div style={grid2}>
              {dateInput('judgment_at', 'Judgment delivered')}
              <label style={lbl}>Outcome
                <select className="input" value={f.judgment_outcome ?? ''} onChange={(e) => set({ judgment_outcome: (e.target.value || null) as Filing['judgment_outcome'] })}>
                  <option value="">—</option>
                  <option value="won">Judgment for our client</option>
                  <option value="part">Part of the claim granted</option>
                  <option value="consent">Consent judgment (settlement)</option>
                  <option value="lost">Claim dismissed</option>
                  <option value="struck_out">Struck out</option>
                </select>
              </label>
              {moneyInput('judgment_sum', 'Judgment sum (₦)')}
            </div>
            <p style={note}>The court should issue an authenticated copy within 7 days. Either party may appeal ({F(8)}) within 14 days. A claim struck out for non-appearance cannot be relisted, but may be refiled on payment of fees.</p>
            <div style={row}>
              {saveButton()}
              {c.status === 'filed' && onAction && (f.judgment_outcome === 'won' || f.judgment_outcome === 'part' || f.judgment_outcome === 'consent') &&
                saveButton('Save and mark the case “Judgment Won”', () => onAction(c.id, 'markJudgment'), !f.judgment_at, true)}
            </div>
          </>
        )
      case 'enforce':
        return (
          <>
            <p style={note}>If the judgment sum is not paid, it is enforced like any Magistrates’ Court money order. For a garnishee order, file a motion ex parte ({F(9)}) with an affidavit ({F('9A')}) giving the debtor’s bank and branch, and the account number if known.</p>
            {staffNote('garnishee', 'Garnishee details: bank, branch, account number if known, instalments unpaid, anyone else claiming the money', 'e.g. Access Bank, Allen Avenue branch; account number not known.')}
            <div style={grid2}>{dateInput('enforcement_started_at', 'Enforcement started')}</div>
            <div style={row}>
              {aiButton('garnishee', `Draft ${F(9)} and ${F('9A')}`, 'garnishee')}
              {saveButton()}
            </div>
            {editor('garnishee')}
          </>
        )
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header: Practice Direction, registry, claim number, deadlines */}
      <div style={{ ...box, display: 'grid', gap: 12 }}>
        <div style={grid2}>
          <label style={lbl}>Practice Direction
            <select className="input" value={f.state} onChange={(e) => set({ state: e.target.value })}>
              {(['lagos', 'delta'] as const).map((state) => <option key={state} value={state}>{STATE_RULES[state].name}</option>)}
            </select>
          </label>
          {textInput('registry', 'Registry / magisterial district', 'e.g. Ikeja')}
          {textInput('claim_number', 'Claim number', 'Allocated at filing')}
        </div>
        <div style={row}>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Next step: <strong style={{ color: 'var(--text-1)' }}>{STEPS.find((s) => s.key === current)?.title}</strong></span>
          <span style={{ flex: 1 }} />
          {dirty && saveButton('Save changes', undefined, false, true)}
        </div>
        {deadlines.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            {deadlines.map((d) => {
              // The demand period is the one date that is good news once passed: filing can start.
              const opens = d.key === 'demand'
              const overdue = !opens && d.due < now
              const soon = !opens && !overdue && d.due <= soonLimit
              const passedOk = opens && d.due <= now
              return (
                <div key={d.key} style={{ display: 'flex', gap: 10, fontSize: 13, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ minWidth: 92, fontWeight: 700, color: overdue ? 'var(--danger)' : soon ? 'var(--warning)' : passedOk ? '#16a34a' : 'var(--text-1)' }}>{fmt(d.due)}</span>
                  <span style={{ color: 'var(--text-1)' }}>{d.label}{passedOk ? ' · passed, the claim can be filed' : ''}{overdue ? ' · overdue' : ''}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{d.rule}</span>
                </div>
              )
            })}
          </div>
        )}
        {error && <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
      </div>

      {STEPS.map((s, i) => {
        const done = stepDone(s.key, f)
        const isOpen = open === s.key
        const isCurrent = s.key === current
        return (
          <div key={s.key} style={{ ...box, borderColor: isCurrent ? 'var(--accent)' : 'var(--border-subtle)', padding: 0 }}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.key)} style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 13, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, background: done ? '#16a34a' : isCurrent ? 'var(--accent)' : 'var(--bg-1)', color: done || isCurrent ? '#fff' : 'var(--text-2)' }}>{done ? '✓' : i + 1}</span>
              <span style={{ display: 'grid', gap: 2 }}>
                <strong style={{ color: 'var(--text-1)', fontSize: 14.5 }}>{s.title}</strong>
                <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>{s.summary}</span>
              </span>
            </button>
            {isOpen && <div style={{ padding: '0 16px 16px', display: 'grid', gap: 14 }}>{stepBody(s.key)}</div>}
          </div>
        )
      })}
    </div>
  )
}
