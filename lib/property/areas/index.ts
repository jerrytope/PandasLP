// All seven property areas. Wills & probate and Land title disputes are built in Phase 4
// (docs/property_agent_plans/phase-4-wills-probate-and-disputes.md); until then they are
// disabled: the router escalates matters for them and no area may hand off to them.

import type { PropertyArea } from '../types'
import { CONVEYANCING } from './conveyancing'
import { OTHER_INSTRUMENTS } from './otherInstruments'
import { RECOVERY } from './recovery'
import { SEARCHES } from './searches'
import { TENANCY } from './tenancy'
import type { AreaConfig } from './types'

const notYetBuilt = (id: PropertyArea, title: string): AreaConfig => ({
  id,
  title,
  enabled: false,
  signOff: null,
  prompt: '',
  jurisdictionRules: { lagos: '', fct: '', western: '', ca: '' },
  citableCases: [],
  handoffs: [],
})

export const AREAS: Record<PropertyArea, AreaConfig> = {
  recovery: RECOVERY,
  tenancy: TENANCY,
  conveyancing: CONVEYANCING,
  'other-instruments': OTHER_INSTRUMENTS,
  searches: SEARCHES,
  'wills-probate': notYetBuilt('wills-probate', 'wills and probate'),
  'land-dispute': notYetBuilt('land-dispute', 'land title dispute'),
}

export const ENABLED_AREAS: PropertyArea[] = (Object.values(AREAS) as AreaConfig[]).filter((a) => a.enabled).map((a) => a.id)

export { areaBlock, areaDocuments, type AreaConfig } from './types'
