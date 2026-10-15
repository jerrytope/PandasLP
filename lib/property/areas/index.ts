// All seven property areas. An area with enabled: false is escalated by the router and no area
// may hand off to it; all seven are live since Phase 4.

import type { PropertyArea } from '../types'
import { CONVEYANCING } from './conveyancing'
import { LAND_DISPUTE } from './landDispute'
import { OTHER_INSTRUMENTS } from './otherInstruments'
import { RECOVERY } from './recovery'
import { SEARCHES } from './searches'
import { TENANCY } from './tenancy'
import type { AreaConfig } from './types'
import { WILLS_PROBATE } from './willsProbate'

export const AREAS: Record<PropertyArea, AreaConfig> = {
  recovery: RECOVERY,
  tenancy: TENANCY,
  conveyancing: CONVEYANCING,
  'other-instruments': OTHER_INSTRUMENTS,
  searches: SEARCHES,
  'wills-probate': WILLS_PROBATE,
  'land-dispute': LAND_DISPUTE,
}

export const ENABLED_AREAS: PropertyArea[] = (Object.values(AREAS) as AreaConfig[]).filter((a) => a.enabled).map((a) => a.id)

export { areaBlock, areaDocuments, type AreaConfig } from './types'
