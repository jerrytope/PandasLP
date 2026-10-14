// Sends a new property matter to one of the seven areas. A starter button maps straight to an
// area with no model call (lib/property/starter.ts); this file handles free text and "Something
// else", with a small classifier prompt on a cheaper model. Its tools only report a decision;
// the orchestrator saves it.
// PENDING LAWYER SIGN-OFF (task 2.15): the occupant test and the not-covered list.

import { runAgent } from '../agentRuntime/runAgent'
import type { AgentTool, ModelCaller } from '../agentRuntime/types'
import type { ClaudeMessage } from '../claude'
import { AREAS } from './areas'
import { isPropertyArea, PROPERTY_AREAS, type PropertyArea } from './types'

export const ROUTER_MODEL = 'claude-haiku-4-5'

export type RouterDecision =
  | { kind: 'route'; area: PropertyArea; reason: string; state: string | null }
  | { kind: 'ask'; question: string; options: string[] }
  | { kind: 'escalate'; reason: string; message: string }

const AREA_LIST = PROPERTY_AREAS.map((a) => `- ${a}: ${AREAS[a].title}`).join('\n')

export const ROUTER_PROMPT = `You are the intake desk of Pandas LP's Property Law Agent, a Nigerian law firm. Read what the client has written and decide which area of property work it belongs to. You do not give advice and you do not draft anything. You MUST finish by calling exactly one tool: route_to, ask_clarifying or escalate_to_lawyer.

THE AREAS:
${AREA_LIST}

What each covers:
- recovery: a landlord getting a tenant (or a licensee) out; Notice to Quit; unpaid rent from a tenant; mesne profits.
- tenancy: a tenancy agreement, a lease, or a sublease (a tenant letting on).
- conveyancing: a sale of land or a building for a price: the Deed of Assignment and consent.
- other-instruments: a deed of gift (during the giver's life), a mortgage or charge, a power of attorney, an agreement (contract) for sale of land, a deed of release.
- searches: checking a property's title before buying, lending or paying.
- wills-probate: making a will or codicil; the estate of someone who has died (probate, letters of administration); passing property on death.
- land-dispute: disputed ownership, trespass, a double sale, boundaries, a rival claimant in possession.

THE OCCUPANT TEST (someone is on the client's property and the client wants them off):
- They came in WITH the client's permission (a tenant, a caretaker, a licensee) → recovery. This is so even if they now claim to own it.
- They came in WITHOUT permission but claim the land through a title of their own (bought it, inherited it, were granted it) → land-dispute.
- They came in WITHOUT permission and claim no title (a squatter, "omo onile", land grabbers) → escalate_to_lawyer: not covered here.
- A family member on family land → land-dispute.

NOT COVERED (escalate_to_lawyer):
- squatters and land grabbers with no claim of title
- a client who wants to avoid Governor's Consent, stamping or registration
- anything that is not a property matter at all
- a property outside Nigeria

If the request could belong to two areas, or you cannot tell, call ask_clarifying with ONE short question and two to four answer options. If the client mentions which Nigerian state the property is in, include it in route_to.`

type Ctx = Record<string, never>

const routeTo: AgentTool<Ctx> = {
  definition: {
    name: 'route_to',
    description: 'Send the matter to an area.',
    input_schema: {
      type: 'object',
      properties: {
        area: { type: 'string', enum: [...PROPERTY_AREAS] },
        reason: { type: 'string', description: 'One sentence: why this area.' },
        state: { type: 'string', description: 'The Nigerian state the property is in, only if the client said.' },
      },
      required: ['area', 'reason'],
    },
  },
  handler: (input) => {
    if (!isPropertyArea(input.area)) return { ok: false, error: `area must be one of: ${PROPERTY_AREAS.join(', ')}.` }
    const state = typeof input.state === 'string' && input.state.trim() ? input.state.trim() : null
    return { ok: true, result: { routed: true }, stop: { kind: 'route', data: { area: input.area, reason: String(input.reason ?? ''), state } } }
  },
}

const askClarifying: AgentTool<Ctx> = {
  definition: {
    name: 'ask_clarifying',
    description: 'Ask the client one short question when the area is unclear.',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        options: { type: 'array', items: { type: 'string' }, description: '2 to 4 short answers.' },
      },
      required: ['question', 'options'],
    },
  },
  handler: (input) => {
    const options = Array.isArray(input.options) ? input.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0).map((o) => o.trim().replace(/\n/g, ' ')).slice(0, 4) : []
    if (typeof input.question !== 'string' || !input.question.trim() || options.length < 2) return { ok: false, error: 'Give a question and 2 to 4 options.' }
    return { ok: true, result: { asked: true }, stop: { kind: 'ask', data: { question: input.question.trim(), options } } }
  },
}

const escalate: AgentTool<Ctx> = {
  definition: {
    name: 'escalate_to_lawyer',
    description: 'The matter is not covered here, or is a squatter or land-grabber case: pass it to a lawyer.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'For the lawyer: why.' },
        message: { type: 'string', description: 'For the client: one or two kind sentences saying a Pandas LP lawyer will contact them.' },
      },
      required: ['reason', 'message'],
    },
  },
  handler: (input) => ({
    ok: true,
    result: { escalated: true },
    stop: { kind: 'escalate', data: { reason: String(input.reason ?? ''), message: String(input.message ?? '') } },
  }),
}

export const ROUTER_TOOLS = [routeTo, askClarifying, escalate]

const FALLBACK_QUESTION: RouterDecision = {
  kind: 'ask',
  question: 'Which of these is closest to what you need?',
  options: ['Get a tenant out of my property', 'A tenancy, lease or sublease agreement', 'Buying or selling property (Deed of Assignment)', 'Something else'],
}

/** Classifies a free-text request. Falls back to asking the client when the model doesn't decide. */
export async function routeFreeText(opts: { messages: ClaudeMessage[]; caseId: string; call?: ModelCaller }): Promise<RouterDecision | { kind: 'error'; error: string; notConfigured?: boolean }> {
  const result = await runAgent<Ctx>({
    route: 'chat.property.router',
    system: [{ text: ROUTER_PROMPT }],
    tools: ROUTER_TOOLS,
    messages: opts.messages,
    ctx: {},
    maxSteps: 2,
    maxTokens: 1024,
    model: ROUTER_MODEL,
    caseId: opts.caseId,
    call: opts.call,
  })
  if (result.ok === false) {
    return result.kind === 'model' ? { kind: 'error', error: result.error, notConfigured: result.notConfigured } : FALLBACK_QUESTION
  }
  const stop = result.stop
  if (!stop) return FALLBACK_QUESTION
  const d = stop.data ?? {}
  if (stop.kind === 'route') return { kind: 'route', area: d.area as PropertyArea, reason: String(d.reason ?? ''), state: (d.state as string | null) ?? null }
  if (stop.kind === 'ask') return { kind: 'ask', question: String(d.question), options: d.options as string[] }
  return { kind: 'escalate', reason: String(d.reason ?? ''), message: String(d.message ?? '') }
}
