// A matter that lives only in memory, for the test chat on /manageai: the lead lawyer tries a
// draft of his drafting instructions on the real Property Law Agent without creating a case,
// a property_matters row or a lawyer alert. The browser keeps the snapshot between turns and
// sends it back with each message.

import type { MatterRepository } from './matterStore'
import { isPropertyArea, type MatterEvent, type MatterStatus, type PropertyMatter } from './types'

export interface MatterSnapshot {
  matter: PropertyMatter
  events: MatterEvent[]
}

const STATUSES: MatterStatus[] = ['routing', 'active', 'escalated', 'closed']

/** A fresh test matter, or the one the browser sent back (anything malformed starts again). */
export function readSnapshot(raw: unknown, caseId: string): MatterSnapshot {
  const fresh: MatterSnapshot = { matter: { caseId, state: null, lagosArea: null, area: null, facts: {}, status: 'routing' }, events: [] }
  if (!raw || typeof raw !== 'object') return fresh
  const { matter, events } = raw as Partial<MatterSnapshot>
  if (!matter || typeof matter !== 'object' || !Array.isArray(events)) return fresh
  return {
    matter: {
      caseId,
      state: typeof matter.state === 'string' ? matter.state : null,
      lagosArea: typeof matter.lagosArea === 'string' ? matter.lagosArea : null,
      area: isPropertyArea(matter.area) ? matter.area : null,
      facts: matter.facts && typeof matter.facts === 'object' && !Array.isArray(matter.facts) ? matter.facts : {},
      status: STATUSES.includes(matter.status as MatterStatus) ? (matter.status as MatterStatus) : 'routing',
    },
    events: events
      .filter((e): e is MatterEvent => !!e && typeof e === 'object' && typeof e.kind === 'string')
      .map((e) => ({ kind: e.kind, payload: e.payload && typeof e.payload === 'object' ? e.payload : {}, createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString() })),
  }
}

/** A MatterRepository over the snapshot. Changes are made to the snapshot itself. */
export function snapshotRepo(snapshot: MatterSnapshot): MatterRepository {
  const { matter } = snapshot
  return {
    async getOrCreateMatter() {
      return { ...matter, facts: { ...matter.facts } }
    },
    async setState(_caseId, state, lagosArea = null) {
      matter.state = state
      matter.lagosArea = lagosArea
    },
    async setArea(_caseId, area) {
      matter.area = area
      matter.status = 'active'
    },
    async setStatus(_caseId, status) {
      matter.status = status
    },
    async mergeFacts(_caseId, facts) {
      matter.facts = { ...matter.facts, ...facts }
      return { ...matter.facts }
    },
    async logEvent(_caseId, kind, payload = {}) {
      snapshot.events.push({ kind, payload, createdAt: new Date().toISOString() })
    },
    async events(_caseId, kind) {
      return snapshot.events.filter((e) => !kind || e.kind === kind)
    },
    async flagForLawyer() {
      // A test matter is never put in the lawyer queue.
    },
  }
}
