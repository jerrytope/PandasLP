// emit_document: the only way the rebuilt Property Law Agent produces a document. The model
// supplies the type, title and body; the server checks them and sets the price from
// lib/propertyPricing.ts. The result is the same <<<DOCUMENT>>> text every agent already
// produces, so AgentChat, /api/save-document, the PDF and payments work unchanged.

import type { AgentTool } from '../../agentRuntime/types'
import { documentAreas, getFee, isPropertyDocumentKey, PROPERTY_DOCUMENTS, type PropertyFee } from '../../propertyPricing'
import type { EmittedDocument, PropertyToolContext } from './context'
import { naira, requireString } from './context'

/** [LANDLORD_NAME]-style blanks and {{TOKENS}} left in the body. {{REF_NUMBER}} is filled in by AgentChat. */
const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9_ /'’,()-]*\]|\{\{(?!REF_NUMBER\}\})[^}]*\}\}/g

export function findPlaceholders(body: string): string[] {
  return [...new Set(body.match(PLACEHOLDER_RE) ?? [])]
}

/** Renders the block lib/agentChatParsing.ts's DOCUMENT_BLOCK_RE parses. */
export function renderDocumentBlock(doc: { title: string; price: number; priceLabel: string; body: string }): string {
  return `<<<DOCUMENT>>>\nTITLE: ${doc.title}\nPRICE: ${doc.price}\nPRICE_LABEL: ${doc.priceLabel}\n---\n${doc.body}\n<<<END_DOCUMENT>>>`
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** The PRICE and PRICE_LABEL for a document. 0 = nothing collected online (AgentChat's invoicedByFirm). */
async function priceFor(fee: PropertyFee, type: string, ctx: PropertyToolContext): Promise<{ price: number; priceLabel: string }> {
  if (fee.kind === 'flat') return { price: fee.amount, priceLabel: fee.label }
  if (fee.kind === 'lawyer-confirms') return { price: 0, priceLabel: fee.label }

  const accepted = (await ctx.store.events(ctx.caseId, 'fee_accepted')).filter((e) => e.payload.documentType === type)
  const latest = accepted[accepted.length - 1]
  if (!latest || typeof latest.payload.consideration !== 'number' || typeof latest.payload.fee !== 'number') {
    throw new RangeError('The client has not accepted the 2.5% fee for this deed yet. Explain the fee, get their explicit acceptance, call record_fee_acceptance, then emit the deed.')
  }
  const percent = fee.rate * 100
  return {
    price: 0,
    priceLabel: `Pandas LP will invoice you ${percent}% of the ${naira(latest.payload.consideration)} consideration (${naira(latest.payload.fee)}). There is no separate drafting fee, and nothing is paid through this website.`,
  }
}

export const emitDocument: AgentTool<PropertyToolContext> = {
  definition: {
    name: 'emit_document',
    description: 'Presents a finished document to the client. The server sets the price; do not write one. The body must be complete: no [PLACEHOLDER] blanks. Use {{REF_NUMBER}} where the file reference goes. To change a document, emit the whole corrected document again.',
    input_schema: {
      type: 'object',
      properties: {
        documentType: { type: 'string', enum: Object.keys(PROPERTY_DOCUMENTS) },
        title: { type: 'string', description: 'The document title, on one line.' },
        body: { type: 'string', description: 'The complete document text. Key figures, dates and notice periods in **double asterisks**.' },
      },
      required: ['documentType', 'title', 'body'],
    },
  },
  handler: async (input, ctx) => {
    const type = requireString(input, 'documentType', 60)
    if (!isPropertyDocumentKey(type)) throw new RangeError(`Unknown documentType. Use one of: ${Object.keys(PROPERTY_DOCUMENTS).join(', ')}.`)
    const spec = PROPERTY_DOCUMENTS[type]
    const areas = documentAreas(type)
    if (!ctx.area || !areas.includes(ctx.area)) {
      throw new RangeError(`A ${spec.title} belongs to the ${areas.join(' or ')} area, not ${ctx.area ?? 'an unrouted matter'}. Hand the matter off instead of drafting it here.`)
    }

    const title = oneLine(requireString(input, 'title', 200))
    const body = requireString(input, 'body', 60_000)
    if (/<<<|>>>/.test(body) || /<<<|>>>/.test(title)) throw new RangeError('The title and body must not contain <<< or >>>.')
    const blanks = findPlaceholders(body)
    if (blanks.length) {
      throw new RangeError(`The document still has blanks: ${blanks.join(', ')}. Ask the client for these, or remove them, then emit it again.`)
    }

    const { price, priceLabel } = await priceFor(getFee(type)!, type, ctx)
    const doc: EmittedDocument = { type, title, price, priceLabel, block: renderDocumentBlock({ title, price, priceLabel, body }) }

    // One document per turn is what AgentChat shows; a re-emit in the same turn replaces it.
    ctx.emitted.splice(0, ctx.emitted.length, doc)
    await ctx.store.logEvent(ctx.caseId, 'document_emitted', { documentType: type, title, price })
    return { ok: true, result: { shownToClient: true, price, priceLabel } }
  },
}
