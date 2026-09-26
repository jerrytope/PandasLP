'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { Agent, AgentId } from '@/lib/agents'
import { textDocumentBlobUrl } from '@/lib/pdfGenerator'
import { supabase, authedFetch } from '@/lib/supabaseClient'
import { extractDocument, extractOptions, extractClientPhone, extractClientEmail, extractRecipientPhone, type DraftDocument } from '@/lib/agentChatParsing'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { getAttribution } from '@/lib/attribution'
import { trackEvent } from '@/lib/analytics'
import { X, Paperclip, Check } from 'lucide-react'
import PaymentForm from './PaymentForm'
import ExtractionConfirmModal, { type PendingExtraction } from './ExtractionConfirmModal'
import VoiceRecorder from './VoiceRecorder'
import AudioReader from './AudioReader'
import TranslationPane from './TranslationPane'
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
  // True when the resumed case is already in a paid-or-beyond status in the DB — prevents
  // the pay button and "Preview" badge from re-appearing after a page refresh on a case
  // that has already been paid. Without this, `paid` state always initialises false and the
  // user sees a stale pre-payment UI even though the DB shows the case as paid.
  initialPaid?: boolean
  // Render as a page-filling section (no dark backdrop, no floating card) instead of a modal overlay
  fullPage?: boolean
  // Custom Claims tab (app/admin/page.tsx) only — a Pandas LP lawyer relaying a case they
  // picked up offline, not the client themselves. Swaps the client-facing starter message
  // for one addressed to staff, sends lawyerIntake to /api/chat so the server swaps in
  // lib/agents.ts's SMALL_CLAIMS_LAWYER_INTAKE_PROMPT, captures the real client's email via
  // the CLIENT_EMAIL block (there is no client Supabase account for this case at all — see
  // supabase-schema.sql's client_email column), and skips the Paystack "Approve & Pay" button
  // entirely: staff aren't the paying party, and payment for an offline case is confirmed and
  // recorded separately (see the Cases tab's "Mark Paid (Offline)" action).
  lawyerIntake?: boolean
}

