// Parses the `<<<DOCUMENT>>>` / `<<<OPTIONS>>>` mini-protocol the chat agents use to hand
// structured data (a drafted document, or a set of quick-reply choices) back to the UI
// inside an otherwise free-text response. Pulled out of AgentChat.tsx so these pure
// string-parsing functions can be unit tested without pulling in React/Supabase/CSS.

export interface DraftDocument {
  title: string
  body: string
  price?: number
  priceLabel?: string
}

const DOCUMENT_BLOCK_RE =
  /<<<DOCUMENT>>>\s*TITLE:\s*(.+?)\s*\n(?:PRICE:\s*(.+?)\s*\n)?(?:PRICE_LABEL:\s*(.+?)\s*\n)?-{3,}\n([\s\S]*?)<<<END_DOCUMENT>>>/

const OPTIONS_BLOCK_RE = /<<<OPTIONS>>>\n([\s\S]*?)<<<END_OPTIONS>>>/

const CLIENT_PHONE_BLOCK_RE = /<<<CLIENT_PHONE>>>\s*([\s\S]*?)\s*<<<END_CLIENT_PHONE>>>/
const CLIENT_EMAIL_BLOCK_RE = /<<<CLIENT_EMAIL>>>\s*([\s\S]*?)\s*<<<END_CLIENT_EMAIL>>>/
const RECIPIENT_PHONE_BLOCK_RE = /<<<RECIPIENT_PHONE>>>\s*([\s\S]*?)\s*<<<END_RECIPIENT_PHONE>>>/

// Some agents (e.g. small-claims, once the ₦25,000 "Pandas LP serves it" option is chosen)
// ask for a callback number so a lawyer can reach the client after payment. The model hands
// it back in this block so it never leaks into the visible chat or the letter itself.
export function extractClientPhone(content: string): { visible: string; phone: string | null } {
  const match = content.match(CLIENT_PHONE_BLOCK_RE)
  if (!match) return { visible: content, phone: null }
  const phone = match[1].trim() || null
  const visible = content.replace(CLIENT_PHONE_BLOCK_RE, '').trim()
  return { visible, phone }
}

// Same idea as CLIENT_PHONE, for the lawyer-intake flow only (see lib/agents.ts's
// SMALL_CLAIMS_LAWYER_INTAKE_PROMPT and app/admin/page.tsx's Custom Claims tab). A case
// created there has no client Supabase account — the case is owned by the staff member
// running the session, not the client — so there is no auth email for sendCaseEmail to
// resolve. This is the only place the real client's email gets captured at all.
export function extractClientEmail(content: string): { visible: string; email: string | null } {
  const match = content.match(CLIENT_EMAIL_BLOCK_RE)
  if (!match) return { visible: content, email: null }
  const email = match[1].trim() || null
  const visible = content.replace(CLIENT_EMAIL_BLOCK_RE, '').trim()
  return { visible, email }
}

// CLIENT_PHONE is a callback number for the CLIENT — the person paying Pandas LP. This is a
// different person's phone entirely: whoever the drafted document is actually served ON (a
// debtor, a tenant). Serving via WhatsApp (see app/admin/page.tsx's "Serve via WhatsApp") must
// send to THIS number, never the client's — sending an e-service notice to your own client
// instead of the debtor it's meant for defeats the point of service entirely.
export function extractRecipientPhone(content: string): { visible: string; phone: string | null } {
  const match = content.match(RECIPIENT_PHONE_BLOCK_RE)
  if (!match) return { visible: content, phone: null }
  const phone = match[1].trim() || null
  const visible = content.replace(RECIPIENT_PHONE_BLOCK_RE, '').trim()
  return { visible, phone }
}

export function extractDocument(content: string): { visible: string; doc: DraftDocument | null } {
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

// The lawyer-intake prompt (SMALL_CLAIMS_LAWYER_INTAKE_PROMPT in lib/agents.ts) lists facts it
// still needs under this heading instead of guessing them. Returns those questions, one per
// bullet, or [] if the section isn't there.
export function extractOutstandingQuestions(content: string): string[] {
  const start = content.search(/OUTSTANDING QUESTIONS FOR YOUR CLIENT/i)
  if (start < 0) return []
  const after = content.slice(start).split('\n').slice(1)
  const questions: string[] = []
  for (const line of after) {
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/)
    if (bullet) questions.push(bullet[1].trim())
    else if (questions.length > 0 && line.trim() === '') break
    else if (questions.length > 0) break
  }
  return questions
}

export function extractOptions(content: string): { visible: string; options: string[] } {
  const match = content.match(OPTIONS_BLOCK_RE)
  if (!match) return { visible: content, options: [] }
  const options = match[1].split('\n').map((s) => s.trim()).filter(Boolean)
  const visible = content.replace(OPTIONS_BLOCK_RE, '').trim()
  return { visible, options }
}

export interface CounterFacts {
  counselName: string | null
  proposedAmount: number | null
  summary: string
}

const COUNTER_EXTRACT_BLOCK_RE =
  /<<<COUNTER_EXTRACT>>>\s*COUNSEL_NAME:\s*(.*?)\s*\nPROPOSED_AMOUNT:\s*(.*?)\s*\nSUMMARY:\s*\n([\s\S]*?)<<<END_COUNTER_EXTRACT>>>/

// Parses the one-shot extraction Claude produces from a scanned counter letter — see
// app/api/admin/negotiations/extract/route.ts. "unknown"/"none" are the model's own honest
// answers when the letter doesn't state a name or a figure, not a parsing failure, so both
// collapse to null rather than being stored as the literal words "unknown"/"none".
export function extractCounterFacts(content: string): CounterFacts | null {
  const match = content.match(COUNTER_EXTRACT_BLOCK_RE)
  if (!match) return null

  const rawName = match[1].trim()
  const counselName = rawName && !/^unknown$/i.test(rawName) ? rawName : null

  const rawAmount = match[2].trim().replace(/[,\s₦]/g, '')
  const parsedAmount = Number(rawAmount)
  const proposedAmount = rawAmount && !/^none$/i.test(rawAmount) && Number.isFinite(parsedAmount) ? parsedAmount : null

  const summary = match[3].trim()

  return { counselName, proposedAmount, summary }
}
