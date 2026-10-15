// The Property Law Agent's seven areas of work (see docs/property_agent_plans/). Clients still
// see one "Property Law Agent" and cases.agent_id stays 'recovery-of-premises'; the area is
// recorded on property_matters.area. These ids are also the database CHECK list in
// add-property-matters.sql, so a new area means changing both.

export const PROPERTY_AREAS = [
  'recovery',
  'tenancy',
  'conveyancing',
  'other-instruments',
  'searches',
  'wills-probate',
  'land-dispute',
] as const

export type PropertyArea = (typeof PROPERTY_AREAS)[number]

export function isPropertyArea(value: unknown): value is PropertyArea {
  return typeof value === 'string' && (PROPERTY_AREAS as readonly string[]).includes(value)
}

export type MatterStatus = 'routing' | 'active' | 'escalated' | 'closed'

/** One row per thing that happened to a matter. Also the CHECK list in add-law-library.sql (which replaced add-property-matters.sql's). */
export type MatterEventKind = 'routed' | 'handoff' | 'escalated' | 'fee_accepted' | 'document_emitted' | 'law_lookup'

export interface PropertyMatter {
  caseId: string
  state: string | null
  lagosArea: string | null
  area: PropertyArea | null
  facts: Record<string, unknown>
  status: MatterStatus
}

export interface MatterEvent {
  kind: MatterEventKind
  payload: Record<string, unknown>
  createdAt: string
}
