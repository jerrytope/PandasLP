// One chat turn of the rebuilt Property Law Agent: load the matter, route it if it has no area
// yet, ask for the state if it has none, then run the area's sub-agent with the shared tools.
// Returns { response } in the same text format /api/chat has always returned, so AgentChat
// (OPTIONS buttons, the <<<DOCUMENT>>> block) needs no changes.
//
// System prompt order, for caching (see lib/claude.ts):
//   tools (the same list for every area) → shared block (1h) → area block (1h)
//   → jurisdiction block → matter record + today's date.
// The first two cached blocks are identical across clients; the jurisdiction and matter record
// change per matter, so they come after them.

import { runAgent } from '../agentRuntime/runAgent'
import type { ModelCaller } from '../agentRuntime/types'
import type { ClaudeMessage, SystemBlock } from '../claude'
import { buildCurrentDateContext } from '../currentDateContext'
import { AREAS, ENABLED_AREAS, areaBlock } from './areas'
import { groupOf, jurisdictionBlock, findStateInText, normaliseLagosArea, normaliseState, type SupportedState } from './jurisdictions'
import type { MatterRepository } from './matterStore'
import { routeFreeText } from './router'
import { SHARED_PROPERTY_BLOCK } from './shared'
import {
  ANOTHER_STATE,
  AREA_NOT_LIVE_REPLY,
  DESCRIBE_PROMPT,
  ESCALATED_REPLY,
  UNSUPPORTED_STATE_REPLY,
  areaFromButton,
  lagosAreaQuestion,
  stateNotUnderstood,
  stateQuestion,
} from './starter'
import { SHARED_PROPERTY_TOOLS, type PropertyToolContext } from './tools'
import type { PropertyArea, PropertyMatter } from './types'

export const AREA_MAX_STEPS = 8
export const AREA_MAX_TOKENS = 8192

export interface OrchestratorInput {
  caseId: string
  /** The conversation as AgentChat sends it (it starts with the starter message). */
  messages: { role: 'user' | 'assistant'; content: string }[]
  now: Date
  repo: MatterRepository
  call?: ModelCaller
}

export type OrchestratorResult =
  | { ok: true; response: string }
  | { ok: false; status: number; error: string }

/** The API needs a user message first; the starter menu adds nothing the prompts don't already say. */
function conversation(messages: OrchestratorInput['messages']): ClaudeMessage[] {
  const first = messages.findIndex((m) => m.role === 'user')
  return first < 0 ? [] : messages.slice(first).map((m) => ({ role: m.role, content: m.content }))
}

function matterRecord(matter: PropertyMatter): string {
  const facts = Object.keys(matter.facts).length ? JSON.stringify(matter.facts, null, 2) : '(nothing saved yet)'
  return `MATTER RECORD (facts already saved for this matter; never ask for these again):\n${facts}`
}

export function buildAreaSystem(matter: PropertyMatter, now: Date, handoff?: { from: PropertyArea | null; reason: string }): SystemBlock[] {
  const config = AREAS[matter.area!]
  const state = normaliseState(matter.state!) as SupportedState
  const group = groupOf(state)!
  const volatile = [matterRecord(matter), buildCurrentDateContext(now)]
  if (handoff) {
    volatile.push(`HAND-OFF: this matter has just been passed to you${handoff.from ? ` from ${AREAS[handoff.from].title}` : ''} because: ${handoff.reason}. Open with one short line telling the client this is now a ${config.title} matter and that you have what they told you, then carry on. Do not ask again for anything in the MATTER RECORD or the conversation.`)
  }
  return [
    { text: SHARED_PROPERTY_BLOCK, cache: '1h' },
    { text: areaBlock(config), cache: '1h' },
    { text: `${jurisdictionBlock(state, matter.lagosArea)}\n\n${config.jurisdictionRules[group]}` },
    { text: volatile.join('\n\n') },
  ]
}

async function escalate(input: OrchestratorInput, reason: string, reply: string, area: PropertyArea | null): Promise<OrchestratorResult> {
  await input.repo.setStatus(input.caseId, 'escalated')
  await input.repo.logEvent(input.caseId, 'escalated', { area, reason })
  return { ok: true, response: reply }
}

function join(...parts: (string | null | undefined)[]): string {
  return parts.filter((p) => p && p.trim()).join('\n\n')
}

