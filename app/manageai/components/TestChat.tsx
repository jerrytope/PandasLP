'use client'

import { useEffect, useRef, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { extractDocument, extractOptions } from '@/lib/agentChatParsing'
import styles from './ManageAi.module.css'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

// A practice conversation with the real agent, using the text in the editor (published or not).
// Nothing is saved as a case. Starting over, or changing the instructions, starts a new chat.
export default function TestChat({ target, draft, starterMessage }: { target: string; draft: string; starterMessage: string }) {
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: starterMessage }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  // The property agent's practice matter, kept here between turns (lib/property/snapshotRepo.ts).
  const snapshot = useRef<unknown>(null)
  const testedWith = useRef(draft)
  const endRef = useRef<HTMLDivElement>(null)

  function restart() {
    setMessages([{ role: 'assistant', content: starterMessage }])
    snapshot.current = null
    testedWith.current = draft
    setError('')
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, sending])

  async function send(text: string) {
    const content = text.trim()
    if (!content || sending) return
    if (testedWith.current !== draft && messages.length > 1) {
      setError('The instructions changed since this chat started. Press "Start over" to test the new text.')
      return
    }
    testedWith.current = draft
    const next: Msg[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setSending(true)
    setError('')
    try {
      const res = await authedFetch('/api/manageai/test-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target, draft, messages: next, snapshot: snapshot.current }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error ?? 'The agent did not answer. Please try again.')
        setMessages(messages)
        return
      }
      if (data.snapshot) snapshot.current = data.snapshot
      setMessages([...next, { role: 'assistant', content: data.response }])
    } catch {
      setError('Network error. Please try again.')
      setMessages(messages)
    } finally {
      setSending(false)
    }
  }

  const last = messages[messages.length - 1]
  const options = last.role === 'assistant' ? extractOptions(last.content).options : []

  return (
    <section className={styles.section}>
      <div className={styles.testBanner}>
        <span>Practice chat using <strong>the text in the editor</strong>{draft.trim() ? '' : ' (empty: built-in instructions only)'}. Nothing is saved as a case, and no client sees it. Each message costs a few naira of AI usage.</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={restart}>Start over</button>
      </div>

      <div className={styles.chat}>
        {messages.map((m, i) => (
          <ChatBubble key={i} message={m} />
        ))}
        {sending && <div className={`${styles.bubble} ${styles.bubbleAgent} ${styles.muted}`}>The agent is writing…</div>}
        <div ref={endRef} />
      </div>

      {options.length > 0 && !sending && (
        <div className={styles.options}>
          {options.map((o) => (
            <button key={o} type="button" className="btn btn-outline btn-sm" onClick={() => send(o)}>{o}</button>
          ))}
        </div>
      )}

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <form
        className={styles.chatInput}
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <textarea
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          rows={2}
          placeholder="Reply as the client would…"
          aria-label="Your message"
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>Send</button>
      </form>
    </section>
  )
}

export function ChatBubble({ message }: { message: Msg }) {
  if (message.role === 'user') return <div className={`${styles.bubble} ${styles.bubbleUser}`}>{message.content}</div>
  const { visible: withoutDoc, doc } = extractDocument(message.content)
  const { visible } = extractOptions(withoutDoc)
  return (
    <>
      {visible && <div className={`${styles.bubble} ${styles.bubbleAgent}`}>{visible.replace(/\*\*/g, '')}</div>}
      {doc && (
        <div className={styles.document}>
          <div className={styles.documentHead}>
            <strong>{doc.title}</strong>
            {doc.priceLabel && <span className={styles.muted}>{doc.priceLabel}</span>}
          </div>
          <pre className={styles.pre}>{doc.body}</pre>
        </div>
      )}
    </>
  )
}
