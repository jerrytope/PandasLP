// The calc_* tools: thin wrappers round lib/property/calc.ts. Every naira figure and date the
// agent states comes from one of these, never from its own arithmetic.

import type { AgentTool } from '../../agentRuntime/types'
import { PROPERTY_PRICING, transferFee } from '../../propertyPricing'
import {
  addDays,
  addMonths,
  advanceRentCheck,
  formatDate,
  parseDate,
  arrears,
  mesneProfits,
  noticeToQuit,
  sevenDaysNoticeDate,
  type NoticePeriod,
  type RentFrequency,
  type TenancyType,
} from '../calc'
import type { PropertyToolContext } from './context'
import { optionalBoolean, optionalNumber, optionalString, requireNumber, requireString } from './context'

const DATE = { type: 'string', description: 'A date written as YYYY-MM-DD.' }
const FREQUENCIES: RentFrequency[] = ['weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly']
const TENANCY_TYPES: TenancyType[] = ['at-will', ...FREQUENCIES, 'fixed-term']

function oneOf<T extends string>(input: Record<string, unknown>, key: string, allowed: readonly T[]): T {
  const value = requireString(input, key, 40)
  if (!(allowed as readonly string[]).includes(value)) throw new RangeError(`${key} must be one of: ${allowed.join(', ')}.`)
  return value as T
}

type Tool = AgentTool<PropertyToolContext>

export const calcArrears: Tool = {
  definition: {
    name: 'calc_arrears',
    description: 'Works out rent arrears up to the day the tenancy ended (or today). Rent is due in advance, so every period that started on or before `to` counts in full. Use the figure it returns; never add up rent yourself.',
    input_schema: {
      type: 'object',
      properties: {
        rent: { type: 'number', description: 'Rent for one period, in naira.' },
        frequency: { type: 'string', enum: FREQUENCIES },
        from: { ...DATE, description: 'The first day of the first unpaid rent period (YYYY-MM-DD).' },
        to: { ...DATE, description: "The day the tenancy ended if it already has, otherwise TODAY (YYYY-MM-DD). Never a future date such as a notice's quit date: rent not yet due is not arrears." },
      },
      required: ['rent', 'frequency', 'from', 'to'],
    },
  },
  handler: (input, ctx) => {
    const to = requireString(input, 'to', 10)
    if (ctx.today && to > ctx.today) {
      throw new RangeError(`to (${to}) is in the future. Arrears are rent already due: use today (${ctx.today}) or the day the tenancy ended, whichever is earlier.`)
    }
    return {
      ok: true,
      result: arrears({
        rent: requireNumber(input, 'rent'),
        frequency: oneOf(input, 'frequency', FREQUENCIES),
        from: requireString(input, 'from', 10),
        to,
      }),
    }
  },
}

export const calcMesneProfits: Tool = {
  definition: {
    name: 'calc_mesne_profits',
    description: 'Works out mesne profits (compensation for staying on after the tenancy ended): annual rent ÷ 365 × days, to the kobo. Also returns the daily rate.',
    input_schema: {
      type: 'object',
      properties: {
        annualRent: { type: 'number', description: 'The rent for a full year, in naira.' },
        days: { type: 'integer', description: 'Days the tenant has stayed on since the tenancy ended.' },
      },
      required: ['annualRent', 'days'],
    },
  },
  handler: (input) => ({ ok: true, result: mesneProfits({ annualRent: requireNumber(input, 'annualRent'), days: requireNumber(input, 'days') }) }),
}

