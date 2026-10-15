// Exact answers for the Wills & probate and Land title dispute areas, worked out in code: which
// grant an estate needs, and how long ago a client lost possession of land. Pure: unit-tested in
// lib/__tests__/estate.test.ts. PENDING LAWYER SIGN-OFF (docs/property_agent_plans/, Phase 4).

import { addMonths, formatDate, parseDate } from './calc'

export type ProbatePath =
  | 'probate'
  | 'letters-of-administration'
  | 'letters-of-administration-with-will-annexed'
  | 'reseal'
  | 'escalate'

export type MarriageType = 'statutory' | 'customary' | 'islamic' | 'never-married' | 'unknown'

export interface ProbateInput {
  /** Did the deceased leave a will? */
  hasWill: boolean
  /** Will only: are the executors it names alive, able and willing to act? */
  executorsAbleAndWilling?: boolean
  /** No will only: how the deceased was married. "statutory" = under the Marriage Act. */
  marriageType?: MarriageType
  /** Was the deceased a Muslim? */
  deceasedWasMuslim?: boolean
  /** Has a grant already been made in another state or country? */
  grantMadeElsewhere?: boolean
  /** The state whose High Court the application goes to. */
  state: string
}

export interface ProbateAdvice {
  path: ProbatePath
  reason: string
  /** Where to apply, when not escalated. */
  applyTo: string | null
  /** What the application needs. The firm confirms the registry's current list. */
  documents: string[]
}

const COMMON = ['Death certificate of the deceased', 'Passport photographs and means of identification of the applicants', 'A schedule of the estate: every asset (land with its title documents, accounts, shares, vehicles) and every debt']

function registry(state: string): string {
  return state === 'FCT' ? 'The Probate Registry of the High Court of the Federal Capital Territory' : `The Probate Registry of the High Court of ${state} State`
}

/**
 * Which grant an estate needs:
 *  - a grant already made elsewhere is resealed here;
 *  - a will with executors able and willing to act → probate;
 *  - a will without them → letters of administration with the will annexed;
 *  - no will, married under the Marriage Act → letters of administration (the Administration of
 *    Estates Law decides the shares);
 *  - no will otherwise (customary or Islamic marriage, never married) → the estate follows the
 *    deceased's customary or Islamic law, which a lawyer must handle: escalate;
 *  - a Muslim deceased → escalate (Islamic law of succession may apply).
 */
export function chooseProbatePath(input: ProbateInput): ProbateAdvice {
  const applyTo = registry(input.state)
  if (input.deceasedWasMuslim) {
    return { path: 'escalate', reason: 'The deceased was a Muslim: Islamic law of succession may govern the estate. A lawyer must advise.', applyTo: null, documents: [] }
  }
  if (input.grantMadeElsewhere) {
    return {
      path: 'reseal',
      reason: 'A grant has already been made in another state or country: it is resealed here rather than applied for again.',
      applyTo,
      documents: ['A certified (sealed) copy of the grant made elsewhere', 'A certified copy of the will, if there is one', ...COMMON],
    }
  }
  if (input.hasWill) {
    if (input.executorsAbleAndWilling === undefined) throw new RangeError('executorsAbleAndWilling is needed when there is a will.')
    if (input.executorsAbleAndWilling) {
      return {
        path: 'probate',
        reason: 'There is a will and its executors are able and willing to act, so they apply for probate.',
        applyTo,
        documents: ['The original will', "The executors' oath", ...COMMON],
      }
    }
    return {
      path: 'letters-of-administration-with-will-annexed',
      reason: 'There is a will, but no executor it names can or will act, so letters of administration are granted with the will annexed.',
      applyTo,
      documents: ['The original will', 'Evidence of why the named executors cannot act (death certificate, renunciation)', "The administrators' oath", 'An administration bond with sureties', ...COMMON],
    }
  }
  const marriage = input.marriageType ?? 'unknown'
  if (marriage === 'unknown') throw new RangeError('marriageType is needed when there is no will: ask how the deceased was married.')
  if (marriage === 'statutory') {
    return {
      path: 'letters-of-administration',
      reason: 'No will, and the deceased was married under the Marriage Act: letters of administration, with the estate shared as the Administration of Estates Law sets.',
      applyTo,
      documents: ['The marriage certificate (Marriage Act marriage)', "The administrators' oath", 'An administration bond with sureties', 'Consent of the other persons entitled, where the registry requires it', ...COMMON],
    }
  }
  return {
    path: 'escalate',
    reason: `No will, and the deceased was ${marriage === 'never-married' ? 'never married' : `married under ${marriage} law`}: the estate follows the deceased's customary or Islamic law of succession. A lawyer must advise.`,
    applyTo: null,
    documents: [],
  }
}

/** Whole years from one date to another (birthday counting). */
export function wholeYearsBetween(from: string, to: string): number {
  const start = parseDate(from, 'from')
  const end = parseDate(to, 'to')
  if (end < start) throw new RangeError('The date is in the future.')
  let years = 0
  while (addMonths(start, 12 * (years + 1)) <= end) years++
  return years
}

export const LAND_LIMITATION_YEARS = 12

export interface LimitationCheck {
  yearsSince: number
  /** The day the general 12-year period runs out. */
  limitDate: string
  flag: 'possible-limitation-bar' | 'close-to-limit' | 'within-time'
  note: string
}

/**
 * How long since the client lost possession (or the cause of action arose), against the
 * general 12-year period for actions to recover land. The state's Limitation Law decides the
 * real answer: this only flags it for the lawyer.
 */
export function checkLimitation(since: string, today: string): LimitationCheck {
  const yearsSince = wholeYearsBetween(since, today)
  const limitDate = formatDate(addMonths(parseDate(since, 'since'), 12 * LAND_LIMITATION_YEARS))
  const note = "Generally 12 years for an action to recover land; the state's Limitation Law decides, and a lawyer must confirm."
  if (yearsSince >= LAND_LIMITATION_YEARS) return { yearsSince, limitDate, flag: 'possible-limitation-bar', note: `More than ${LAND_LIMITATION_YEARS} years have passed. ${note}` }
  if (yearsSince >= LAND_LIMITATION_YEARS - 2) return { yearsSince, limitDate, flag: 'close-to-limit', note: `Close to ${LAND_LIMITATION_YEARS} years: time may be short. ${note}` }
  return { yearsSince, limitDate, flag: 'within-time', note }
}