async function runArea(input: OrchestratorInput, matter: PropertyMatter, convo: ClaudeMessage[], handoff?: { from: PropertyArea | null; reason: string }): Promise<OrchestratorResult> {
  const area = matter.area!
  const config = AREAS[area]
  const ctx: PropertyToolContext = {
    caseId: input.caseId,
    area,
    store: input.repo,
    emitted: [],
    allowedHandoffs: config.handoffs.map((h) => h.to),
    enabledAreas: ENABLED_AREAS,
  }
  const result = await runAgent({
    route: `chat.property.${area}`,
    system: buildAreaSystem(matter, input.now, handoff),
    tools: SHARED_PROPERTY_TOOLS,
    messages: convo,
    ctx,
    maxSteps: AREA_MAX_STEPS,
    maxTokens: AREA_MAX_TOKENS,
    caseId: input.caseId,
    cacheConversation: true,
    call: input.call,
  })
  if (result.ok === false) {
    if (result.kind === 'max_steps') console.error(`Property agent (${area}) hit max steps for case ${input.caseId}`)
    return { ok: false, status: result.notConfigured ? 503 : 502, error: 'The legal agent is temporarily unavailable. Please try again shortly.' }
  }

  // One hand-off per turn: the new area answers straight away, so the client never waits a turn.
  if (result.stop?.kind === 'handoff' && !handoff) {
    const next = await input.repo.getOrCreateMatter(input.caseId)
    const second = await runArea(input, next, convo, { from: area, reason: String(result.stop.data?.reason ?? '') })
    if (second.ok === false) return second
    return { ok: true, response: join(result.text, second.response) }
  }

  if (result.stop?.kind === 'escalate') return { ok: true, response: result.text.trim() || ESCALATED_REPLY }
  return { ok: true, response: join(result.text, ctx.emitted[0]?.block) || 'Could you tell me a little more?' }
}

export async function runPropertyOrchestrator(input: OrchestratorInput): Promise<OrchestratorResult> {
  const { caseId, repo } = input
  const convo = conversation(input.messages)
  const last = convo.length ? String(convo[convo.length - 1].content) : ''
  if (!convo.length || convo[convo.length - 1].role !== 'user') return { ok: false, status: 400, error: 'The last message must be from the client.' }

  let matter = await repo.getOrCreateMatter(caseId)
  if (matter.status === 'escalated') return { ok: true, response: ESCALATED_REPLY }

  // 1. Route: a starter button, or free text through the router.
  if (!matter.area) {
    const pick = areaFromButton(last)
    if (pick === 'something-else') return { ok: true, response: DESCRIBE_PROMPT }

    let area: PropertyArea
    let reason = 'Chosen from the starter menu.'
    let statedState: string | null = null
    if (pick) {
      area = pick
    } else {
      const decision = await routeFreeText({ messages: convo, caseId, call: input.call })
      if (decision.kind === 'error') return { ok: false, status: decision.notConfigured ? 503 : 502, error: 'The legal agent is temporarily unavailable. Please try again shortly.' }
      if (decision.kind === 'ask') return { ok: true, response: `${decision.question}\n<<<OPTIONS>>>\n${decision.options.join('\n')}\n<<<END_OPTIONS>>>` }
      if (decision.kind === 'escalate') return escalate(input, decision.reason, decision.message.trim() || ESCALATED_REPLY, null)
      area = decision.area
      reason = decision.reason
      statedState = decision.state
    }

    if (!AREAS[area].enabled) return escalate(input, `Asked for ${area}, which is not live yet.`, AREA_NOT_LIVE_REPLY, area)
    await repo.setArea(caseId, area)
    await repo.logEvent(caseId, 'routed', { area, via: pick ? 'button' : 'router', reason })
    matter = { ...matter, area, status: 'active' }

    const found = statedState ? findStateInText(statedState) : null
    if (found === 'unsupported') return escalate(input, `Property is in an unsupported state (${statedState}).`, UNSUPPORTED_STATE_REPLY, area)
    if (found) {
      await repo.setState(caseId, found, null)
      matter = { ...matter, state: found }
    }
    if (!matter.state) return { ok: true, response: stateQuestion() }
    if (matter.state === 'Lagos') return { ok: true, response: lagosAreaQuestion() }
    return runArea(input, matter, convo)
  }

  // 2. The state, then (Lagos only) the area within Lagos.
  if (!matter.state) {
    if (last.trim().toLowerCase() === ANOTHER_STATE.toLowerCase()) return escalate(input, 'Property is in a state the firm does not cover.', UNSUPPORTED_STATE_REPLY, matter.area)
    const found = findStateInText(last)
    if (found === 'unsupported') return escalate(input, `Property is in an unsupported state ("${last.slice(0, 80)}").`, UNSUPPORTED_STATE_REPLY, matter.area)
    if (!found) return { ok: true, response: stateNotUnderstood() }
    await repo.setState(caseId, found, null)
    matter = { ...matter, state: found }
    if (found === 'Lagos') return { ok: true, response: lagosAreaQuestion() }
    return runArea(input, matter, convo)
  }

  if (matter.state === 'Lagos' && !matter.lagosArea) {
    const lagosArea = normaliseLagosArea(last)
    if (!lagosArea) return { ok: true, response: lagosAreaQuestion("Sorry, I didn't catch that.") }
    await repo.setState(caseId, 'Lagos', lagosArea)
    matter = { ...matter, lagosArea }
    return runArea(input, matter, convo)
  }

  // 3. The area's sub-agent.
  return runArea(input, matter, convo)
}
