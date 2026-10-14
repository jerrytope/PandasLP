import type { PropertyArea } from './property/types'

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
     connected to letting or recovering possession. Charged PER DOCUMENT:
     every one of these costs the same 25,000 each. "One category" means one
     price per document, NOT one payment covering several. A client who needs
     a tenancy agreement and a Notice to Quit pays 25,000 twice. */
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

  /* A sublease of three years or less, written as an agreement. Part of the tenancy and lease
     category, so the same price as a tenancy agreement. */
  subleaseShort: 25_000,

  /* Deed of Release: one of the "other property instruments", so the flat document fee. */
  deedOfRelease: 30_000,

  /* NOT YET SET BY THE FIRM. null means "a lawyer will confirm the fee": the agent shows no
     price, emits PRICE 0 (nothing collected online) and says a lawyer will confirm it. Replace
     null with a number only once the firm has agreed the fee. */
  subleaseDeed: null,
  will: null,
  codicil: null,
  probate: null,
  disputeBrief: null,
  /* The Governor's (or Minister's) Consent application the firm files for a deed it drafted. */
  consentApplication: null,
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

/* ─────────────────────────────────────────────────────────────────────────
   Every document the rebuilt Property Law Agent can emit, which area may
   emit it, and what it costs. getFee() is the only source of a price for
   that agent: the model never writes one (see lib/property/tools/).
   ───────────────────────────────────────────────────────────────────────── */

export type PropertyFee =
  /** Paid online at approval. */
  | { kind: 'flat'; amount: number; label: string }
  /** 2.5% of the consideration, invoiced by the firm after the client accepts it. */
  | { kind: 'transfer'; amount: null; rate: number; label: string }
  /** No agreed price yet (or a lawyer quotes it): no price shown, a lawyer confirms. */
  | { kind: 'lawyer-confirms'; amount: null; label: string }

type FeeKey = keyof typeof PROPERTY_PRICING | 'comprehensiveSearch'

const FLAT_LABELS: Partial<Record<FeeKey, string>> = {
  tenancy: 'Tenancy and lease documents',
  subleaseShort: 'Tenancy and lease documents',
  standardSearch: 'Standard property search, carried out by the firm',
  flatDocument: 'Property document, drafted and lawyer-reviewed',
  deedOfRelease: 'Property document, drafted and lawyer-reviewed',
}

export const LAWYER_CONFIRMS_FEE_LABEL =
  'A Pandas LP lawyer will confirm the fee for this matter before anything is paid. Nothing is paid through this website.'

export interface PropertyDocumentType {
  title: string
  /** The area, or areas, allowed to emit it. */
  area: PropertyArea | readonly PropertyArea[]
  fee: FeeKey
  /** A deed that transfers title: needs the client's recorded acceptance of the 2.5% fee. */
  transfersTitle?: boolean
}

export const PROPERTY_DOCUMENTS = {
  'notice-to-quit': { title: 'Notice to Quit', area: 'recovery', fee: 'tenancy' },
  'seven-days-notice': { title: "Seven Days' Notice of Owner's Intention to Apply to Recover Possession", area: 'recovery', fee: 'tenancy' },
  'rent-demand-letter': { title: 'Rent Demand Letter', area: 'recovery', fee: 'tenancy' },
  'tenancy-agreement': { title: 'Tenancy Agreement', area: 'tenancy', fee: 'tenancy' },
  'deed-of-lease': { title: 'Deed of Lease', area: 'tenancy', fee: 'tenancy' },
  'sublease-agreement': { title: 'Sublease Agreement', area: 'tenancy', fee: 'subleaseShort' },
  'deed-of-sublease': { title: 'Deed of Sublease', area: 'tenancy', fee: 'subleaseDeed' },
  'deed-of-assignment': { title: 'Deed of Assignment', area: 'conveyancing', fee: 'transferFeeRate', transfersTitle: true },
  'deed-of-gift': { title: 'Deed of Gift', area: 'other-instruments', fee: 'flatDocument' },
  'legal-mortgage': { title: 'Deed of Legal Mortgage', area: 'other-instruments', fee: 'flatDocument' },
  'power-of-attorney': { title: 'Power of Attorney', area: 'other-instruments', fee: 'flatDocument' },
  'agreement-for-sale': { title: 'Agreement for Sale of Land', area: 'other-instruments', fee: 'flatDocument' },
  'deed-of-release': { title: 'Deed of Release', area: 'other-instruments', fee: 'deedOfRelease' },
  'search-instruction-standard': { title: 'Property Search Instruction', area: 'searches', fee: 'standardSearch' },
  'search-instruction-comprehensive': { title: 'Comprehensive Due Diligence Instruction', area: 'searches', fee: 'comprehensiveSearch' },
  will: { title: 'Will', area: 'wills-probate', fee: 'will' },
  codicil: { title: 'Codicil', area: 'wills-probate', fee: 'codicil' },
  'probate-papers': { title: 'Probate / Letters of Administration Papers', area: 'wills-probate', fee: 'probate' },
  assent: { title: "Executors' Assent", area: 'wills-probate', fee: 'probate' },
  'dispute-brief': { title: 'Lawyer Brief: Land Title Dispute', area: 'land-dispute', fee: 'disputeBrief' },
  // Each area that drafts a deed needing consent prepares the application for it.
  'consent-application': { title: "Application for Governor's Consent", area: ['conveyancing', 'other-instruments', 'tenancy'], fee: 'consentApplication' },
} as const satisfies Record<string, PropertyDocumentType>

export type PropertyDocumentKey = keyof typeof PROPERTY_DOCUMENTS

export function isPropertyDocumentKey(value: unknown): value is PropertyDocumentKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROPERTY_DOCUMENTS, value)
}

/** The areas allowed to emit a document. */
export function documentAreas(documentType: PropertyDocumentKey): readonly PropertyArea[] {
  const area: PropertyArea | readonly PropertyArea[] = PROPERTY_DOCUMENTS[documentType].area
  return typeof area === 'string' ? [area] : area
}

/** The fee for a document, or null for an unknown document type. */
export function getFee(documentType: string): PropertyFee | null {
  if (!isPropertyDocumentKey(documentType)) return null
  const key: FeeKey = PROPERTY_DOCUMENTS[documentType].fee
  if (key === 'transferFeeRate') {
    return { kind: 'transfer', amount: null, rate: PROPERTY_PRICING.transferFeeRate, label: TRANSFER_FEE_LABEL }
  }
  // A comprehensive search has a floor, never a price: a lawyer quotes it.
  if (key === 'comprehensiveSearch') return { kind: 'lawyer-confirms', amount: null, label: LAWYER_CONFIRMS_FEE_LABEL }
  const amount = PROPERTY_PRICING[key]
  if (amount === null) return { kind: 'lawyer-confirms', amount: null, label: LAWYER_CONFIRMS_FEE_LABEL }
  return { kind: 'flat', amount, label: FLAT_LABELS[key] ?? 'Property document' }
}

/** Every amount a property document can be paid online at. lib/casePricing.ts allows these and 0. */
export function propertyOnlineFees(): number[] {
  const amounts = new Set<number>()
  for (const key of Object.keys(PROPERTY_DOCUMENTS)) {
    const fee = getFee(key)
    if (fee?.kind === 'flat') amounts.add(fee.amount)
  }
  return [...amounts].sort((a, b) => a - b)
}
