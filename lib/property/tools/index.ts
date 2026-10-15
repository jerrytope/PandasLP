// The tools every property area shares. Order matters for caching: the tool list sits before
// the system prompt in the cache prefix, so it must be the same list in the same order on
// every call (see lib/agentRuntime/runAgent.ts).

import type { AgentTool } from '../../agentRuntime/types'
import { CALC_TOOLS } from './calcTools'
import { prepareConsentApplication } from './consentApplication'
import type { PropertyToolContext } from './context'
import { emitDocument } from './emitDocument'
import { getSection, lookupLaw } from './lawTools'
import { escalateToLawyer, getFeeTool, handoffTo, recordFacts, recordFeeAcceptance } from './matterTools'

export const SHARED_PROPERTY_TOOLS: AgentTool<PropertyToolContext>[] = [
  ...CALC_TOOLS,
  getFeeTool,
  recordFacts,
  recordFeeAcceptance,
  handoffTo,
  escalateToLawyer,
  prepareConsentApplication,
  getSection,
  lookupLaw,
  emitDocument,
]

export type { EmittedDocument, PropertyToolContext } from './context'
