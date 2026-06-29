'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Agent, AgentId } from '@/lib/agents'
import { textDocumentBlobUrl, downloadTextDocument } from '@/lib/pdfGenerator'
import PaymentForm from './PaymentForm'
import styles from './AgentChat.module.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface DraftDocument {
  title: string
  body: string
  price?: number
  priceLabel?: string
}

interface AgentChatProps {
  agent: Agent
  amount: number
  paymentDescription: string
  onClose: () => void
  onApproved: (agentId: AgentId) => void
}

const DOCUMENT_BLOCK_RE =
  /<<<DOCUMENT>>>\s*TITLE:\s*(.+?)\s*\n(?:PRICE:\s*(.+?)\s*\n)?(?:PRICE_LABEL:\s*(.+?)\s*\n)?-{3,}\n([\s\S]*?)<<<END_DOCUMENT>>>/

function extractDocument(content: string): { visible: string; doc: DraftDocument | null } {
  const match = content.match(DOCUMENT_BLOCK_RE)
  if (!match) return { visible: content, doc: null }
  const intro = content.slice(0, match.index).trim()
  const priceRaw = match[2] ? Number(match[2].trim()) : undefined
  const price = priceRaw !== undefined && !Number.isNaN(priceRaw) ? priceRaw : undefined
  const priceLabel = match[3] ? match[3].trim() : undefined
  return {
    visible: intro || 'Here is your drafted document — review it in the panel below.',
    doc: { title: match[1].trim(), body: match[4].trim(), price, priceLabel },
  }
}

function renderContent(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export default function AgentChat({ agent, amount, paymentDescription, onClose, onApproved }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: agent.starterMessage }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draftDoc, setDraftDoc] = useState<DraftDocument | null>(null)
  const [paid, setPaid] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

  const continueLabel = agent.id === 'lawyer-consultation' ? 'Continue to Booking →' : 'Continue to Next Steps →'

  const effectiveAmount = draftDoc?.price ?? amount
  const effectiveDescription = draftDoc?.priceLabel
    ? `${draftDoc.priceLabel} — ${paymentDescription}`
    : paymentDescription

  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, loading, draftDoc])

  useEffect(() => {
    if (!draftDoc) {
      setPreviewUrl('')
      return
    }
    const url = String(textDocumentBlobUrl(draftDoc.title, draftDoc.body, { watermark: !paid }))
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [draftDoc, paid])

  function handleClear() {
    setMessages([{ role: 'assistant', content: agent.starterMessage }])
    setError('')
    setDraftDoc(null)
    setPaid(false)
    setPayOpen(false)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    const nextMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, agentId: agent.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        const { visible, doc } = extractDocument(data.response)
        setMessages((prev) => [...prev, { role: 'assistant', content: visible }])
        if (doc) setDraftDoc(doc)
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={agent.name}>
        <div className={styles.header}>
          <span className={styles.headerDot} style={{ background: agent.color }} />
          <div className={styles.headerInfo}>
            <div className={styles.headerName}>{agent.name}</div>
            <div className={styles.headerSub}>Pandas LP · Nigerian Law</div>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleClear}
              aria-label="Clear chat"
              title="Clear chat"
            >
              ↺
            </button>
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close chat" title="Close">
              ✕
            </button>
          </div>
        </div>

        <div className={styles.disclaimer}>This agent prepares legal documents — not legal advice.</div>

        {payOpen && !paid ? (
          <div className={styles.payWrap}>
            <PaymentForm
              amount={effectiveAmount}
              description={effectiveDescription}
              onSuccess={() => {
                setPaid(true)
                setPayOpen(false)
              }}
              onBack={() => setPayOpen(false)}
            />
          </div>
        ) : (
          <>
            <div className={styles.messages} ref={messagesRef}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`${styles.bubbleRow} ${m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant}`}
                >
                  <div className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
                    {renderContent(m.content)}
                  </div>
                </div>
              ))}

              {loading && (
                <div className={`${styles.bubbleRow} ${styles.bubbleRowAssistant}`}>
                  <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                    <span className={styles.typingDots}>
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </div>
              )}

              {error && <div className={styles.bubbleError}>{error}</div>}
            </div>

            {draftDoc && (
              <div className={styles.documentPanel}>
                <div className={styles.documentHeader}>
                  <span className={styles.documentTitle}>{draftDoc.title}</span>
                  {paid ? <span className="badge">Paid</span> : <span className="badge badge-test">Sample Preview</span>}
                </div>

                {draftDoc.priceLabel && !paid && (
                  <div className={styles.documentTitle} style={{ marginTop: -8, marginBottom: 8, opacity: 0.8 }}>
                    Selected option: {draftDoc.priceLabel}
                  </div>
                )}

                {previewUrl && <iframe title="Document preview" src={previewUrl} className={styles.docFrame} />}

                <div className={styles.documentActions}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => downloadTextDocument(draftDoc.title, draftDoc.body, { watermark: !paid })}
                  >
                    {paid ? 'Download PDF' : 'Download Sample'}
                  </button>
                  {!paid ? (
                    <button type="button" className="btn btn-primary" onClick={() => setPayOpen(true)}>
                      Approve & Pay ₦{effectiveAmount.toLocaleString()} →
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={() => onApproved(agent.id)}>
                      {continueLabel}
                    </button>
                  )}
                </div>
              </div>
            )}

            {!paid && (
              <div className={styles.inputRow}>
                <textarea
                  className={styles.textarea}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message…"
                  rows={1}
                />
                <button type="button" className="btn btn-primary" onClick={handleSend} disabled={loading || !input.trim()}>
                  Send
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
