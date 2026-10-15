// choose_probate_path and check_limitation: thin wrappers round lib/property/estate.ts.

import type { AgentTool } from '../../agentRuntime/types'
import { checkLimitation, chooseProbatePath, type MarriageType } from '../estate'
import type { PropertyToolContext } from './context'
import { optionalBoolean, optionalString, requireString } from './context'

type Tool = AgentTool<PropertyToolContext>

const MARRIAGE_TYPES: MarriageType[] = ['statutory', 'customary', 'islamic', 'never-married', 'unknown']

export const chooseProbatePathTool: Tool = {
  definition: {
    name: 'choose_probate_path',
    description: 'Decides which grant an estate needs (probate, letters of administration with or without the will annexed, resealing a grant made elsewhere) or that a lawyer must take it (Islamic law, customary intestacy), where to apply, and what the application needs. Wills & probate only. Always use it; never decide the path yourself.',
    input_schema: {
      type: 'object',
      properties: {
        hasWill: { type: 'boolean' },
        executorsAbleAndWilling: { type: 'boolean', description: 'Only if there is a will: are the named executors alive, able and willing to act?' },
        marriageType: { type: 'string', enum: MARRIAGE_TYPES, description: 'Only if there is no will. statutory = married under the Marriage Act (a church or registry wedding).' },
        deceasedWasMuslim: { type: 'boolean' },
        grantMadeElsewhere: { type: 'boolean', description: 'Has probate or administration already been granted in another state or country?' },
      },
      required: ['hasWill'],
    },
  },
  handler: (input, ctx) => {
    if (ctx.area !== 'wills-probate') throw new RangeError('choose_probate_path is for the Wills & probate area only.')
    if (!ctx.matterState) throw new RangeError('The matter has no state yet.')
    const marriage = optionalString(input, 'marriageType')
    if (marriage && !(MARRIAGE_TYPES as string[]).includes(marriage)) throw new RangeError(`marriageType must be one of: ${MARRIAGE_TYPES.join(', ')}.`)
    const hasWill = input.hasWill
    if (typeof hasWill !== 'boolean') throw new RangeError('hasWill must be true or false.')
    return {
      ok: true,
      result: {
        ...chooseProbatePath({
          hasWill,
          executorsAbleAndWilling: optionalBoolean(input, 'executorsAbleAndWilling'),
          marriageType: marriage as MarriageType | undefined,
          deceasedWasMuslim: optionalBoolean(input, 'deceasedWasMuslim'),
          grantMadeElsewhere: optionalBoolean(input, 'grantMadeElsewhere'),
          state: ctx.matterState,
        }),
        note: "The firm confirms the registry's current list of documents and its fees. Never quote the registry's fees.",
      },
    }
  },
}

export const checkLimitationTool: Tool = {
  definition: {
    name: 'check_limitation',
    description: 'How many years since the client lost possession of the land (or the dispute arose), against the general 12-year limit for recovering land. Flags it for the lawyer; it does not decide the case.',
    input_schema: {
      type: 'object',
      properties: { since: { type: 'string', description: 'The date possession was lost or the dispute arose (YYYY-MM-DD). If only the year is known, use 1 January of that year.' } },
      required: ['since'],
    },
  },
  handler: (input, ctx) => {
    if (!ctx.today) throw new RangeError("Today's date is not available.")
    return { ok: true, result: checkLimitation(requireString(input, 'since', 10), ctx.today) }
  },
}
