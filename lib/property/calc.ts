// Every naira figure and date the Property Law Agent relies on, worked out in code. The model
// collects the inputs and explains the results; it never does the arithmetic itself (see
// docs/property_agent_plans/). Pure: no database, no env, no clock. Unit-tested in
// lib/__tests__/propertyCalc.test.ts.
//
// Dates are calendar dates, 'YYYY-MM-DD', handled in UTC so a server's time zone can never
// move a day.
//
// PENDING LAWYER SIGN-OFF: the notice periods and rules below follow the firm's existing
// Property Law Agent prompt and the rebuild plan. They are checked against the scope document
// when the Recovery area is signed off (Phase 2).
//
// HOW DAYS ARE COUNTED. A period "from" a day excludes that day (Interpretation Act, s.15(2)(a)).
// A notice the tenant receives on 1 March giving one month runs 2 March to 1 April, so the
// earliest day the tenant can be required to quit is 1 April. Change NOTICE_COUNTS_RECEIPT_DAY
// if the firm's lawyer decides otherwise; every rule below follows it.
const NOTICE_COUNTS_RECEIPT_DAY = false

export type RentFrequency = 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'
export type TenancyType = RentFrequency | 'at-will' | 'fixed-term'

// ----- Dates -----

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parses 'YYYY-MM-DD' into a UTC date, or throws RangeError for anything else. */
export function parseDate(value: string, field = 'date'): Date {
  const m = typeof value === 'string' ? value.match(ISO_DATE) : null
  if (!m) throw new RangeError(`${field} must be a date written as YYYY-MM-DD.`)
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (formatDate(d) !== value) throw new RangeError(`${field} is not a real calendar date.`)
  return d
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days))
}

/** Adds calendar months, keeping the day where it exists (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay)))
}

const MONTHS_PER_PERIOD: Record<Exclude<RentFrequency, 'weekly'>, number> = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
}

/** The start of rent period `n` (0-based) for a tenancy whose periods start on `start`. */
function periodStart(start: Date, frequency: RentFrequency, n: number): Date {
  return frequency === 'weekly' ? addDays(start, 7 * n) : addMonths(start, MONTHS_PER_PERIOD[frequency] * n)
}

