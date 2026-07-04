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

export function extractOptions(content: string): { visible: string; options: string[] } {
  const match = content.match(OPTIONS_BLOCK_RE)
  if (!match) return { visible: content, options: [] }
  const options = match[1].split('\n').map((s) => s.trim()).filter(Boolean)
  const visible = content.replace(OPTIONS_BLOCK_RE, '').trim()
  return { visible, options }
}
