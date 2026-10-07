// The server's answer to "what does this case cost?". The price a client pays used to come
// straight from the PRICE line the AI wrote into its <<<DOCUMENT>>> block, saved to the case
// by the browser and then trusted by /api/verify-payment. A client could edit that row (or
// talk the AI into a different number) and pay whatever they liked. Now the AI's PRICE can
// only PICK one of the prices listed here — anything else is rejected — and the result is
// written to cases.expected_amount by /api/save-document using the service-role key, which
// the browser can no longer touch (see lock-case-columns.sql).
//
// Pure (no database, no env) so it is unit-tested in lib/__tests__/casePricing.test.ts.

import type { AgentId } from './agents'
import { getAgentPayment } from './agentServiceMap'
import { PROPERTY_PRICING } from './propertyPricing'

export const SMALL_CLAIMS_SELF_SERVE = 10_000
export const SMALL_CLAIMS_PANDAS_SERVES = 25_000
export const JUDGMENT_ENFORCEMENT_BASE_FEE = 10_000
export const JUDGMENT_ENFORCEMENT_RATE = 0.05

export type DeliveryOption = 'self-serve' | 'pandas-serves'

export type CasePrice =
  | { ok: true; amount: number; deliveryOption: DeliveryOption | null }
  | { ok: false; error: string }

/** The fee for enforcing a judgment of `judgmentAmount` naira: base fee + 5%, whole naira. */
export function judgmentEnforcementFee(judgmentAmount: number): number {
  return JUDGMENT_ENFORCEMENT_BASE_FEE + Math.round(judgmentAmount * JUDGMENT_ENFORCEMENT_RATE)
}

/**
 * Decide what a drafted document costs.
 *
 * @param agentId        the agent that drafted it (from the case row, not the request)
 * @param claimedPrice   the PRICE the AI emitted, or undefined if it emitted none
 * @param judgmentAmount cases.judgment_amount, for judgment enforcement only
 */
export function resolveCasePrice(
  agentId: AgentId,
  claimedPrice: number | undefined,
  judgmentAmount: number | null,
): CasePrice {
  if (claimedPrice !== undefined && (!Number.isInteger(claimedPrice) || claimedPrice < 0)) {
    return { ok: false, error: 'The quoted price is not a valid amount.' }
  }

  // Must be one of a fixed list. No PRICE line falls back to the agent's standard fee —
  // the same fallback AgentChat has always shown the client (draftDoc.price ?? amount).
  const pickFrom = (allowed: number[], fallback: number): number | null => {
    if (claimedPrice === undefined) return fallback
    return allowed.includes(claimedPrice) ? claimedPrice : null
  }
  const notListed = { ok: false as const, error: 'The quoted price does not match any listed fee for this service.' }

  switch (agentId) {
    case 'small-claims': {
      const amount = pickFrom([SMALL_CLAIMS_SELF_SERVE, SMALL_CLAIMS_PANDAS_SERVES], SMALL_CLAIMS_SELF_SERVE)
      if (amount === null) return notListed
      return { ok: true, amount, deliveryOption: amount === SMALL_CLAIMS_PANDAS_SERVES ? 'pandas-serves' : 'self-serve' }
    }

    case 'recovery-of-premises': {
      // 0 = a transfer of title, invoiced by the firm rather than paid online (see AgentChat's invoicedByFirm).
      const allowed = [PROPERTY_PRICING.tenancy, PROPERTY_PRICING.standardSearch, PROPERTY_PRICING.flatDocument, 0]
      const amount = pickFrom(allowed, getAgentPayment(agentId).amount)
      if (amount === null) return notListed
      return { ok: true, amount, deliveryOption: null }
    }

    case 'judgment-enforcement': {
      // Computed here from the judgment amount on the case rather than from the AI's arithmetic.
      if (judgmentAmount !== null && judgmentAmount >= 0) {
        return { ok: true, amount: judgmentEnforcementFee(judgmentAmount), deliveryOption: null }
      }
      // No judgment amount on record (the case didn't start from the dashboard's "Enforce
      // Judgment" intake), so the 5% can't be checked here. Accept the AI's figure only if it
      // is at least the base fee; staff see the judgment itself before anything is filed.
      if (claimedPrice === undefined) return { ok: true, amount: JUDGMENT_ENFORCEMENT_BASE_FEE, deliveryOption: null }
      if (claimedPrice < JUDGMENT_ENFORCEMENT_BASE_FEE) return notListed
      return { ok: true, amount: claimedPrice, deliveryOption: null }
    }

    // Flat fees. Their templates carry no PRICE line, so whatever the AI wrote is ignored.
    case 'contracts':
    case 'cac-registration':
    case 'lawyer-consultation':
      return { ok: true, amount: getAgentPayment(agentId).amount, deliveryOption: null }

    default: {
      // Makes TypeScript flag this switch if a new AgentId is added without a pricing rule.
      const unhandled: never = agentId
      return { ok: false, error: `No pricing rule for agent ${String(unhandled)}.` }
    }
  }
}
