'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { ChatBubble } from './TestChat'
import { formatWhen } from './types'
import styles from './ManageAi.module.css'

interface CaseRow {
  id: string
  case_number: number | string | null
  status: string
  document_title: string | null
  created_at: string
  area: string | null
}

interface CaseDetail {
  case: { id: string; case_number: number | string | null; status: string; document_title: string | null; document_body: string | null; created_at: string }
  messages: { role: 'user' | 'assistant'; content: string; created_at: string }[]
  matter: { area: string | null; state: string | null; lagos_area: string | null; facts: Record<string, unknown> | null } | null
}

// Real client conversations for this agent (brand matters and test cases left out). For a
// property area, only that area's matters are shown.
export default function Conversations({ target, onCorrect }: { target: string; onCorrect: (caseRef: string) => void }) {
  const area = target.startsWith('property:') ? target.slice('property:'.length) : null
  const agentId = area ? 'recovery-of-premises' : target
  const [rows, setRows] = useState<CaseRow[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<CaseDetail | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  useEffect(() => {
    authedFetch(`/api/manageai/conversations?agentId=${encodeURIComponent(agentId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Could not load the conversations.')
        setRows((data.cases as CaseRow[]).filter((c) => !area || c.area === area))
      })
      .catch((err: Error) => setError(err.message))
  }, [agentId, area])

  async function show(id: string) {
    setOpening(id)
    setError('')
    const res = await authedFetch(`/api/manageai/conversations?caseId=${encodeURIComponent(id)}`)
    const data = await res.json().catch(() => ({}))
    setOpening(null)
    if (!res.ok) return setError(data.error ?? 'Could not open the conversation.')
    setOpen(data)
  }

  if (open) {
    const ref = open.case.case_number ? `#${open.case.case_number}` : open.case.id.slice(0, 8)
    return (
      <section className={styles.section}>
        <div className={styles.actions}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>← All conversations</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onCorrect(ref)}>Write a correction from this case</button>
        </div>
        <h2 className={styles.subhead}>Case {ref} · {open.case.status} · {formatWhen(open.case.created_at)}</h2>
        {open.matter && (
          <details className="card">
            <summary>Property matter: {open.matter.area ?? 'not routed'} · {open.matter.state ?? 'no state'}{open.matter.lagos_area ? ` (${open.matter.lagos_area})` : ''}</summary>
            <pre className={styles.pre}>{JSON.stringify(open.matter.facts ?? {}, null, 2)}</pre>
          </details>
        )}
        <div className={styles.chat}>
          {open.messages.length === 0 && <p className={styles.muted}>No messages were saved for this case.</p>}
          {open.messages.map((m, i) => <ChatBubble key={i} message={m} />)}
        </div>
        {open.case.document_body && (
          <div className={styles.document}>
            <div className={styles.documentHead}><strong>Drafted document: {open.case.document_title}</strong></div>
            <pre className={styles.pre}>{open.case.document_body}</pre>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <p>The latest real conversations with this agent{area ? ' in this area' : ''}, newest first. Open one to read it and the document it drafted.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {rows === null && !error && <p className={styles.muted}>Loading…</p>}
      {rows?.length === 0 && <p className={styles.muted}>No conversations yet.</p>}
      <ul className={styles.caseList}>
        {rows?.map((c) => (
          <li key={c.id}>
            <button type="button" className={styles.caseRow} disabled={opening === c.id} onClick={() => show(c.id)}>
              <span>{c.case_number ? `#${c.case_number}` : c.id.slice(0, 8)}</span>
              <span className={styles.caseTitle}>{c.document_title ?? 'No document yet'}</span>
              <span className="badge badge-muted badge-sm">{c.status}</span>
              <span className={styles.muted}>{formatWhen(c.created_at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
