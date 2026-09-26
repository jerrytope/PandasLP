// The one way this app calls Claude. Every route goes through callClaude so that:
//   - prompt caching is applied the same way everywhere (see CACHING below),
//   - every call's token usage and cost is recorded in public.ai_usage, against its case where
//     there is one, which is what the finance dashboard's "AI cost per matter" reads,
//   - errors come back as a value, not a throw, so each route keeps its own user-facing wording.
//
// CACHING. Caching is a prefix match: the cached part of a prompt must be byte-identical from
// one request to the next. So:
//   - Put stable instructions first, as a system block with `cache`, and anything that changes
//     (today's date, per-request context) in a later block without it.
//   - Use `cacheConversation` for multi-turn chats: the API then caches the whole conversation
//     so each turn re-reads the previous ones at a tenth of the price.
//   - Don't cache one-off calls that run rarely (a negotiation draft a few times a week): the
//     cache expires before it is reused and the write costs 25% more than no cache at all.
// Verify with the dashboard's cache figures (or ai_usage.cache_read_tokens) after any change
// to how a prompt is assembled: a silently broken cache still works, it just costs more.

import { supabaseAdmin } from './supabaseAdmin'
import { costUsd, normaliseUsage, type TokenUsage } from './aiPricing'

export const CLAUDE_MODEL = 'claude-sonnet-4-6'

export type CacheTtl = '5m' | '1h'

export interface SystemBlock {
  text: string
  /** Mark a cache breakpoint at the end of this block. */
  cache?: CacheTtl
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | unknown[]
}

export interface ClaudeCallOptions {
  /** Where the call comes from, for cost reporting, e.g. "chat.small-claims". */
  route: string
  system: string | SystemBlock[]
  messages: ClaudeMessage[]
  maxTokens: number
  model?: string
  /** Automatic caching of the growing conversation (multi-turn chats only). */
  cacheConversation?: boolean
  /** The case this call is for, so its cost counts toward that matter. */
  caseId?: string | null
}

export type ClaudeResult =
  | { ok: true; text: string; stopReason: string | null; usage: TokenUsage; costUsd: number; model: string }
  | { ok: false; status: number; error: string; notConfigured?: boolean }

function cacheControl(ttl: CacheTtl) {
  return ttl === '1h' ? { type: 'ephemeral', ttl: '1h' } : { type: 'ephemeral' }
}

/** The request body. Pure, so the caching layout is unit-tested. */
export function buildClaudeRequest(opts: ClaudeCallOptions) {
  const blocks: SystemBlock[] = typeof opts.system === 'string' ? [{ text: opts.system }] : opts.system
  const system = blocks
    .filter((b) => b.text.trim().length > 0)
    .map((b) => ({ type: 'text', text: b.text, ...(b.cache ? { cache_control: cacheControl(b.cache) } : {}) }))

  return {
    model: opts.model ?? CLAUDE_MODEL,
    max_tokens: opts.maxTokens,
    ...(system.length ? { system } : {}),
    messages: opts.messages,
    // Top-level automatic caching moves its breakpoint to the end of the conversation on every
    // turn. It is 5-minute TTL, which a client typing replies keeps warm; any 1-hour system
    // breakpoint comes earlier in the prompt, as the API requires.
    ...(opts.cacheConversation ? { cache_control: { type: 'ephemeral' } } : {}),
  }
}

function usesOneHourCache(opts: ClaudeCallOptions): boolean {
  return typeof opts.system !== 'string' && opts.system.some((b) => b.cache === '1h')
}

async function recordUsage(entry: {
  route: string
  model: string
  caseId: string | null
  usage: TokenUsage
  costUsd: number
  latencyMs: number
  stopReason: string | null
}) {
  try {
    const { error } = await supabaseAdmin.from('ai_usage').insert({
      route: entry.route,
      model: entry.model,
      case_id: entry.caseId,
      input_tokens: entry.usage.inputTokens,
      output_tokens: entry.usage.outputTokens,
      cache_read_tokens: entry.usage.cacheReadTokens,
      cache_write_5m_tokens: entry.usage.cacheWrite5mTokens,
      cache_write_1h_tokens: entry.usage.cacheWrite1hTokens,
      cost_usd: entry.costUsd,
      latency_ms: entry.latencyMs,
      stop_reason: entry.stopReason,
    })
    if (error) console.error('Failed to record AI usage:', error.message)
  } catch (err) {
    // Cost reporting must never break the feature that made the call.
    console.error('Failed to record AI usage:', err)
  }
}

export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return { ok: false, status: 503, error: 'ANTHROPIC_API_KEY is not configured.', notConfigured: true }
  }

  const body = buildClaudeRequest(opts)
  const started = Date.now()
  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error(`Claude request failed (${opts.route}):`, err)
    return { ok: false, status: 500, error: 'Network error while contacting Claude.' }
  }

  if (!res.ok) {
    const errBody = await res.text()
    console.error(`Anthropic API error (${opts.route}):`, res.status, errBody)
    return { ok: false, status: 502, error: `Anthropic API returned ${res.status}.` }
  }

  const data = await res.json()
  const text: string = Array.isArray(data?.content)
    ? data.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n')
    : ''
  const model: string = data?.model ?? body.model
  const usage = normaliseUsage(data?.usage, usesOneHourCache(opts))
  const cost = costUsd(body.model, usage)
  const stopReason: string | null = data?.stop_reason ?? null

  await recordUsage({
    route: opts.route,
    model: body.model,
    caseId: opts.caseId ?? null,
    usage,
    costUsd: cost,
    latencyMs: Date.now() - started,
    stopReason,
  })

  return { ok: true, text, stopReason, usage, costUsd: cost, model }
}
