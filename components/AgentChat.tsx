'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { Agent, AgentId } from '@/lib/agents'
import { textDocumentBlobUrl, downloadTextDocument } from '@/lib/pdfGenerator'
import { supabase } from '@/lib/supabaseClient'
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
  userId?: string
  initialCaseId?: string
  initialMessages?: Message[]
  initialDraftDoc?: DraftDocument | null
}

const DOCUMENT_BLOCK_RE =
  /<<<DOCUMENT>>>\s*TITLE:\s*(.+?)\s*\n(?:PRICE:\s*(.+?)\s*\n)?(?:PRICE_LABEL:\s*(.+?)\s*\n)?-{3,}\n([\s\S]*?)<<<END_DOCUMENT>>>/

const OPTIONS_BLOCK_RE = /<<<OPTIONS>>>\n([\s\S]*?)<<<END_OPTIONS>>>/

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

function extractOptions(content: string): { visible: string; options: string[] } {
  const match = content.match(OPTIONS_BLOCK_RE)
  if (!match) return { visible: content, options: [] }
  const options = match[1].split('\n').map((s) => s.trim()).filter(Boolean)
  const visible = content.replace(OPTIONS_BLOCK_RE, '').trim()
  return { visible, options }
}

function renderContent(text: string): ReactNode {
  const lines = text.split('\n')
  return lines.map((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    return (
      <span key={li}>
        {parts.map((part, i) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
        {li < lines.length - 1 && <br />}
      </span>
    )
  })
}

export default function AgentChat({
  agent,
  amount,
  paymentDescription,
  onClose,
  onApproved,
  userId,
  initialCaseId,
  initialMessages,
  initialDraftDoc,
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages && initialMessages.length > 0
      ? initialMessages
      : [{ role: 'assistant', content: agent.starterMessage }],
  )
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draftDoc, setDraftDoc] = useState<DraftDocument | null>(initialDraftDoc ?? null)
  const [paid, setPaid] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [caseId, setCaseId] = useState<string | null>(initialCaseId ?? null)
  const [extracting, setExtracting] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // ----- Supabase persistence helpers -----

  async function ensureCase(): Promise<string | null> {
    if (!userId) return null
    if (caseId) return caseId

    const { data, error: dbErr } = await supabase
      .from('cases')
      .insert({ user_id: userId, agent_id: agent.id, status: 'draft' })
      .select('id')
      .single()

    if (dbErr || !data) return null
    setCaseId(data.id)
    return data.id
  }

  async function saveTurn(userMsg: Message, assistantMsg: Message, newDoc: DraftDocument | null) {
    const id = await ensureCase()
    if (!id) return

    await supabase.from('messages').insert([
      { case_id: id, role: 'user', content: userMsg.content },
      { case_id: id, role: 'assistant', content: assistantMsg.content },
    ])

    if (newDoc) {
      const deadline =
        agent.id === 'small-claims'
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null

      await supabase
        .from('cases')
        .update({
          document_title: newDoc.title,
          document_body: newDoc.body,
          status: 'document_ready',
          ...(deadline ? { deadline_at: deadline } : {}),
        })
        .eq('id', id)
    }
  }

  async function handlePaymentDone() {
    setPaid(true)
    setPayOpen(false)

    if (caseId && userId) {
      await supabase
        .from('cases')
        .update({
          status: 'paid',
          amount_paid: effectiveAmount,
          delivery_option: draftDoc?.priceLabel?.toLowerCase().includes('pandas') ? 'pandas-serves' : 'self-serve',
        })
        .eq('id', caseId)
    }
  }

  // ----- Chat -----

  // ----- File upload -----

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!ALLOWED.includes(file.type)) {
      setError('Unsupported file type. Please upload a PDF, JPG, PNG, or WEBP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.')
      return
    }

    // Convert to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1]) // strip data URL prefix
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    // Show attachment bubble
    const attachMsg: Message = {
      role: 'user',
      content: `📎 Attached: ${file.name}`,
    }
    setMessages((prev) => [...prev, attachMsg])
    setExtracting(true)
    setError('')

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, mediaType: file.type, filename: file.name }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Could not read the document. Please try again.')
        setExtracting(false)
        return
      }

      // Inject extracted facts as a user context message, then get AI to acknowledge and continue
      const factsMsg: Message = {
        role: 'user',
        content: `DOCUMENT CONTEXT — Facts extracted from ${file.name}:\n${data.facts}\n\nPlease confirm what you found and continue with only the questions I haven't answered yet.`,
      }
      const nextMessages: Message[] = [...messages, attachMsg, factsMsg]
      setMessages(nextMessages)
      setExtracting(false)
      setLoading(true)

      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, agentId: agent.id }),
      })
      const chatData = await chatRes.json()

      if (!chatRes.ok || chatData.error) {
        setError(chatData.error || 'Something went wrong. Please try again.')
      } else {
        const { visible, doc } = extractDocument(chatData.response)
        const assistantMsg: Message = { role: 'assistant', content: visible }
        setMessages((prev) => [...prev, assistantMsg])
        if (doc) setDraftDoc(doc)
        saveTurn(factsMsg, assistantMsg, doc).catch(() => {})
      }
    } catch {
      setError('Network error during document analysis.')
    } finally {
      setExtracting(false)
      setLoading(false)
    }
  }

  function handleClear() {
    setMessages([{ role: 'assistant', content: agent.starterMessage }])
    setError('')
    setDraftDoc(null)
    setPaid(false)
    setPayOpen(false)
    setCaseId(null)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: Message = { role: 'user', content: text }
    const nextMessages: Message[] = [...messages, userMsg]
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
        const assistantMsg: Message = { role: 'assistant', content: visible }
        setMessages((prev) => [...prev, assistantMsg])
        if (doc) setDraftDoc(doc)
        // Fire-and-forget persistence
        saveTurn(userMsg, assistantMsg, doc).catch(() => {})
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
            <div className={styles.headerSub}>
              Pandas LP · Nigerian Law
              {!userId && (
                <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 11 }}>
                  · Sign in to save progress
                </span>
              )}
            </div>
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
              onSuccess={handlePaymentDone}
              onBack={() => setPayOpen(false)}
            />
          </div>
        ) : (
          <>
            <div className={styles.messages} ref={messagesRef}>
              {messages.map((m, i) => {
                const isLastMsg = i === messages.length - 1
                const { visible, options } = m.role === 'assistant'
                  ? extractOptions(m.content)
                  : { visible: m.content, options: [] }

                return (
                  <div key={i}>
                    <div
                      className={`${styles.bubbleRow} ${m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant}`}
                    >
                      <div className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
                        {renderContent(visible)}
                      </div>
                    </div>
                    {/* Quick-reply buttons — only on last AI message, only while not loading */}
                    {m.role === 'assistant' && isLastMsg && !loading && options.length > 0 && (
                      <div className={styles.optionsRow}>
                        {options.map((opt, oi) => (
                          <button
                            key={oi}
                            type="button"
                            className={styles.optionBtn}
                            onClick={() => {
                              setInput(opt)
                              setTimeout(() => {
                                setInput('')
                                const userMsg: Message = { role: 'user', content: opt }
                                const nextMessages: Message[] = [...messages, userMsg]
                                setMessages(nextMessages)
                                setError('')
                                setLoading(true)
                                fetch('/api/chat', {
                                  method: 'POST',
                                  headers: { 'content-type': 'application/json' },
                                  body: JSON.stringify({ messages: nextMessages, agentId: agent.id }),
                                })
                                  .then((r) => r.json())
                                  .then((data) => {
                                    const { visible: v, doc } = extractDocument(data.response ?? '')
                                    const assistantMsg: Message = { role: 'assistant', content: v }
                                    setMessages((prev) => [...prev, assistantMsg])
                                    if (doc) setDraftDoc(doc)
                                    saveTurn(userMsg, assistantMsg, doc).catch(() => {})
                                  })
                                  .catch(() => setError('Network error. Please try again.'))
                                  .finally(() => setLoading(false))
                              }, 0)
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

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
                  {paid ? <span className="badge">Paid — Clean Copy</span> : <span className="badge badge-test">Free Preview</span>}
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

            {extracting && (
              <div className={styles.extractingRow}>
                <div className={styles.extractingBubble}>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  Analysing document…
                </div>
              </div>
            )}

            {!paid && (
              <div className={styles.inputRow}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  className={styles.uploadBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || extracting}
                  title="Attach a document or invoice"
                  aria-label="Attach file"
                >
                  📎
                </button>
                <textarea
                  className={styles.textarea}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message or attach a document…"
                  rows={1}
                />
                <button type="button" className="btn btn-primary" onClick={handleSend} disabled={loading || extracting || !input.trim()}>
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
