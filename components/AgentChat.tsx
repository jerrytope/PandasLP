'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { Agent, AgentId } from '@/lib/agents'
import { textDocumentBlobUrl } from '@/lib/pdfGenerator'
import { supabase, authedFetch } from '@/lib/supabaseClient'
import { extractDocument, extractOptions, extractClientPhone, type DraftDocument } from '@/lib/agentChatParsing'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { getAttribution } from '@/lib/attribution'
import { trackEvent } from '@/lib/analytics'
import PaymentForm from './PaymentForm'
import styles from './AgentChat.module.css'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export type { DraftDocument }

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
  // Sent automatically as the first user turn on mount — used to hand the agent context
  // (e.g. escalating an existing case) without making the user retype it.
  initialAutoMessage?: string
  // Whether this resumed case already has a callback number on file — see the post-payment
  // fallback phone form below for why this matters.
  initialClientPhone?: string | null
  // Render as a page-filling section (no dark backdrop, no floating card) instead of a modal overlay
  fullPage?: boolean
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
  initialAutoMessage,
  initialClientPhone,
  fullPage = false,
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
  const [verifying, setVerifying] = useState(false)
  const [payError, setPayError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  // Tracks whether a callback number is on file for this case — the AI is supposed to
  // capture this during intake for the pandas-serves tier, but the chat input disappears
  // entirely once paid (see the fallback form below), so this can't just be inferred from
  // "did the AI emit a CLIENT_PHONE block" — a case can reach paid with this still false.
  const [hasClientPhone, setHasClientPhone] = useState(Boolean(initialClientPhone))
  const [fallbackPhone, setFallbackPhone] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneSaveError, setPhoneSaveError] = useState('')
  const [caseId, setCaseId] = useState<string | null>(initialCaseId ?? null)
  const [extracting, setExtracting] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const caseRefRef = useRef<string>('')
  // Synchronous case-identity tracking for ensureCase() — see its comment below for why this
  // can't just read the `caseId` state value.
  const caseIdRef = useRef<string | null>(initialCaseId ?? null)
  const caseCreationPromiseRef = useRef<Promise<{ id: string; ref: string } | null> | null>(null)
  // Guards sendToAgent against re-entrant calls (e.g. the auto-kickoff effect racing a
  // fast user-typed send on a slow connection).
  const sendingRef = useRef(false)
  const modalRef = useRef<HTMLDivElement>(null)
  // Only trap focus in the floating-modal presentation — fullPage is a real page with its
  // own Navbar/Footer that Tab should still be able to reach.
  useFocusTrap(modalRef, !fullPage)

  const continueLabel = agent.id === 'lawyer-consultation' ? 'Continue to Booking →' : 'View My Case Dashboard →'
  const effectiveAmount = draftDoc?.price ?? amount
  const effectiveDescription = draftDoc?.priceLabel
    ? `${draftDoc.priceLabel} — ${paymentDescription}`
    : paymentDescription

  useEffect(() => {
    // Only meaningful when this is actually a dialog — in fullPage mode there's no modal to
    // close, and onClose there navigates away entirely (e.g. back to '/'), so an unguarded
    // listener would silently discard an in-progress interview on a stray Escape press.
    if (fullPage) return
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, fullPage])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, loading, draftDoc])

  // Resuming an existing case — fetch its file reference so later corrections reuse the
  // same number instead of falling back to a fresh PENDING placeholder.
  useEffect(() => {
    if (!initialCaseId) return
    supabase
      .from('cases')
      .select('case_number, created_at')
      .eq('id', initialCaseId)
      .single()
      .then(({ data }) => {
        if (data?.case_number != null) {
          const year = new Date(data.created_at).getFullYear()
          caseRefRef.current = `PLP/${year}/${String(data.case_number).padStart(6, '0')}`
        }
      })
  }, [initialCaseId])

  useEffect(() => {
    if (!draftDoc) {
      setPreviewUrl('')
      return
    }
    // Always watermarked, paid or not — this is a preview so the client can confirm the
    // facts are correct, never the final deliverable. The clean copy only ever reaches them
    // by email, after a licensed reviewer has actually looked at it (see markReviewed in
    // app/api/update-case-status/route.ts). Without this, the in-browser preview itself would
    // be a clean-copy leak the moment payment succeeded, regardless of whether a "Download"
    // button exists.
    const url = String(textDocumentBlobUrl(draftDoc.title, draftDoc.body, { watermark: true }))
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [draftDoc])

  // ----- Supabase persistence helpers -----

  // finalizeDocument, saveTurn, and saveClientPhone can all call this within the same
  // sendToAgent invocation. They're closures over the same render, so the `caseId` *state*
  // wouldn't update between those calls even if we awaited setCaseId — only a ref updates
  // synchronously enough to prevent every one of those calls inserting its own case row.
  // caseCreationPromiseRef additionally makes concurrent callers await the same in-flight
  // insert instead of each starting their own.
  async function ensureCase(): Promise<{ id: string; ref: string } | null> {
    if (!userId) return null
    if (caseIdRef.current) return { id: caseIdRef.current, ref: caseRefRef.current }
    if (caseCreationPromiseRef.current) return caseCreationPromiseRef.current

    const creation = (async () => {
      const { source, sourceDetail } = getAttribution()
      const { data, error: dbErr } = await supabase
        .from('cases')
        .insert({ user_id: userId, agent_id: agent.id, status: 'draft', source, source_detail: sourceDetail })
        .select('id, case_number, created_at')
        .single()

      if (dbErr || !data) {
        caseCreationPromiseRef.current = null
        return null
      }
      caseIdRef.current = data.id
      setCaseId(data.id)
      if (data.case_number != null) {
        const year = new Date(data.created_at).getFullYear()
        caseRefRef.current = `PLP/${year}/${String(data.case_number).padStart(6, '0')}`
      }
      return { id: data.id, ref: caseRefRef.current }
    })()

    caseCreationPromiseRef.current = creation
    return creation
  }

  // The document template leaves a literal {{REF_NUMBER}} token for the AI to copy verbatim —
  // this substitutes in the real, DB-assigned file reference once the case exists.
  async function finalizeDocument(doc: DraftDocument | null): Promise<DraftDocument | null> {
    if (!doc) return doc
    if (!doc.body.includes('{{REF_NUMBER}}')) return doc
    const caseInfo = await ensureCase()
    const ref = caseInfo?.ref || `PLP/${new Date().getFullYear()}/PENDING`
    return { ...doc, body: doc.body.split('{{REF_NUMBER}}').join(ref) }
  }

  async function saveTurn(userMsg: Message, assistantMsg: Message, newDoc: DraftDocument | null) {
    const caseInfo = await ensureCase()
    if (!caseInfo) return
    const id = caseInfo.id

    await supabase.from('messages').insert([
      { case_id: id, role: 'user', content: userMsg.content },
      { case_id: id, role: 'assistant', content: assistantMsg.content },
    ])

    if (newDoc) {
      // Provisional — /api/update-case-status recalculates this from the real "served" date
      // once staff mark the letter served. 14 days matches the response period stated in the
      // letter itself (see lib/agents.ts) and Form SCA 1's actual demand-letter requirement.
      const deadline =
        agent.id === 'small-claims'
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          : null

      // Recorded now, before payment, so /api/verify-payment can trust it instead of
      // re-deriving from the paid amount — a discount applied later must never be able to
      // silently reclassify a pandas-serves purchase as self-serve.
      const deliveryOption =
        agent.id === 'small-claims' ? ((newDoc.price ?? amount) >= 25000 ? 'pandas-serves' : 'self-serve') : null

      await supabase
        .from('cases')
        .update({
          document_title: newDoc.title,
          document_body: newDoc.body,
          status: 'document_ready',
          expected_amount: newDoc.price ?? amount,
          ...(deadline ? { deadline_at: deadline } : {}),
          ...(deliveryOption ? { delivery_option: deliveryOption } : {}),
        })
        .eq('id', id)

      trackEvent('document_ready', { agent_id: agent.id, amount: newDoc.price ?? amount })
    }
  }

  async function saveClientPhone(phone: string) {
    const caseInfo = await ensureCase()
    if (!caseInfo) return
    const { error: dbErr } = await supabase.from('cases').update({ client_phone: phone }).eq('id', caseInfo.id)
    if (!dbErr) setHasClientPhone(true)
  }

  // Fallback for when the AI didn't capture a callback number before the chat input
  // disappears at `paid` — see the fallback form rendered near the bottom of this component.
  async function submitFallbackPhone() {
    const trimmed = fallbackPhone.trim()
    if (!trimmed || !caseId) return
    setSavingPhone(true)
    setPhoneSaveError('')
    try {
      const { error: dbErr } = await supabase.from('cases').update({ client_phone: trimmed }).eq('id', caseId)
      if (dbErr) {
        setPhoneSaveError('Could not save your number. Please try again.')
        return
      }
      setHasClientPhone(true)
    } catch {
      setPhoneSaveError('Network error. Please try again.')
    } finally {
      setSavingPhone(false)
    }
  }

  // Paystack (or the stub checkout) reports success client-side, but that alone proves
  // nothing — anyone can call this with a fabricated reference. The case is only marked
  // paid once /api/verify-payment independently confirms the transaction with Paystack
  // (or, in stub mode, once we've confirmed there's genuinely no live gateway to check
  // against). The watermark-free document preview reads `paid` state, so this is also
  // what keeps an unpaid visitor from getting a clean copy of the letter.
  async function handlePaymentDone(response: { reference: string; stub?: boolean }) {
    if (verifying || paid) return // guards against a payment SDK callback firing more than once
    if (!caseId || !userId) {
      // No case/user to attach a payment to — nothing to verify. Shouldn't happen in
      // practice since sign-in is required before a case exists.
      setPaid(true)
      setPayOpen(false)
      return
    }

    setVerifying(true)
    setPayError('')
    try {
      const res = await authedFetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId,
          reference: response.reference,
          amount: effectiveAmount,
          stub: Boolean(response.stub),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setPayError(data.error || 'Could not verify your payment. Please try again.')
        return
      }

      setPaid(true)
      setPayOpen(false)
      trackEvent('payment_completed', { agent_id: agent.id, amount: effectiveAmount })

      // Fire confirmation email — non-blocking
      authedFetch('/api/send-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, type: 'payment_confirmed' }),
      }).catch((err) => console.error('Failed to send payment confirmation email:', err))
    } catch (err) {
      console.error('Payment verification failed:', err)
      setPayError('Network error while verifying your payment. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  // ----- Chat -----

  // Single request/response/persistence pipeline shared by every place a message can be
  // sent to the agent (typed input, quick-reply options, and auto-kickoff on mount) — keeps
  // the request contract in one place instead of re-implemented per call site.
  async function sendToAgent(nextMessages: Message[], msgToPersist: Message) {
    if (sendingRef.current) return
    sendingRef.current = true
    if (messages.length === 0) trackEvent('interview_started', { agent_id: agent.id })
    setMessages(nextMessages)
    setError('')
    setLoading(true)
    try {
      const res = await authedFetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, agentId: agent.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      const { visible: afterPhone, phone } = extractClientPhone(data.response ?? '')
      const { visible, doc: rawDoc } = extractDocument(afterPhone)
      const assistantMsg: Message = { role: 'assistant', content: visible }
      setMessages((prev) => [...prev, assistantMsg])
      const doc = await finalizeDocument(rawDoc)
      if (doc) setDraftDoc(doc)
      if (phone) saveClientPhone(phone).catch((err) => console.error('Failed to save client phone:', err))
      saveTurn(msgToPersist, assistantMsg, doc).catch((err) => console.error('Failed to save conversation turn:', err))
    } catch (err) {
      console.error('Chat request failed:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
      sendingRef.current = false
    }
  }

  // Auto-kickoff — used when the agent is opened with pre-supplied context (e.g. escalating
  // an existing case) so the user doesn't have to retype what already happened.
  const autoSentRef = useRef(false)
  useEffect(() => {
    if (!initialAutoMessage || autoSentRef.current) return
    autoSentRef.current = true
    const userMsg: Message = { role: 'user', content: initialAutoMessage }
    sendToAgent([...messages, userMsg], userMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAutoMessage])

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
      const res = await authedFetch('/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, mediaType: file.type, filename: file.name }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Could not read the document. Please try again.')
        return
      }

      // Inject extracted facts as a user context message, then get AI to acknowledge and continue
      const factsMsg: Message = {
        role: 'user',
        content: `DOCUMENT CONTEXT — Facts extracted from ${file.name}:\n${data.facts}\n\nPlease confirm what you found and continue with only the questions I haven't answered yet.`,
      }
      await sendToAgent([...messages, attachMsg, factsMsg], factsMsg)
    } catch (err) {
      console.error('Document extraction failed:', err)
      setError('Network error during document analysis.')
    } finally {
      setExtracting(false)
    }
  }

  function handleClear() {
    setMessages([{ role: 'assistant', content: agent.starterMessage }])
    setError('')
    setDraftDoc(null)
    setPaid(false)
    setPayOpen(false)
    setCaseId(null)
    caseRefRef.current = ''
  }

  function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: Message = { role: 'user', content: text }
    setInput('')
    sendToAgent([...messages, userMsg], userMsg)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className={fullPage ? styles.pageOuter : styles.overlay}
      onMouseDown={
        fullPage
          ? undefined
          : (e) => {
              if (e.target === e.currentTarget) onClose()
            }
      }
    >
      <div
        className={fullPage ? styles.pageModal : styles.modal}
        role={fullPage ? undefined : 'dialog'}
        aria-modal={fullPage ? undefined : true}
        aria-label={agent.name}
        ref={modalRef}
      >
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
              busy={verifying}
            />
            {verifying && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 10 }}>
                Verifying your payment…
              </p>
            )}
            {payError && <p role="alert" className={styles.bubbleError} style={{ marginTop: 10 }}>{payError}</p>}
          </div>
        ) : (
          <>
            <div className={styles.messages} ref={messagesRef} aria-live="polite" aria-relevant="additions">
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
                                sendToAgent([...messages, userMsg], userMsg)
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
                  {paid ? <span className="badge">Paid — Sent For Review</span> : <span className="badge badge-test">Preview</span>}
                </div>

                {draftDoc.priceLabel && !paid && (
                  <div className={styles.documentTitle} style={{ marginTop: -8, marginBottom: 8, opacity: 0.8 }}>
                    Selected option: {draftDoc.priceLabel}
                  </div>
                )}

                {previewUrl && <iframe title="Document preview" src={previewUrl} className={styles.docFrame} />}

                {paid && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '10px 0 0' }}>
                    Thank you — please confirm the facts above are correct. Your letter has been sent to our legal
                    team for review. You'll receive your reviewed copy by email once that's done — there's no
                    download here, since nothing is final until a licensed reviewer has checked it.
                  </p>
                )}

                <div className={styles.documentActions}>
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

            {paid && agent.id === 'small-claims' && effectiveAmount >= 25000 && !hasClientPhone && (
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600, marginBottom: 4 }}>
                  One more thing — what number should our team call you on?
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  You chose to have Pandas LP serve this letter personally. We need a phone number to reach you once service is arranged.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="tel"
                    className="input"
                    placeholder="e.g. +234 801 234 5678"
                    value={fallbackPhone}
                    onChange={(e) => setFallbackPhone(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitFallbackPhone() }}
                    style={{ flex: 1, fontSize: 13, padding: '9px 12px' }}
                    aria-label="Phone number for Pandas LP to call you on"
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!fallbackPhone.trim() || savingPhone}
                    onClick={submitFallbackPhone}
                  >
                    {savingPhone ? '…' : 'Save'}
                  </button>
                </div>
                {phoneSaveError && (
                  <p role="alert" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{phoneSaveError}</p>
                )}
              </div>
            )}

            {paid && agent.id === 'small-claims' && effectiveAmount >= 25000 && hasClientPhone && (
              <p style={{ padding: '10px 18px', fontSize: 12, color: 'var(--secondary)', borderTop: '1px solid var(--border)' }}>
                ✓ We have a callback number on file for you.
              </p>
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
                  aria-label="Type your message"
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