export const calcNoticeToQuit: Tool = {
  definition: {
    name: 'calc_notice_to_quit',
    description: "Decides whether a Notice to Quit is needed, how long it must be, and the earliest date the tenant can be required to quit. Applies the agreement's own period, the yearly anniversary rule, expired fixed terms and the Lagos arrears rule. Always use its quit date; never work one out yourself.",
    input_schema: {
      type: 'object',
      properties: {
        tenancyType: { type: 'string', enum: TENANCY_TYPES, description: 'How rent is paid decides the type. fixed-term for a lease for a set term.' },
        tenancyStart: { ...DATE, description: 'First day of the tenancy (needed for a yearly tenancy).' },
        agreementPeriodCount: { type: 'integer', description: 'Only if the tenancy agreement sets its own notice period: how many units.' },
        agreementPeriodUnit: { type: 'string', enum: ['days', 'weeks', 'months'] },
        fixedTermEnd: { ...DATE, description: 'The last day of a fixed term.' },
        rentTakenAfterExpiry: { type: 'boolean', description: 'Fixed term only: did the landlord accept rent for a period after it expired?' },
        rentFrequencyAfterExpiry: { type: 'string', enum: FREQUENCIES },
        state: { type: 'string', description: 'The state the property is in, e.g. Lagos, FCT, Oyo.' },
        lagosArea: { type: 'string', description: 'Lagos only: the area, e.g. Ikoyi, Victoria Island, Apapa, Ikeja GRA, Surulere.' },
        monthsInArrears: { type: 'number', description: 'Months of rent the tenant owes, if any.' },
        receivedOn: { ...DATE, description: 'The day the tenant will receive the notice.' },
      },
      required: ['tenancyType', 'state', 'receivedOn'],
    },
  },
  handler: (input) => {
    const count = optionalNumber(input, 'agreementPeriodCount')
    const unit = optionalString(input, 'agreementPeriodUnit') as NoticePeriod['unit'] | undefined
    if ((count === undefined) !== (unit === undefined)) throw new RangeError('Give both agreementPeriodCount and agreementPeriodUnit, or neither.')
    const frequencyAfter = optionalString(input, 'rentFrequencyAfterExpiry')
    return {
      ok: true,
      result: noticeToQuit({
        tenancyType: oneOf(input, 'tenancyType', TENANCY_TYPES),
        tenancyStart: optionalString(input, 'tenancyStart'),
        agreementPeriod: count !== undefined ? { count, unit: unit! } : null,
        fixedTermEnd: optionalString(input, 'fixedTermEnd'),
        rentTakenAfterExpiry: optionalBoolean(input, 'rentTakenAfterExpiry'),
        rentFrequencyAfterExpiry: frequencyAfter ? oneOf(input, 'rentFrequencyAfterExpiry', FREQUENCIES) : undefined,
        state: requireString(input, 'state', 60),
        lagosArea: optionalString(input, 'lagosArea') ?? null,
        monthsInArrears: optionalNumber(input, 'monthsInArrears'),
        receivedOn: requireString(input, 'receivedOn', 10),
      }),
    }
  },
}

export const calcSevenDaysNotice: Tool = {
  definition: {
    name: 'calc_seven_days_notice',
    description: "Works out when the Seven Days' Notice of Owner's Intention to Apply to Recover Possession expires and the first day the landlord may file in court. It can only be served after the tenancy has ended.",
    input_schema: {
      type: 'object',
      properties: {
        receivedOn: { ...DATE, description: 'The day the tenant will receive the notice.' },
        tenancyEndedOn: { ...DATE, description: 'The day the tenancy ended (the Notice to Quit quit date, or the last day of the fixed term).' },
      },
      required: ['receivedOn', 'tenancyEndedOn'],
    },
  },
  handler: (input) => ({
    ok: true,
    result: sevenDaysNoticeDate({ receivedOn: requireString(input, 'receivedOn', 10), tenancyEndedOn: requireString(input, 'tenancyEndedOn', 10) }),
  }),
}