function positiveAmount(value: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive amount in naira.`)
  }
  return value
}

// ----- Money -----

export interface MesneProfits {
  /** Naira, to the kobo. */
  amount: number
  kobo: number
  dailyRate: number
}

/** Mesne profits: annual rent ÷ 365 × days, to the kobo. ₦1,200,000 for 90 days = ₦295,890.41. */
export function mesneProfits({ annualRent, days }: { annualRent: number; days: number }): MesneProfits {
  positiveAmount(annualRent, 'annualRent')
  if (!Number.isInteger(days) || days < 0) throw new RangeError('days must be a whole number of days, 0 or more.')
  const kobo = Math.round((annualRent * 100 * days) / 365)
  return { amount: kobo / 100, kobo, dailyRate: Math.round((annualRent * 100) / 365) / 100 }
}

/** The number of days from one date to another, counting the last day but not the first. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to, 'to').getTime() - parseDate(from, 'from').getTime()) / 86_400_000)
}

export interface Arrears {
  amount: number
  periods: number
  schedule: { periodStart: string; periodEnd: string; rent: number }[]
}

/**
 * Rent arrears up to the day the tenancy ended. Rent is due in advance at the start of each
 * period, so every period that STARTED on or before `to` is owed in full.
 *
 * @param from the start of the first unpaid period
 * @param to   the day the tenancy ended (or today, if it hasn't)
 */
export function arrears({ rent, frequency, from, to }: { rent: number; frequency: RentFrequency; from: string; to: string }): Arrears {
  positiveAmount(rent, 'rent')
  if (frequency !== 'weekly' && !(frequency in MONTHS_PER_PERIOD)) throw new RangeError(`Unknown rent frequency: ${frequency}.`)
  const start = parseDate(from, 'from')
  const end = parseDate(to, 'to')
  if (end < start) throw new RangeError('to must not be before from.')

  const schedule: Arrears['schedule'] = []
  for (let n = 0; ; n++) {
    const s = periodStart(start, frequency, n)
    if (s > end) break
    schedule.push({ periodStart: formatDate(s), periodEnd: formatDate(addDays(periodStart(start, frequency, n + 1), -1)), rent })
    if (schedule.length > 1200) throw new RangeError('That arrears period is too long to be right; check the dates.')
  }
  return { amount: Math.round(rent * schedule.length * 100) / 100, periods: schedule.length, schedule }
}

// ----- Notices -----

export type Jurisdiction = 'lagos' | 'lagos-excluded-area' | 'other'

/** Apapa, Ikeja GRA, Ikoyi and Victoria Island: the Lagos Tenancy Law 2011 does not apply there. */
export const LAGOS_EXCLUDED_AREAS = ['apapa', 'ikeja-gra', 'ikoyi', 'victoria-island'] as const

export function jurisdictionOf(state: string, lagosArea?: string | null): Jurisdiction {
  if (state.trim().toLowerCase() !== 'lagos') return 'other'
  const area = (lagosArea ?? '').trim().toLowerCase().replace(/\s+/g, '-')
  return (LAGOS_EXCLUDED_AREAS as readonly string[]).includes(area) ? 'lagos-excluded-area' : 'lagos'
}

export interface NoticePeriod {
  unit: 'days' | 'weeks' | 'months'
  count: number
}

/** The default notice for each tenancy type, where the agreement says nothing. */
const DEFAULT_NOTICE: Record<Exclude<TenancyType, 'fixed-term'>, NoticePeriod> = {
  'at-will': { unit: 'weeks', count: 1 },
  weekly: { unit: 'weeks', count: 1 },
  monthly: { unit: 'months', count: 1 },
  quarterly: { unit: 'months', count: 3 },
  'half-yearly': { unit: 'months', count: 3 },
  yearly: { unit: 'months', count: 6 },
}

function addPeriod(d: Date, p: NoticePeriod): Date {
  if (p.unit === 'days') return addDays(d, p.count)
  if (p.unit === 'weeks') return addDays(d, 7 * p.count)
  return addMonths(d, p.count)
}

/** The earliest day a notice of `period`, received on `receivedOn`, can require the tenant to quit. */
function earliestQuitDate(receivedOn: Date, period: NoticePeriod): Date {
  const end = addPeriod(receivedOn, period)
  return NOTICE_COUNTS_RECEIPT_DAY ? addDays(end, -1) : end
}

export interface NoticeToQuitInput {
  /** How rent is paid decides the tenancy type; 'fixed-term' for a lease for a set term. */
  tenancyType: TenancyType
  /** The first day of the tenancy: the yearly anniversary is counted from it. */
  tenancyStart?: string
  /** A notice period the tenancy agreement itself sets. It wins over the defaults. */
  agreementPeriod?: NoticePeriod | null
  /** The last day of a fixed term. */
  fixedTermEnd?: string
  /** Did the landlord take rent for a period after the fixed term expired? */
  rentTakenAfterExpiry?: boolean
  /** How rent was paid after expiry, when it was. */
  rentFrequencyAfterExpiry?: RentFrequency
  state: string
  lagosArea?: string | null
  /** Months of rent unpaid, for the Lagos arrears rule. */
  monthsInArrears?: number
  /** The day the tenant receives (or will receive) the notice. */
  receivedOn: string
}

export type NoticeToQuitResult =
  | {
      needed: true
      period: NoticePeriod
      periodSource: 'agreement' | 'default'
      /** The earliest day the notice can require the tenant to give up possession. */
      quitDate: string
      jurisdiction: Jurisdiction
      tenancyType: Exclude<TenancyType, 'fixed-term'>
      notes: string[]
    }
  | {
      needed: false
      reason: 'fixed-term-expired' | 'fixed-term-running' | 'lagos-arrears-lapse'
      /** For a fixed term still running: the day it ends by itself. */
      tenancyEnds?: string
      nextStep: 'seven-days-notice' | 'wait-for-term-to-end'
      jurisdiction: Jurisdiction
      notes: string[]
    }

/**
 * Whether a Notice to Quit is needed, how long it must be and the day the tenant must quit by.
 * The rules, in order:
 *  - An expired fixed term needs no Notice to Quit, unless rent was taken after expiry (the
 *    tenant then holds a periodic tenancy that follows how that rent was paid).
 *  - A fixed term still running ends by itself; no notice is served to end it early.
 *  - Lagos (outside the excluded areas): a monthly tenant owing 6 months' rent, or a quarterly
 *    or half-yearly tenant owing a year's, needs no Notice to Quit.
 *  - The agreement's own notice period wins; otherwise the default for the tenancy type.
 *  - A yearly tenancy ends on the last day of a tenancy year, and the notice must run its full
 *    six months before that day.
 */
export function noticeToQuit(input: NoticeToQuitInput): NoticeToQuitResult {
  const received = parseDate(input.receivedOn, 'receivedOn')
  const jurisdiction = jurisdictionOf(input.state, input.lagosArea)
  const notes: string[] = []
  if (jurisdiction === 'lagos-excluded-area') {
    notes.push('The Lagos Tenancy Law 2011 does not apply in this area. The periods are the same, but the notice is given under the Rent Control and Recovery of Residential Premises Law (homes) or the Recovery of Premises Law (business premises).')
  }

  let type = input.tenancyType
  if (!(type in DEFAULT_NOTICE) && type !== 'fixed-term') throw new RangeError(`Unknown tenancy type: ${type}.`)

  if (type === 'fixed-term') {
    if (!input.fixedTermEnd) throw new RangeError('fixedTermEnd is needed for a fixed-term tenancy.')
    const termEnd = parseDate(input.fixedTermEnd, 'fixedTermEnd')
    if (received <= termEnd) {
      return { needed: false, reason: 'fixed-term-running', tenancyEnds: input.fixedTermEnd, nextStep: 'wait-for-term-to-end', jurisdiction, notes: [...notes, 'A fixed term ends by itself on its last day. No Notice to Quit is served to end it.'] }
    }
    if (!input.rentTakenAfterExpiry) {
      return { needed: false, reason: 'fixed-term-expired', nextStep: 'seven-days-notice', jurisdiction, notes: [...notes, 'The fixed term has expired and no rent was taken after it, so no Notice to Quit is needed. The next step is the Seven Days\' Notice.'] }
    }
    if (!input.rentFrequencyAfterExpiry) throw new RangeError('rentFrequencyAfterExpiry is needed when rent was taken after the fixed term expired.')
    type = input.rentFrequencyAfterExpiry
    notes.push(`Rent was taken after the fixed term expired, so the tenant now holds a ${type} tenancy and a Notice to Quit is needed.`)
  }
  const periodic = type as Exclude<TenancyType, 'fixed-term'>

  if (jurisdiction === 'lagos' && input.monthsInArrears !== undefined) {
    const lapse = (periodic === 'monthly' && input.monthsInArrears >= 6) ||
      ((periodic === 'quarterly' || periodic === 'half-yearly') && input.monthsInArrears >= 12)
    if (lapse) {
      return { needed: false, reason: 'lagos-arrears-lapse', nextStep: 'seven-days-notice', jurisdiction, notes: [...notes, 'Under the Lagos Tenancy Law 2011, a monthly tenant owing six months\' rent, or a quarterly or half-yearly tenant owing a year\'s rent, needs no Notice to Quit. The next step is the Seven Days\' Notice.'] }
    }
  }

  const fromAgreement = input.agreementPeriod ?? null
  if (fromAgreement && (!Number.isInteger(fromAgreement.count) || fromAgreement.count <= 0 || !['days', 'weeks', 'months'].includes(fromAgreement.unit))) {
    throw new RangeError('agreementPeriod must be a whole number of days, weeks or months.')
  }
  const period = fromAgreement ?? DEFAULT_NOTICE[periodic]
  let quit = earliestQuitDate(received, period)

  if (periodic === 'yearly' && !fromAgreement) {
    if (!input.tenancyStart) throw new RangeError('tenancyStart is needed for a yearly tenancy, to find the end of the tenancy year.')
    const start = parseDate(input.tenancyStart, 'tenancyStart')
    // The last day of tenancy year k is the day before its kth anniversary.
    let yearEnd = addDays(addMonths(start, 12), -1)
    for (let k = 2; yearEnd < quit; k++) yearEnd = addDays(addMonths(start, 12 * k), -1)
    quit = yearEnd
    notes.push('A yearly tenancy ends on the last day of a tenancy year, so the quit date is the first year-end at least six months after the tenant receives the notice.')
  }

  return { needed: true, period, periodSource: fromAgreement ? 'agreement' : 'default', quitDate: formatDate(quit), jurisdiction, tenancyType: periodic, notes }
}

/** Is a notice that names `quitDate` long enough? A notice short by even one day is invalid. */
export function isNoticeLongEnough(input: NoticeToQuitInput & { quitDate: string }): { valid: boolean; earliestQuitDate: string | null } {
  const result = noticeToQuit(input)
  if (!result.needed) return { valid: false, earliestQuitDate: null }
  const quit = parseDate(input.quitDate, 'quitDate')
  const valid = quit >= parseDate(result.quitDate) &&
    // A yearly notice must also end on a tenancy year-end, not just be long enough.
    (result.tenancyType !== 'yearly' || result.periodSource === 'agreement' || isYearEnd(input.tenancyStart!, quit))
  return { valid, earliestQuitDate: result.quitDate }
}

function isYearEnd(tenancyStart: string, d: Date): boolean {
  const start = parseDate(tenancyStart, 'tenancyStart')
  for (let k = 1; ; k++) {
    const yearEnd = addDays(addMonths(start, 12 * k), -1)
    if (yearEnd.getTime() === d.getTime()) return true
    if (yearEnd > d) return false
  }
}

export interface SevenDaysNotice {
  /** The last day of the seven days. */
  expiresOn: string
  /** The first day the landlord may file for recovery of possession. */
  earliestFilingDate: string
}

/**
 * The Seven Days' Notice of Owner's Intention to Apply to Recover Possession. It is served only
 * once the tenancy has ended (the Notice to Quit expired, or the fixed term ran out).
 */
export function sevenDaysNoticeDate({ receivedOn, tenancyEndedOn }: { receivedOn: string; tenancyEndedOn: string }): SevenDaysNotice {
  const received = parseDate(receivedOn, 'receivedOn')
  const ended = parseDate(tenancyEndedOn, 'tenancyEndedOn')
  if (received <= ended) {
    throw new RangeError('The Seven Days\' Notice can only be served after the tenancy has ended (after the Notice to Quit has expired).')
  }
  const expires = NOTICE_COUNTS_RECEIPT_DAY ? addDays(received, 6) : addDays(received, 7)
  return { expiresOn: formatDate(expires), earliestFilingDate: formatDate(addDays(expires, 1)) }
}

export interface AdvanceRentCheck {
  /** Whether a statutory limit applies at all. */
  applies: boolean
  /** The most rent, in months, the landlord may ask for in advance. null = no limit found. */
  limitMonths: number | null
  withinLimit: boolean | null
  note: string
}

/**
 * The Lagos Tenancy Law 2011 limits on rent in advance: a new tenant, or a sitting yearly tenant,
 * at most one year; a sitting monthly tenant at most six months. Not in the Lagos excluded areas
 * or outside Lagos.
 */
export function advanceRentCheck({ state, lagosArea, tenantType, rentFrequency, monthsDemanded }: {
  state: string
  lagosArea?: string | null
  tenantType: 'new' | 'sitting'
  rentFrequency: RentFrequency
  monthsDemanded: number
}): AdvanceRentCheck {
  if (typeof monthsDemanded !== 'number' || !Number.isFinite(monthsDemanded) || monthsDemanded < 0) {
    throw new RangeError('monthsDemanded must be a number of months, 0 or more.')
  }
  const jurisdiction = jurisdictionOf(state, lagosArea)
  if (jurisdiction !== 'lagos') {
    return { applies: false, limitMonths: null, withinLimit: null, note: jurisdiction === 'lagos-excluded-area' ? 'The Lagos Tenancy Law 2011, and its advance-rent limits, do not apply in this area.' : 'No statutory advance-rent limit is applied for this state.' }
  }
  let limit: number | null = null
  if (tenantType === 'new' || rentFrequency === 'yearly') limit = 12
  else if (rentFrequency === 'monthly') limit = 6
  if (limit === null) {
    return { applies: true, limitMonths: null, withinLimit: null, note: 'The Lagos limit for a sitting tenant paying this way is not settled here; a lawyer should confirm it.' }
  }
  return {
    applies: true,
    limitMonths: limit,
    withinLimit: monthsDemanded <= limit,
    note: `Under the Lagos Tenancy Law 2011 a landlord may not demand more than ${limit} months' rent in advance from this tenant.`,
  }
}
