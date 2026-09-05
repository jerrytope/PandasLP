/* ─────────────────────────────────────────────────────────────────────────
   Property law pricing.

   The Property Law Agent used to charge one flat fee for all nine document
   types. It no longer does: there are now four distinct pricing models, and
   they behave differently enough that a single number cannot express them.

     TENANCY      a flat fee, charged in app at approval
     TRANSFER     no drafting fee, 2.5% of the consideration
     FLAT         gift and mortgage, each its own flat fee
     SEARCH_STD   a flat fee, but it buys the firm's time, not a document
     SEARCH_COMP  a floor, not a price; a lawyer quotes the real one

   This module is the ONE place these live. The agent's system prompt
   interpolates from here, the marketing pages read from here, and the
   payment amount for a tenancy document comes from here, so a price cannot
   be changed in one surface and left stale in another. That was the actual
   bug in the previous model: ₦5,000 was written out by hand in eight files.

   Anything NOT listed here has no agreed price yet. Do not add an entry to
   this file to make a flow "work" — an unpriced service must escalate to a
   human rather than be given an invented number.
   ───────────────────────────────────────────────────────────────────────── */

export const PROPERTY_PRICING = {
  /* Every document arising out of a tenancy or lease relationship: tenancy
     and lease agreements, Notice to Quit, Notice of Owner's Intention to
     Recover Possession, seven days' notice, and anything else directly
     connected to letting or recovering possession. One category, one fee,
     regardless of which document in it the client needs. */
  tenancy: 25_000,

  /* Deeds and instruments that transfer title. Pandas LP charges no separate
     drafting fee; the fee is a percentage of the transaction consideration.
     Expressed as a fraction so the agent computes it rather than quoting a
     figure it invented. */
  transferFeeRate: 0.025,

  /* A standard property search. NOT a document the agent writes: the client pays this,
     and a member of the firm then goes to the registry and produces the report. The agent
     only takes the instruction. */
  standardSearch: 50_000,

  /* Every property document that is neither a tenancy/lease document nor a transfer of
     title: Deed of Gift, Deed of Legal Mortgage, Power of Attorney, Agreement for Sale
     of Land. One fee, because they are all priced the same.

     None of them belongs on the transfer percentage, and each for its own reason. A gift
     has no consideration, so 2.5% of it is nothing. A mortgage charges the property
     rather than transferring it. The Agreement for Sale is the pre-completion contract,
     not the instrument that transfers title, so taking the percentage there as well as
     on the deed would bill one transaction twice. A Power of Attorney transfers nothing
     at all. */
  flatDocument: 30_000,
} as const

export const TENANCY_FEE_LABEL = '₦25,000'
export const STANDARD_SEARCH_LABEL = '₦50,000'
export const TRANSFER_FEE_LABEL = '2.5% of the consideration'

/* The comprehensive search has a floor, never a fixed price: the real figure
   depends on the location of the property and the scope of investigation, and
   only a lawyer sets it. The agent must quote this as a starting point and
   route the client to a practitioner, never as the price. */
export const COMPREHENSIVE_SEARCH_FLOOR = 100_000
export const COMPREHENSIVE_SEARCH_LABEL = '₦100,000 and above, depending on the location of the property and the scope of the investigation'

/** 2.5% of the consideration, to the naira. */
export function transferFee(consideration: number): number {
  return Math.round(consideration * PROPERTY_PRICING.transferFeeRate)
}
