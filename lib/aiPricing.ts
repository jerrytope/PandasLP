// What each Claude call costs, from its usage block. Anthropic first-party API list prices in
// US dollars per million tokens. Cache pricing follows Anthropic's multipliers on the model's
// input price: reads 0.1x, 5-minute writes 1.25x, 1-hour writes 2x.
//
// Update this table when the model or Anthropic's prices change; the finance dashboard reports
// AI cost from it, so a stale row understates or overstates spend.

export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-opus-5': { input: 5, output: 25 },
}

export const CACHE_READ_MULTIPLIER = 0.1
export const CACHE_WRITE_5M_MULTIPLIER = 1.25
export const CACHE_WRITE_1H_MULTIPLIER = 2

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWrite5mTokens: number
  cacheWrite1hTokens: number
}

/** Normalises the API's usage object. `assume1h` covers responses without the per-TTL breakdown. */
export function normaliseUsage(
  usage: {
    input_tokens?: number
    output_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
    cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number }
  } | null | undefined,
  assume1h = false,
): TokenUsage {
  const created = usage?.cache_creation_input_tokens ?? 0
  const breakdown = usage?.cache_creation
  const w1h = breakdown ? breakdown.ephemeral_1h_input_tokens ?? 0 : assume1h ? created : 0
  const w5m = breakdown ? breakdown.ephemeral_5m_input_tokens ?? 0 : created - w1h
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWrite5mTokens: w5m,
    cacheWrite1hTokens: w1h,
  }
}

/** Cost in USD. Unknown models are priced as Sonnet 4.6 rather than as free. */
export function costUsd(model: string, u: TokenUsage): number {
  const p = MODEL_PRICES_USD_PER_MTOK[model] ?? MODEL_PRICES_USD_PER_MTOK['claude-sonnet-4-6']
  const perToken = p.input / 1_000_000
  const cost =
    u.inputTokens * perToken +
    u.cacheReadTokens * perToken * CACHE_READ_MULTIPLIER +
    u.cacheWrite5mTokens * perToken * CACHE_WRITE_5M_MULTIPLIER +
    u.cacheWrite1hTokens * perToken * CACHE_WRITE_1H_MULTIPLIER +
    u.outputTokens * (p.output / 1_000_000)
  return Math.round(cost * 1_000_000) / 1_000_000
}

/** What the same call would have cost with no caching: every prompt token at full price. */
export function uncachedCostUsd(model: string, u: TokenUsage): number {
  return costUsd(model, {
    inputTokens: u.inputTokens + u.cacheReadTokens + u.cacheWrite5mTokens + u.cacheWrite1hTokens,
    outputTokens: u.outputTokens,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
  })
}
