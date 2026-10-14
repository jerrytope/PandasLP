import type { JurisdictionGroup } from '../jurisdictions'
import type { PropertyArea } from '../types'
import { documentAreas, PROPERTY_DOCUMENTS, type PropertyDocumentKey } from '../../propertyPricing'

/** One of the seven property areas, as its sub-agent sees it. */
export interface AreaConfig {
  id: PropertyArea
  /** How the area is named to the client, e.g. "recovery of possession". */
  title: string
  /** Live behind PROPERTY_AGENT_V2. Wills & probate and Land disputes come in Phase 4. */
  enabled: boolean
  /** Scope, intake, rules, templates and escalation triggers. The second cached system block. */
  prompt: string
  /** The rules that differ by state group. Only the client's group is sent. */
  jurisdictionRules: Record<JurisdictionGroup, string>
  /** The only cases this area may cite. Lawyer-approved. */
  citableCases: { name: string; principle: string }[]
  handoffs: { to: PropertyArea; when: string }[]
  /** Who signed off the rules, templates and cases, and when. null = not yet. */
  signOff: { by: string; date: string } | null
}

/** The document types this area may emit. */
export function areaDocuments(area: PropertyArea): PropertyDocumentKey[] {
  return (Object.keys(PROPERTY_DOCUMENTS) as PropertyDocumentKey[]).filter((t) => documentAreas(t).includes(area))
}

/** The area's cached system block: its prompt plus the cases, hand-offs and documents it may use. */
export function areaBlock(config: AreaConfig, enabled?: readonly PropertyArea[]): string {
  const cases = config.citableCases.length
    ? config.citableCases.map((c) => `- ${c.name}: ${c.principle}`).join('\n')
    : '- None. Cite no cases in this area.'
  const handoffs = config.handoffs.length
    ? config.handoffs
        .map((h) => enabled && !enabled.includes(h.to)
          ? `- ${h.to} is NOT available yet. When ${h.when} explain why briefly, then call escalate_to_lawyer so a lawyer takes it on.`
          : `- to ${h.to}: ${h.when}`)
        .join('\n')
    : '- None. Anything outside this area is escalated.'
  const docs = areaDocuments(config.id).map((t) => `- ${t}: ${PROPERTY_DOCUMENTS[t].title}`).join('\n')
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AREA: ${config.title.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${config.prompt.trim()}

DOCUMENTS YOU MAY EMIT (emit_document documentType):
${docs}

CITABLE CASES (the only cases you may cite):
${cases}

HAND-OFFS (handoff_to):
${handoffs}`
}
