// prepare_consent_application: one shared tool for every area that drafts a deed needing the
// Governor's (or, in the FCT, the Minister's) consent. It decides whether consent is needed,
// who grants it and what goes with the application; the area then drafts the application with
// emit_document ('consent-application') and the firm files it.
// PENDING LAWYER SIGN-OFF (docs/property_agent_plans/, task 2.15).

import type { AgentTool } from '../../agentRuntime/types'
import { normaliseState } from '../jurisdictions'
import type { PropertyArea } from '../types'
import { extractCitations } from '../lawLookup'
import type { PropertyToolContext } from './context'
import { optionalBoolean, optionalNumber, requireString } from './context'

export type ConsentInstrument = 'assignment' | 'gift' | 'legal-mortgage' | 'lease' | 'sublease'
const INSTRUMENTS: ConsentInstrument[] = ['assignment', 'gift', 'legal-mortgage', 'lease', 'sublease']
const TITLE_TYPES = ['statutory', 'customary', 'unknown'] as const

const AREAS_WITH_CONSENT: PropertyArea[] = ['conveyancing', 'other-instruments', 'tenancy']

export interface ConsentAdvice {
  consentNeeded: boolean
  authority: string | null
  provision: string | null
  enclosures: string[]
  notes: string[]
}

export function consentAdvice(input: {
  instrument: ConsentInstrument
  state: string
  titleType: (typeof TITLE_TYPES)[number]
  termYears?: number
  partyIsCompany?: boolean
}): ConsentAdvice {
  const state = normaliseState(input.state)
  if (!state) throw new RangeError('That state is not one the firm covers; escalate the matter instead.')
  const notes: string[] = ['The firm confirms the current list of documents and the charges for this state before filing. Never quote the government charges.']

  if ((input.instrument === 'lease' || input.instrument === 'sublease')) {
    if (input.termYears === undefined) throw new RangeError('termYears is needed for a lease or sublease.')
    if (input.termYears <= 3) {
      return { consentNeeded: false, authority: null, provision: null, enclosures: [], notes: ['A lease or sublease of three years or less is not made by deed and does not go for consent.'] }
    }
  }

  // There is no customary right of occupancy in the FCT: all land there is held from the Federal Government.
  const customary = input.titleType === 'customary' && state !== 'FCT'
  const authority = state === 'FCT'
    ? 'The Honourable Minister of the Federal Capital Territory (through the FCT land administration)'
    : customary ? `The Local Government with jurisdiction over the land in ${state} State` : `The Governor of ${state} State (through the State Lands Bureau / Ministry of Lands)`
  const provision = customary ? 'Section 21 of the Land Use Act' : state === 'FCT' ? "Section 22 of the Land Use Act, the Governor's powers being exercised in the FCT by the Minister" : 'Section 22 of the Land Use Act'

  if (input.titleType === 'unknown') notes.push('Confirm whether the land is held under a statutory or a customary right of occupancy: it decides who grants consent.')
  if (input.instrument === 'legal-mortgage' && input.partyIsCompany) notes.push('A charge by a company must also be registered at the Corporate Affairs Commission within 90 days of its creation.')

  const enclosures = [
    'Executed copies of the deed',
    'Certified true copy of the root of title (Certificate of Occupancy, or the registered deed under which the transferor holds)',
    'Survey plan of the property',
    'Evidence that ground rent and land use charge are paid up to date',
    'Tax clearance certificates of the parties for the last three years',
    'Passport photographs and means of identification of the parties',
  ]
  if (input.partyIsCompany) enclosures.push('For a company party: certificate of incorporation, particulars of directors and the board resolution approving the transaction')
  if (input.instrument === 'legal-mortgage') enclosures.push('The letter of offer for the facility the mortgage secures')
  return { consentNeeded: true, authority, provision, enclosures, notes }
}

export const prepareConsentApplication: AgentTool<PropertyToolContext> = {
  definition: {
    name: 'prepare_consent_application',
    description: "For a deed you have drafted (assignment, gift, legal mortgage, or a lease or sublease over three years): whether consent is needed, who grants it, the legal provision and the documents to enclose. Then draft the application with emit_document (documentType 'consent-application'). Only for Conveyancing, Other instruments and Tenancy.",
    input_schema: {
      type: 'object',
      properties: {
        instrument: { type: 'string', enum: INSTRUMENTS },
        state: { type: 'string' },
        titleType: { type: 'string', enum: [...TITLE_TYPES], description: 'statutory (Certificate of Occupancy or deemed grant), customary, or unknown.' },
        termYears: { type: 'number', description: 'Lease or sublease only: the length of the term in years.' },
        partyIsCompany: { type: 'boolean', description: 'Is any party a company?' },
      },
      required: ['instrument', 'state', 'titleType'],
    },
  },
  handler: (input, ctx) => {
    if (!ctx.area || !AREAS_WITH_CONSENT.includes(ctx.area)) throw new RangeError('Consent applications are prepared by the Conveyancing, Other instruments and Tenancy areas only.')
    const instrument = requireString(input, 'instrument', 30)
    if (!(INSTRUMENTS as string[]).includes(instrument)) throw new RangeError(`instrument must be one of: ${INSTRUMENTS.join(', ')}.`)
    const titleType = requireString(input, 'titleType', 20)
    if (!(TITLE_TYPES as readonly string[]).includes(titleType)) throw new RangeError(`titleType must be one of: ${TITLE_TYPES.join(', ')}.`)
    const advice = consentAdvice({
        instrument: instrument as ConsentInstrument,
        state: requireString(input, 'state', 60),
        titleType: titleType as (typeof TITLE_TYPES)[number],
        termYears: optionalNumber(input, 'termYears'),
        partyIsCompany: optionalBoolean(input, 'partyIsCompany'),
    })
    // The application quotes this provision, so it may be cited in the documents that follow.
    ctx.citable ??= new Set()
    for (const c of extractCitations(advice.provision ?? '')) ctx.citable.add(c.key)
    return { ok: true, result: advice }
  },
}
