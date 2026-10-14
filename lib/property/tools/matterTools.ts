// The tools that read or change the saved matter: get_fee, record_facts, record_fee_acceptance,
// handoff_to and escalate_to_lawyer.

import type { AgentTool } from '../../agentRuntime/types'
import { getFee, isPropertyDocumentKey, PROPERTY_DOCUMENTS, transferFee } from '../../propertyPricing'
import { isPropertyArea, PROPERTY_AREAS } from '../types'
import type { PropertyToolContext } from './context'
import { naira, requireNumber, requireObject, requireString } from './context'

type Tool = AgentTool<PropertyToolContext>

const DOCUMENT_TYPES = Object.keys(PROPERTY_DOCUMENTS)
const MAX_FACTS_JSON = 10_000

function checkFacts(facts: Record<string, unknown>): Record<string, unknown> {
  if (JSON.stringify(facts).length > MAX_FACTS_JSON) throw new RangeError('Those facts are too long to save at once; save them in smaller groups.')
  return facts
}

export const getFeeTool: Tool = {
  definition: {
    name: 'get_fee',
    description: 'The fee for a document. The only source of a price: never state a fee this tool did not return.',
    input_schema: {
      type: 'object',
      properties: { documentType: { type: 'string', enum: DOCUMENT_TYPES } },
      required: ['documentType'],
    },
  },
  handler: (input) => {
    const fee = getFee(requireString(input, 'documentType', 60))
    if (!fee) throw new RangeError(`Unknown documentType. Use one of: ${DOCUMENT_TYPES.join(', ')}.`)
    return { ok: true, result: fee }
  },
}

export const recordFacts: Tool = {
  definition: {
    name: 'record_facts',
    description: "Saves facts the client has told you to the matter's record (names, addresses, amounts, dates, documents held), so nobody asks for them again after a hand-off. Use short camelCase keys. A key saved again replaces the old value.",
    input_schema: {
      type: 'object',
      properties: { facts: { type: 'object', description: 'e.g. {"landlordName": "...", "rent": 1200000, "rentFrequency": "yearly"}' } },
      required: ['facts'],
    },
  },
  handler: async (input, ctx) => {
    const all = await ctx.store.mergeFacts(ctx.caseId, checkFacts(requireObject(input, 'facts')))
    return { ok: true, result: { saved: true, factCount: Object.keys(all).length } }
  },
}

export const recordFeeAcceptance: Tool = {
  definition: {
    name: 'record_fee_acceptance',
    description: "Records that the client has explicitly accepted the 2.5% fee for a deed that transfers title. Call it only after they have said yes to the figure. emit_document refuses a transfer deed without it. Returns the fee in naira.",
    input_schema: {
      type: 'object',
      properties: {
        documentType: { type: 'string', enum: DOCUMENT_TYPES.filter((t) => isPropertyDocumentKey(t) && 'transfersTitle' in PROPERTY_DOCUMENTS[t]) },
        consideration: { type: 'number', description: 'The price (consideration) for the property, in naira.' },
      },
      required: ['documentType', 'consideration'],
    },
  },
  handler: async (input, ctx) => {
    const documentType = requireString(input, 'documentType', 60)
    if (!isPropertyDocumentKey(documentType) || !('transfersTitle' in PROPERTY_DOCUMENTS[documentType])) {
      throw new RangeError('Only a deed that transfers title has a percentage fee to accept.')
    }
    const consideration = requireNumber(input, 'consideration')
    if (consideration <= 0) throw new RangeError('consideration must be more than 0.')
    const fee = transferFee(consideration)
    await ctx.store.logEvent(ctx.caseId, 'fee_accepted', { documentType, consideration, fee })
    return { ok: true, result: { recorded: true, fee, feeLabel: naira(fee) } }
  },
}

export const handoffTo: Tool = {
  definition: {
    name: 'handoff_to',
    description: "Passes the matter to another area when the client's need belongs there. Save everything you have learned in `facts` first: the next area must not ask again. Ends your turn.",
    input_schema: {
      type: 'object',
      properties: {
        area: { type: 'string', enum: [...PROPERTY_AREAS] },
        reason: { type: 'string', description: 'One sentence: why the matter belongs there.' },
        facts: { type: 'object', description: 'Facts to carry over that are not saved yet.' },
      },
      required: ['area', 'reason'],
    },
  },
  handler: async (input, ctx) => {
    const area = requireString(input, 'area', 40)
    if (!isPropertyArea(area)) throw new RangeError(`area must be one of: ${PROPERTY_AREAS.join(', ')}.`)
    if (area === ctx.area) throw new RangeError('The matter is already in that area.')
    if (ctx.enabledAreas && !ctx.enabledAreas.includes(area)) {
      throw new RangeError(`The ${area} area is not available yet. Use escalate_to_lawyer instead.`)
    }
    if (ctx.allowedHandoffs && !ctx.allowedHandoffs.includes(area)) {
      throw new RangeError(`This area may only hand off to: ${ctx.allowedHandoffs.join(', ') || 'none'}. If the matter needs something else, use escalate_to_lawyer.`)
    }
    const reason = requireString(input, 'reason', 500)
    const facts = input.facts === undefined ? {} : checkFacts(requireObject(input, 'facts'))
    if (Object.keys(facts).length) await ctx.store.mergeFacts(ctx.caseId, facts)
    await ctx.store.setArea(ctx.caseId, area)
    await ctx.store.logEvent(ctx.caseId, 'handoff', { from: ctx.area, to: area, reason, facts })
    const from = ctx.area
    ctx.area = area
    return { ok: true, result: { handedOff: true, to: area }, stop: { kind: 'handoff', data: { from, to: area, reason } } }
  },
}

export const escalateToLawyer: Tool = {
  definition: {
    name: 'escalate_to_lawyer',
    description: 'Stops drafting and passes the matter to a Pandas LP lawyer: for anything outside what you may handle, any legal risk you cannot resolve from your rules, or a client who asks for something unlawful. Tell the client a lawyer will contact them. Ends your turn.',
    input_schema: {
      type: 'object',
      properties: { reason: { type: 'string', description: 'Why a lawyer is needed, for the lawyer reading it.' } },
      required: ['reason'],
    },
  },
  handler: async (input, ctx) => {
    const reason = requireString(input, 'reason', 1000)
    await ctx.store.setStatus(ctx.caseId, 'escalated')
    await ctx.store.logEvent(ctx.caseId, 'escalated', { area: ctx.area, reason })
    return { ok: true, result: { escalated: true }, stop: { kind: 'escalate', data: { reason } } }
  },
}
