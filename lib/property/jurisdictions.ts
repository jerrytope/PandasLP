// The states the Property Law Agent covers, grouped by the law that applies, and the block of
// jurisdiction rules each area's prompt gets for the client's state. Any other state is
// escalated to a lawyer. PENDING LAWYER SIGN-OFF (docs/property_agent_plans/, task 2.15).

import { jurisdictionOf, LAGOS_EXCLUDED_AREAS } from './calc'

export type JurisdictionGroup = 'lagos' | 'fct' | 'western' | 'ca'

/** The covered states, as stored on property_matters.state. */
export const SUPPORTED_STATES = [
  'Lagos', 'FCT', 'Oyo', 'Ogun', 'Ondo', 'Osun', 'Ekiti', 'Edo', 'Delta', 'Anambra', 'Enugu', 'Cross River',
] as const

export type SupportedState = (typeof SUPPORTED_STATES)[number]

const GROUP: Record<SupportedState, JurisdictionGroup> = {
  Lagos: 'lagos',
  FCT: 'fct',
  Oyo: 'western', Ogun: 'western', Ondo: 'western', Osun: 'western', Ekiti: 'western', Edo: 'western', Delta: 'western',
  Anambra: 'ca', Enugu: 'ca', 'Cross River': 'ca',
}

export const GROUP_LABELS: Record<JurisdictionGroup, string> = {
  lagos: 'Lagos State',
  fct: 'the Federal Capital Territory (Abuja)',
  western: 'a Western state (Property and Conveyancing Law 1959 applies)',
  ca: 'a state where the English Conveyancing Acts still apply',
}

const ALIASES: Record<string, SupportedState> = {
  abuja: 'FCT',
  'fct abuja': 'FCT',
  'fct (abuja)': 'FCT',
  'federal capital territory': 'FCT',
  'cross-river': 'Cross River',
  crossriver: 'Cross River',
}

/** The covered state a client's answer names ("lagos state", "Abuja"), or null if none. */
export function normaliseState(input: string): SupportedState | null {
  const cleaned = input.trim().toLowerCase().replace(/\s+state$/, '').replace(/[.]/g, '').replace(/\s+/g, ' ')
  if (ALIASES[cleaned]) return ALIASES[cleaned]
  return SUPPORTED_STATES.find((s) => s.toLowerCase() === cleaned) ?? null
}

const ALL_NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi',
  'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

function mentions(text: string, name: string): boolean {
  return new RegExp(`\\b${name.replace(/\s+/g, '[\\s-]+')}\\b`, 'i').test(text)
}

/**
 * The state a client's answer names, whether it is a button ("FCT (Abuja)") or a sentence
 * ("it's in Ikeja, Lagos"): a covered state, 'unsupported' for another Nigerian state, or null
 * when no single state can be read from it.
 */
export function findStateInText(text: string): SupportedState | 'unsupported' | null {
  const exact = normaliseState(text)
  if (exact) return exact
  const covered = new Set<SupportedState>()
  for (const s of SUPPORTED_STATES) if (mentions(text, s)) covered.add(s)
  if (/\b(abuja|fct|federal capital territory)\b/i.test(text)) covered.add('FCT')
  if (covered.size === 1) return [...covered][0]
  if (covered.size > 1) return null
  return ALL_NIGERIAN_STATES.some((s) => mentions(text, s)) ? 'unsupported' : null
}

export function groupOf(state: string): JurisdictionGroup | null {
  const s = normaliseState(state)
  return s ? GROUP[s] : null
}

/** Lagos areas the client picks from, for the Apapa / Ikeja GRA / Ikoyi / VI exception. */
export const LAGOS_AREA_OPTIONS: { label: string; value: string }[] = [
  { label: 'Ikoyi', value: 'ikoyi' },
  { label: 'Victoria Island', value: 'victoria-island' },
  { label: 'Apapa', value: 'apapa' },
  { label: 'Ikeja GRA', value: 'ikeja-gra' },
  { label: 'Elsewhere in Lagos', value: 'elsewhere' },
]

/** The stored Lagos area for a client's answer, or null if it isn't one of the options. */
export function normaliseLagosArea(input: string): string | null {
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, ' ')
  const option = LAGOS_AREA_OPTIONS.find((o) => o.label.toLowerCase() === cleaned || o.value === cleaned.replace(/ /g, '-'))
  if (option) return option.value
  if (cleaned === 'vi') return 'victoria-island'
  return null
}

const LAGOS_AREA_LABEL = Object.fromEntries(LAGOS_AREA_OPTIONS.map((o) => [o.value, o.label]))

/**
 * The jurisdiction block for an area prompt: where the property is and which law applies.
 * Kept short and generic; each area adds its own per-group rules.
 */
export function jurisdictionBlock(state: SupportedState, lagosArea: string | null): string {
  const group = GROUP[state]
  const lines = [`JURISDICTION: The property is in ${state === 'FCT' ? 'the FCT (Abuja)' : `${state} State`}${state === 'Lagos' && lagosArea ? ` (${LAGOS_AREA_LABEL[lagosArea] ?? lagosArea})` : ''}. Apply only the rules for ${GROUP_LABELS[group]} below. Never apply another state's law.`]
  if (state === 'Lagos' && jurisdictionOf('Lagos', lagosArea) === 'lagos-excluded-area') {
    lines.push(`LAGOS EXCLUDED AREA: the Tenancy Law of Lagos State 2011 does NOT apply in ${(LAGOS_EXCLUDED_AREAS as readonly string[]).map((a) => LAGOS_AREA_LABEL[a]).join(', ')}. For tenancy and recovery matters there, homes fall under the Rent Control and Recovery of Residential Premises Law 1997 and business premises under the Recovery of Premises Law. Notice periods are the same; name the right law. The Tenancy Law's advance-rent limits and arrears rule do not apply.`)
  }
  return lines.join('\n\n')
}
