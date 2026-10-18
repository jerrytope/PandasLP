'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import TestChat from './TestChat'
import Conversations from './Conversations'
import { formatWhen, type TargetDetail, type Version } from './types'
import styles from './ManageAi.module.css'

type Tab = 'instructions' | 'test' | 'history' | 'signoff' | 'conversations' | 'base'

const TABS: { key: Tab; label: string }[] = [
  { key: 'instructions', label: 'Drafting instructions' },
  { key: 'test', label: 'Test chat' },
  { key: 'history', label: 'History' },
  { key: 'signoff', label: 'Sign-off' },
  { key: 'conversations', label: 'Real conversations' },
  { key: 'base', label: 'What the agent is told' },
]

const EXAMPLE = `For example:
- In every Notice to Quit, write the quit date in words as well as figures, e.g. "31st day of December 2026".
- Never put a date on a deed; leave the signing date as a blank line.
- Address the tenant by full name in the first line of every notice.`

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; version?: number }> {
  const res = await authedFetch('/api/manageai/instructions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, version: data.version } : { ok: false, error: data.error ?? 'Something went wrong.' }
}

export default function TargetPanel({ target, onChanged }: { target: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<TargetDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<Tab>('instructions')
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [saved, setSaved] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const loadedText = useRef('')

  const live: Version | null = detail?.versions[0] ?? null

  const load = useCallback(async () => {
    const res = await authedFetch(`/api/manageai/instructions?target=${encodeURIComponent(target)}`)
    if (!res.ok) return setLoadError('Could not load this agent.')
    const data: TargetDetail = await res.json()
    setDetail(data)
    const start = data.draft?.body ?? data.versions[0]?.body ?? ''
    loadedText.current = start
    setText(start)
    setSaved('saved')
  }, [target])

  useEffect(() => {
    load()
  }, [load])

  // Keeps the draft saved as he types (a couple of seconds after he stops), so nothing is lost.
  useEffect(() => {
    if (!detail || text === loadedText.current) return
    setSaved('unsaved')
    const timer = setTimeout(async () => {
      setSaved('saving')
      const result = await post({ action: 'save_draft', target, body: text, basedOnVersion: live?.version ?? null })
      if (result.ok) {
        loadedText.current = text
        setSaved('saved')
        onChanged()
      } else {
        setSaved('unsaved')
        setMessage({ kind: 'error', text: result.error ?? 'The draft could not be saved.' })
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [text, detail, target, live?.version, onChanged])

  async function act(body: Record<string, unknown>, success: string) {
    setBusy(true)
    setMessage(null)
    const result = await post({ target, ...body })
    setBusy(false)
    if (!result.ok) return setMessage({ kind: 'error', text: result.error ?? 'Something went wrong.' })
    setMessage({ kind: 'ok', text: success.replace('{v}', String(result.version ?? '')) })
    setNote('')
    await load()
    onChanged()
  }

  if (loadError) return <p role="alert" className={styles.error}>{loadError}</p>
  if (!detail) return <p className={styles.muted}>Loading…</p>

  const changedFromLive = text.trim() !== (live?.body ?? '').trim()
  const outdatedDraft = detail.draft && live && detail.draft.basedOnVersion !== null && detail.draft.basedOnVersion < live.version

  return (
    <div className={styles.panel}>
      <header className={styles.panelHeader}>
        <h1>{detail.name}</h1>
        <p className={styles.muted}>
          {live?.body.trim() ? `Version ${live.version} is live, published by ${live.createdBy} on ${formatWhen(live.createdAt)}.` : 'No drafting instructions are live. The agent follows its built-in instructions only.'}
          {detail.signOffs[0] && ` Last signed off by ${detail.signOffs[0].signedName} on ${formatWhen(detail.signOffs[0].createdAt)} (version ${detail.signOffs[0].version}).`}
        </p>
      </header>

      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? styles.error : styles.ok}>{message.text}</p>}

      {tab === 'instructions' && (
        <section className={styles.section}>
          <p>
            Write, in plain English, how this agent should draft its documents. What you write here is added after the agent&apos;s built-in instructions,
            and takes priority on wording, layout and structure. It can&apos;t change prices or the calculators.
          </p>
          {outdatedDraft && (
            <p className={styles.warning}>This draft was started from version {detail.draft!.basedOnVersion}, but version {live!.version} has been published since. Check the History tab before publishing, so you don&apos;t undo that change.</p>
          )}
          <label className="field-label" htmlFor="instructions">Drafting instructions</label>
          <textarea id="instructions" className={`input ${styles.editor}`} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} rows={16} />
          <div className={styles.editorMeta}>
            <span className={styles.muted}>
              {saved === 'saving' ? 'Saving draft…' : saved === 'unsaved' ? 'Not saved yet' : detail.draft || changedFromLive ? 'Draft saved. Clients don\'t see it until you publish.' : 'Same as the live version.'}
            </span>
            <span className={styles.muted}>{text.length.toLocaleString()} / 20,000</span>
          </div>

          <label className="field-label" htmlFor="note">What changed and why (kept in the history)</label>
          <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Quit dates must be in words as well as figures" maxLength={2000} />

          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" disabled={busy || !changedFromLive || saved !== 'saved'} onClick={() => act({ action: 'publish', body: text, note }, 'Published as version {v}. New conversations use it within a minute.')}>
              Publish
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setTab('test')}>Test this draft first</button>
            {detail.draft && (
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => act({ action: 'discard_draft' }, 'Draft discarded.')}>
                Discard draft
              </button>
            )}
          </div>
          {!changedFromLive && <p className={styles.muted}>Publish is available once the text differs from the live version.</p>}
        </section>
      )}

      {tab === 'test' && <TestChat target={target} draft={text} starterMessage={detail.starterMessage} />}

      {tab === 'history' && (
        <section className={styles.section}>
          {detail.versions.length === 0 ? (
            <p className={styles.muted}>Nothing has been published for this agent yet.</p>
          ) : (
            <ol className={styles.history}>
              {detail.versions.map((v, i) => (
                <li key={v.version} className="card">
                  <div className={styles.historyHead}>
                    <strong>Version {v.version}</strong>
                    {i === 0 && <span className="badge badge-green badge-sm">Live</span>}
                    {v.restoredFrom !== null && <span className="badge badge-info badge-sm">Restored from v{v.restoredFrom}</span>}
                    <span className={styles.muted}>{v.createdBy} · {formatWhen(v.createdAt)}</span>
                  </div>
                  {v.note && <p className={styles.historyNote}>{v.note}</p>}
                  <details>
                    <summary>Show the instructions</summary>
                    <pre className={styles.pre}>{v.body.trim() || '(empty: instructions cleared)'}</pre>
                  </details>
                  {i > 0 && (
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => act({ action: 'restore', version: v.version, note: `Restored version ${v.version}` }, 'Version restored. It is now live as version {v}.')}>
                      Restore this version
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
          <p className={styles.muted}>Versions are never changed or deleted. Restoring an old version publishes a copy of it as a new version, so the history stays complete.</p>
        </section>
      )}

      {tab === 'signoff' && <SignOffTab detail={detail} busy={busy} onSign={(signedName, signNote) => act({ action: 'sign_off', signedName, note: signNote }, 'Signed off (version {v}).')} />}

      {tab === 'conversations' && (
        <Conversations
          target={target}
          onCorrect={(ref) => {
            setNote(`From case ${ref}: `)
            setTab('instructions')
          }}
        />
      )}

      {tab === 'base' && (
        <section className={styles.section}>
          <p>
            This is what the code tells the agent, before your drafting instructions. It can&apos;t be edited here.
            If something in it is wrong, write the correction as a drafting instruction, or ask the developer to change it.
          </p>
          <pre className={styles.pre}>{detail.base}</pre>
        </section>
      )}
    </div>
  )
}

function SignOffTab({ detail, busy, onSign }: { detail: TargetDetail; busy: boolean; onSign: (name: string, note: string) => void }) {
  const [name, setName] = useState('')
  const [signNote, setSignNote] = useState('')
  const live = detail.versions[0]
  return (
    <section className={styles.section}>
      <p>
        Sign off when you have reviewed this agent and are satisfied with how it drafts. The sign-off is recorded against
        {live ? ` version ${live.version} of the drafting instructions` : ' the built-in instructions (no drafting instructions published yet)'}, with your name and the date.
      </p>
      <label className="field-label" htmlFor="signName">Your full name</label>
      <input id="signName" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      <label className="field-label" htmlFor="signNote">Note (optional)</label>
      <input id="signNote" className="input" value={signNote} onChange={(e) => setSignNote(e.target.value)} maxLength={2000} placeholder="e.g. Reviewed all templates against the Tenancy Law" />
      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => onSign(name, signNote)}>Sign off</button>
      </div>
      {detail.signOffs.length > 0 && (
        <>
          <h2 className={styles.subhead}>Earlier sign-offs</h2>
          <ul className={styles.history}>
            {detail.signOffs.map((s) => (
              <li key={s.createdAt} className="card">
                <strong>{s.signedName}</strong> <span className={styles.muted}>signed off version {s.version} · {formatWhen(s.createdAt)} · {s.signedBy}</span>
                {s.note && <p className={styles.historyNote}>{s.note}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