export const calcAdvanceRent: Tool = {
  definition: {
    name: 'calc_advance_rent',
    description: 'Checks whether the rent a landlord wants in advance is within the Lagos Tenancy Law 2011 limits (a new tenant or sitting yearly tenant at most one year; a sitting monthly tenant at most six months).',
    input_schema: {
      type: 'object',
      properties: {
        state: { type: 'string' },
        lagosArea: { type: 'string' },
        tenantType: { type: 'string', enum: ['new', 'sitting'] },
        rentFrequency: { type: 'string', enum: FREQUENCIES },
        monthsDemanded: { type: 'number', description: "Months' rent the landlord wants in advance." },
      },
      required: ['state', 'tenantType', 'rentFrequency', 'monthsDemanded'],
    },
  },
  handler: (input) => ({
    ok: true,
    result: advanceRentCheck({
      state: requireString(input, 'state', 60),
      lagosArea: optionalString(input, 'lagosArea') ?? null,
      tenantType: oneOf(input, 'tenantType', ['new', 'sitting'] as const),
      rentFrequency: oneOf(input, 'rentFrequency', FREQUENCIES),
      monthsDemanded: requireNumber(input, 'monthsDemanded'),
    }),
  }),
}

export const calcTransferFee: Tool = {
  definition: {
    name: 'calc_transfer_fee',
    description: "The firm's 2.5% fee on a transfer of title, in naira, for quoting to the client BEFORE they accept it. It records nothing: record_fee_acceptance records the acceptance.",
    input_schema: {
      type: 'object',
      properties: { consideration: { type: 'number', description: 'The price for the property, in naira.' } },
      required: ['consideration'],
    },
  },
  handler: (input) => {
    const consideration = requireNumber(input, 'consideration')
    if (consideration <= 0) throw new RangeError('consideration must be more than 0.')
    return { ok: true, result: { fee: transferFee(consideration), rate: PROPERTY_PRICING.transferFeeRate, consideration } }
  },
}

export const calcAmounts: Tool = {
  definition: {
    name: 'calc_amounts',
    description: 'Adds or subtracts naira amounts (e.g. a balance = price minus deposit). Use it for any figure no other calc tool gives.',
    input_schema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['sum', 'difference'], description: 'sum: add them all; difference: the first minus all the others.' },
        amounts: { type: 'array', items: { type: 'number' } },
      },
      required: ['operation', 'amounts'],
    },
  },
  handler: (input) => {
    const op = oneOf(input, 'operation', ['sum', 'difference'] as const)
    const amounts = input.amounts
    if (!Array.isArray(amounts) || amounts.length < 2 || amounts.some((a) => typeof a !== 'number' || !Number.isFinite(a))) {
      throw new RangeError('amounts must be a list of at least two numbers.')
    }
    const kobo = (amounts as number[]).map((a) => Math.round(a * 100))
    const total = op === 'sum' ? kobo.reduce((a, b) => a + b, 0) : kobo.slice(1).reduce((a, b) => a - b, kobo[0])
    return { ok: true, result: { result: total / 100 } }
  },
}

export const calcDate: Tool = {
  definition: {
    name: 'calc_date',
    description: 'Adds days, months or years to a date (e.g. completion 60 days after signing). Use it for any date no other calc tool gives.',
    input_schema: {
      type: 'object',
      properties: {
        date: DATE,
        days: { type: 'integer' },
        months: { type: 'integer' },
        years: { type: 'integer' },
      },
      required: ['date'],
    },
  },
  handler: (input) => {
    const days = optionalNumber(input, 'days') ?? 0
    const months = (optionalNumber(input, 'months') ?? 0) + 12 * (optionalNumber(input, 'years') ?? 0)
    if (![days, months].every(Number.isInteger)) throw new RangeError('days, months and years must be whole numbers.')
    const result = addDays(addMonths(parseDate(requireString(input, 'date', 10), 'date'), months), days)
    return { ok: true, result: { date: formatDate(result) } }
  },
}

export const CALC_TOOLS: Tool[] = [calcArrears, calcMesneProfits, calcNoticeToQuit, calcSevenDaysNotice, calcAdvanceRent, calcTransferFee, calcAmounts, calcDate]