const LAWYER_INTAKE_STARTER_MESSAGE =
  "Hi — tell me about the case you picked up. Who owes the client money, roughly how much, and how did the debt come about? I'll ask you anything else I need as we go, and flag anything you'll need to go back and confirm with the client."

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
  initialPaid = false,
  fullPage = false,
  lawyerIntake = false,
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages && initialMessages.length > 0
      ? initialMessages
      : [{ role: 'assistant', content: lawyerIntake ? LAWYER_INTAKE_STARTER_MESSAGE : agent.starterMessage }],
  )
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draftDoc, setDraftDoc] = useState<DraftDocument | null>(initialDraftDoc ?? null)
  // True only when the most recent draftDoc failed to persist to the case row — blocks
  // payment on that document until a later turn saves successfully, so a client can never
  // pay against a document that exists only in this tab's memory (see saveTurn/sendToAgent).
  const [docSaveFailed, setDocSaveFailed] = useState(false)
  // Hydrated from initialPaid so a resumed paid case shows the correct post-payment UI
  // immediately on mount, without waiting for the user to trigger a payment flow.
  const [paid, setPaid] = useState(initialPaid)
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
  // Set once /api/extract returns, cleared once the user confirms or discards — see
  // ExtractionConfirmModal. Holds the just-added "Attached: <file>" bubble alongside the
  // extraction so cancelling can cleanly remove it (nothing was actually contributed).
  const [pendingExtraction, setPendingExtraction] = useState<PendingExtraction | null>(null)
  const pendingAttachMsgRef = useRef<Message | null>(null)
  // Multi-file attach: the user can select several files in one picker action (see
  // handleFileSelect's `multiple` input), but they're still reviewed one at a time through
  // the same ExtractionConfirmModal gate — batch convenience must never dilute the
  // human-reviews-every-extraction rule that gate exists for. pendingBatchRef holds the
  // files still waiting after the one currently in the modal; batchTotal/batchIndex only
  // drive the "File X of Y" label and are safe as plain state since nothing else reads them.
  const pendingBatchRef = useRef<File[]>([])
  const [batchTotal, setBatchTotal] = useState(0)
  const [batchIndex, setBatchIndex] = useState(0)
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

  const continueLabel = lawyerIntake
    ? 'Done — Save This Case →'
    : agent.id === 'lawyer-consultation'
      ? 'Continue to Booking →'
      : 'View My Case Dashboard →'
  const effectiveAmount = draftDoc?.price ?? amount
  // PRICE: 0 is the agent's way of saying "there is nothing to collect here". It is not a
  // free document — it means the fee is one the firm invoices directly rather than one
  // Paystack can take, which today is the 2.5% on a transfer of title. Percentage fees on a
  // property sale run to millions, and taking that through a card checkout before the team
  // has done the stamping and perfection is not how the firm wants to be paid. So the
  // document is still drafted and shown for the client to check, and the matter is handed to
  // the team instead of to a payment form. Deliberately `=== 0` rather than falsy: an absent
  // PRICE line parses to undefined and must keep falling back to the agent's standard fee.
  const invoicedByFirm = draftDoc?.price === 0
  const effectiveDescription = draftDoc?.priceLabel
    ? `${draftDoc.priceLabel} (${paymentDescription})`
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
      // A lawyer-intake case didn't come from a ?ref=/utm_* link at all — user_id here is
      // the STAFF member running the session, not a client who arrived via some channel, so
      // getAttribution()'s browser-side capture would just report whatever this staff
      // member's own browser last saw and mislabel the case's real source.
      const { source, sourceDetail } = lawyerIntake
        ? { source: 'staff-offline', sourceDetail: null }
        : getAttribution()
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

  // Returns false when a drafted document failed to persist, so callers can warn the user
  // instead of leaving them looking at a document preview that only exists in local React
  // state — the Supabase client resolves {error} on a failed write rather than throwing, so
  // a bare `await` here would otherwise swallow that failure silently (see the caller in
  // sendToAgent, which used to fire-and-forget this with only a .catch for network-level throws).
  async function saveTurn(userMsg: Message, assistantMsg: Message, newDoc: DraftDocument | null): Promise<boolean> {
    const caseInfo = await ensureCase()
    if (!caseInfo) return false
    const id = caseInfo.id

    const { error: msgErr } = await supabase.from('messages').insert([
      { case_id: id, role: 'user', content: userMsg.content },
      { case_id: id, role: 'assistant', content: assistantMsg.content },
    ])
    if (msgErr) console.error('Failed to save conversation turn:', msgErr)

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

      const { error: docErr } = await supabase
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

      if (docErr) {
        console.error('Failed to save document to case:', docErr)
        return false
      }

      trackEvent('document_ready', { agent_id: agent.id, amount: newDoc.price ?? amount })
    }
    return true
  }

  async function saveClientPhone(phone: string) {
    const caseInfo = await ensureCase()
    if (!caseInfo) return
    const { error: dbErr } = await supabase.from('cases').update({ client_phone: phone }).eq('id', caseInfo.id)
    if (!dbErr) setHasClientPhone(true)
  }

  // The debtor's phone — who the letter is actually served on, via "Serve via WhatsApp" in
  // the admin dashboard. Distinct from client_phone above: two different people's numbers,
  // never to be confused. See the RECIPIENT_PHONE block in lib/agents.ts.
  async function saveRecipientPhone(phone: string) {
    const caseInfo = await ensureCase()
    if (!caseInfo) return
    const { error: dbErr } = await supabase.from('cases').update({ recipient_phone: phone }).eq('id', caseInfo.id)
    if (dbErr) console.error('Failed to save recipient phone:', dbErr)
  }

  // lawyerIntake only — see the CLIENT_EMAIL block in lib/agents.ts's
  // SMALL_CLAIMS_LAWYER_INTAKE_PROMPT and client_email in supabase-schema.sql.
  async function saveClientEmail(email: string) {
    const caseInfo = await ensureCase()
    if (!caseInfo) return
    const { error: dbErr } = await supabase.from('cases').update({ client_email: email }).eq('id', caseInfo.id)
    if (dbErr) console.error('Failed to save client email:', dbErr)
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
        // caseId lets the server count this turn's AI cost toward the matter (ownership is checked there).
        body: JSON.stringify({ messages: nextMessages, agentId: agent.id, ...(caseIdRef.current ? { caseId: caseIdRef.current } : {}), ...(lawyerIntake ? { lawyerIntake: true } : {}) }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      const { visible: afterPhone, phone } = extractClientPhone(data.response ?? '')
      const { visible: afterRecipientPhone, phone: recipientPhone } = extractRecipientPhone(afterPhone)
      const { visible: afterEmail, email: clientEmail } = extractClientEmail(afterRecipientPhone)
      const { visible, doc: rawDoc } = extractDocument(afterEmail)
      const assistantMsg: Message = { role: 'assistant', content: visible }
      setMessages((prev) => [...prev, assistantMsg])
      const doc = await finalizeDocument(rawDoc)
      if (doc) setDraftDoc(doc)
      if (phone) saveClientPhone(phone).catch((err) => console.error('Failed to save client phone:', err))
      if (recipientPhone) saveRecipientPhone(recipientPhone).catch((err) => console.error('Failed to save recipient phone:', err))
      if (clientEmail) saveClientEmail(clientEmail).catch((err) => console.error('Failed to save client email:', err))
      // Awaited (not fire-and-forget) specifically so a failed document save can be surfaced
      // before the user reaches the payment button — otherwise they'd pay against a document
      // that only ever existed in this tab's memory and vanishes on refresh (see saveTurn).
      const saved = await saveTurn(msgToPersist, assistantMsg, doc).catch((err) => {
        console.error('Failed to save conversation turn:', err)
        return false
      })
      if (doc) {
        setDocSaveFailed(!saved)
        if (!saved) {
          setError("We couldn't save your document. Please try again before paying — your progress may not persist on refresh otherwise.")
        }
      }
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

  const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const MAX_FILE_BYTES = 10 * 1024 * 1024

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    const valid: File[] = []
    const skipped: string[] = []
    for (const f of files) {
      if (!ALLOWED_FILE_TYPES.includes(f.type)) skipped.push(`${f.name} (unsupported type)`)
      else if (f.size > MAX_FILE_BYTES) skipped.push(`${f.name} (over 10 MB)`)
      else valid.push(f)
    }
    setError(skipped.length > 0 ? `Skipped ${skipped.length === files.length ? 'all files' : skipped.length + ' file(s)'}: ${skipped.join(', ')}` : '')
    if (valid.length === 0) return

    // The rest of the selection waits here — processFile picks up the next one only once the
    // current file's extraction has been reviewed (confirmed or discarded), never in parallel.
    setBatchTotal(valid.length)
    setBatchIndex(1)
    pendingBatchRef.current = valid.slice(1)
    await processFile(valid[0])
  }

  // One file through the existing single-file pipeline: attach bubble -> /api/extract ->
  // hold for human review in ExtractionConfirmModal. Unchanged in substance from the
  // original single-upload handleFileSelect — just reusable per queued file now.
  async function processFile(file: File) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const attachMsg: Message = { role: 'user', content: `Attached: ${file.name}` }
    setMessages((prev) => [...prev, attachMsg])
    setExtracting(true)

    try {
      // Ensures a case row exists before the file ever reaches the server, so /api/extract has
      // somewhere real to attach the evidence to — see case_evidence in supabase-schema.sql.
      // Without this, a client whose very first action is uploading a screenshot would have no
      // case yet, and that evidence would have nothing to attach to and be lost outright.
      const caseInfo = await ensureCase()
      const res = await authedFetch('/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, mediaType: file.type, filename: file.name, caseId: caseInfo?.id }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(`${file.name}: ${data.error || 'Could not read the document. Please try again.'}`)
        advanceBatch()
        return
      }

      // Hold here — nothing gets sent to the agent until the user reviews and confirms in
      // ExtractionConfirmModal. An AI read of a scanned document is a read, not a fact,
      // until a human has looked at it once. True for every file in a batch, not just a
      // single upload — the queue slows down for this on purpose.
      pendingAttachMsgRef.current = attachMsg
      setPendingExtraction({
        filename: file.name,
        mediaType: file.type,
        fileDataUrl: `data:${file.type};base64,${base64}`,
        originalFacts: data.facts,
      })
    } catch (err) {
      console.error('Document extraction failed:', err)
      setError(`Network error while analysing ${file.name}.`)
      advanceBatch()
    } finally {
      setExtracting(false)
    }
  }

  // Moves to the next file waiting in the batch, if any; otherwise closes out the batch
  // indicator. Called once the current file has actually been dealt with — confirmed, sent,
  // discarded, or failed to extract — never before.
  function advanceBatch() {
    const next = pendingBatchRef.current.shift()
    if (next) {
      setBatchIndex((i) => i + 1)
      processFile(next)
    } else {
      setBatchTotal(0)
      setBatchIndex(0)
    }
  }

  async function confirmExtraction(editedFacts: string) {
    const attachMsg = pendingAttachMsgRef.current
    const filename = pendingExtraction?.filename ?? 'the uploaded document'
    setPendingExtraction(null)
    pendingAttachMsgRef.current = null
    if (attachMsg) {
      const factsMsg: Message = {
        role: 'user',
        content: `DOCUMENT CONTEXT: Facts extracted from ${filename} (reviewed and confirmed by the client):\n${editedFacts}\n\nPlease confirm what you found and continue with only the questions I haven't answered yet.`,
      }
      await sendToAgent([...messages, attachMsg, factsMsg], factsMsg)
    }
    advanceBatch()
  }

  // Discarding removes the "Attached: <file>" bubble too — nothing was actually contributed
  // to the case, so the chat shouldn't show a dangling attachment that never went anywhere.
  function cancelExtraction() {
    const attachMsg = pendingAttachMsgRef.current
    setPendingExtraction(null)
    pendingAttachMsgRef.current = null
    if (attachMsg) setMessages((prev) => prev.filter((m) => m !== attachMsg))
    advanceBatch()
  }

  // TranslationPane's "Replace Original with Translation" — deliberately re-runs the exact
  // same save-then-gate pattern saveTurn uses (see docSaveFailed above) rather than just
  // calling setDraftDoc and trusting it. Without this, a translated document could show
  // correctly in the preview while never having actually persisted, letting payment proceed
  // against content the database never saw — precisely the bug class fixed earlier for the
  // normal document-drafting path.
  async function replaceDraftWithTranslation(translatedBody: string) {
    if (!draftDoc) return
    const newDoc = { ...draftDoc, body: translatedBody }
    setDraftDoc(newDoc)
    const caseInfo = await ensureCase()
    if (!caseInfo) {
      setDocSaveFailed(true)
      setError("We couldn't save the translated document. Please try again before paying.")
      return
    }
    const { error: docErr } = await supabase.from('cases').update({ document_body: translatedBody }).eq('id', caseInfo.id)
    setDocSaveFailed(Boolean(docErr))
    if (docErr) {
      console.error('Failed to save translated document:', docErr)
      setError("We couldn't save the translated document. Please try again before paying — your progress may not persist on refresh otherwise.")
    }
  }

  function handleClear() {
    setMessages([{ role: 'assistant', content: lawyerIntake ? LAWYER_INTAKE_STARTER_MESSAGE : agent.starterMessage }])
    setError('')
    setDraftDoc(null)
    setDocSaveFailed(false)
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
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={styles.disclaimer}>
          This agent uses AI to draft your document from your answers; a licensed Pandas LP lawyer reviews it before it's sent to you. It prepares legal documents, not legal advice.
        </div>

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
                  {paid ? <span className="badge">Paid: Sent For Review</span> : <span className="badge badge-test">Preview</span>}
                </div>

                {draftDoc.priceLabel && !paid && !invoicedByFirm && (
                  <div className={styles.documentTitle} style={{ marginTop: -8, marginBottom: 8, opacity: 0.8 }}>
                    Selected option: {draftDoc.priceLabel}
                  </div>
                )}

                {/* The transfer-of-title path. Nothing is collected here: the client reads the
                    draft, tells us it is right, and the team takes it from there and invoices
                    the fee. Says so plainly so nobody is left waiting for a payment screen
                    that is never going to appear. */}
                {invoicedByFirm && (
                  <div
                    className={styles.documentTitle}
                    style={{
                      marginTop: -4,
                      marginBottom: 12,
                      padding: '12px 14px',
                      borderLeft: '2px solid var(--accent)',
                      background: 'var(--bg-0)',
                      borderRadius: 8,
                      fontWeight: 400,
                      lineHeight: 1.6,
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: 4 }}>
                      There is nothing to pay here.
                    </strong>
                    {draftDoc.priceLabel || 'Pandas LP will invoice you for this matter directly.'}{' '}
                    Read the draft above carefully and check every name, address, figure and date
                    against your own documents. Tell us what needs changing, or confirm it is
                    correct, and a member of the firm will take it from there.
                  </div>
                )}

                {/* Lawyer intake: staff aren't the paying party for an offline case, so there
                    is no Paystack button to show them here at all — payment is confirmed and
                    recorded separately, from the Cases tab's "Mark Paid (Offline)" action,
                    once the client has actually paid. */}
                {lawyerIntake && !invoicedByFirm && (
                  <div
                    className={styles.documentTitle}
                    style={{
                      marginTop: -4,
                      marginBottom: 12,
                      padding: '12px 14px',
                      borderLeft: '2px solid var(--accent)',
                      background: 'var(--bg-0)',
                      borderRadius: 8,
                      fontWeight: 400,
                      lineHeight: 1.6,
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: 4 }}>Nothing to pay here.</strong>
                    Review the draft with the checklist above in mind, then save the case. Once the client's
                    payment is confirmed, mark it paid from the Cases tab to send this for review.
                  </div>
                )}

                {previewUrl && <iframe title="Document preview" src={previewUrl} className={styles.docFrame} />}

                <AudioReader text={draftDoc.body} label="Listen to this document" />

                {/* Translation is only offered pre-payment, on the client's own draft — once
                    paid, the document is locked in for the mandatory lawyer-review gate
                    (see app/api/update-case-status/route.ts), and silently swapping its text
                    post-payment would bypass that review entirely. */}
                {!paid && <TranslationPane originalText={draftDoc.body} onReplace={replaceDraftWithTranslation} />}

                {paid && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '10px 0 0' }}>
                    Thank you. Please confirm the facts above are correct. Your letter has been sent to our legal
                    team for review, and you'll receive your reviewed copy by email once that's done. There's no
                    download here, since nothing is final until a licensed reviewer has checked it.
                  </p>
                )}

                {docSaveFailed && !paid && (
                  <p role="alert" className={styles.bubbleError} style={{ marginTop: 10 }}>
                    This document hasn't saved yet — send your last message again before paying.
                  </p>
                )}

                <div className={styles.documentActions}>
                  {invoicedByFirm || lawyerIntake ? (
                    <button type="button" className="btn btn-primary" onClick={() => onApproved(agent.id)}>
                      {continueLabel}
                    </button>
                  ) : !paid ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={docSaveFailed}
                      title={docSaveFailed ? "This document hasn't saved yet — retry before paying." : undefined}
                      onClick={() => {
                        trackEvent('payment_started', { agent_id: agent.id, amount: effectiveAmount })
                        setPayOpen(true)
                      }}
                    >
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
                  One more thing: what number should our team call you on?
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
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 12, color: 'var(--secondary)', borderTop: '1px solid var(--border)' }}>
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                We have a callback number on file for you.
              </p>
            )}

            {!paid && (
              <div className={styles.inputRow}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  className={styles.uploadBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || extracting || pendingExtraction !== null}
                  title="Attach one or more documents or screenshots"
                  aria-label="Attach files"
                >
                  <Paperclip size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
                <VoiceRecorder
                  disabled={loading || extracting}
                  onInsert={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
                />
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
      {pendingExtraction && (
        <ExtractionConfirmModal
          extraction={pendingExtraction}
          batchIndex={batchTotal > 1 ? batchIndex : undefined}
          batchTotal={batchTotal > 1 ? batchTotal : undefined}
          onConfirm={confirmExtraction}
          onCancel={cancelExtraction}
        />
      )}
    </div>
  )
}
