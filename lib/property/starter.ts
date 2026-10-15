// The rebuilt Property Law Agent's opening menu and the questions the router asks without a
// model call (area, state, Lagos area). No server-only imports: lib/agents.ts uses the starter
// in the browser.

import type { PropertyArea } from './types'

/** The switch for the rebuilt agent. NEXT_PUBLIC_ so the browser shows the matching starter. */
export function propertyAgentV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_PROPERTY_AGENT_V2 === 'true'
}

export const AREA_BUTTONS: { label: string; area: PropertyArea }[] = [
  { label: 'Get a tenant out of my property', area: 'recovery' },
  { label: 'A tenancy, lease or sublease agreement', area: 'tenancy' },
  { label: 'Buying or selling property (Deed of Assignment)', area: 'conveyancing' },
  { label: 'A gift, mortgage, power of attorney, sale agreement or release', area: 'other-instruments' },
  { label: 'Search a property before I buy it', area: 'searches' },
  { label: 'A will, or a dead relative\'s estate', area: 'wills-probate' },
  { label: 'A dispute over who owns land', area: 'land-dispute' },
]
export const SOMETHING_ELSE = 'Something else'

// The current agent's starter buttons, still mapped so a chat opened before the switch keeps working.
const LEGACY_BUTTONS: { label: string; area: PropertyArea | 'something-else' }[] = [
  { label: 'Recover possession from a tenant (Notice to Quit / Seven-Day Notice)', area: 'recovery' },
  { label: 'Draft a tenancy or lease agreement', area: 'tenancy' },
  { label: 'Prepare a Deed of Assignment (property sold for a price)', area: 'conveyancing' },
  { label: 'Prepare a Deed of Gift (property given, no payment)', area: 'other-instruments' },
  { label: 'Draw up a Power of Attorney', area: 'other-instruments' },
  { label: 'Draw up a Deed of Mortgage / Legal Charge', area: 'other-instruments' },
  { label: 'Draft a Contract for Sale of Land', area: 'other-instruments' },
  { label: 'Search a property before I buy it (title / due diligence)', area: 'searches' },
  { label: 'Something else property-related', area: 'something-else' },
]

function norm(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** The area a starter button names, 'something-else', or null for free text. */
export function areaFromButton(text: string): PropertyArea | 'something-else' | null {
  const t = norm(text)
  if (t === norm(SOMETHING_ELSE)) return 'something-else'
  const hit = [...AREA_BUTTONS, ...LEGACY_BUTTONS].find((b) => norm(b.label) === t)
  return hit ? hit.area : null
}

function options(lines: string[]): string {
  return `<<<OPTIONS>>>\n${lines.join('\n')}\n<<<END_OPTIONS>>>`
}

export const PROPERTY_V2_STARTER = `Hello! I'm your Property Law Agent. I handle Nigerian property matters end to end: getting a tenant out, tenancy and lease agreements, buying and selling property, gifts, mortgages and powers of attorney, property searches, wills and estates, and land disputes.

**What do you need help with?**
${options([...AREA_BUTTONS.map((b) => b.label), SOMETHING_ELSE])}`

export const DESCRIBE_PROMPT = 'Of course. Tell me in a sentence or two what is happening and what you would like to achieve, and I will take it from there.'

export const STATE_BUTTONS = ['Lagos', 'FCT (Abuja)', 'Ogun', 'Oyo', 'Osun', 'Ondo', 'Ekiti', 'Edo', 'Delta', 'Anambra', 'Enugu', 'Cross River']
export const ANOTHER_STATE = 'Another state'

export function stateQuestion(lead = ''): string {
  return `${lead ? `${lead}\n\n` : ''}Property law differs from state to state, so first: **which state is the property in?**
${options([...STATE_BUTTONS, ANOTHER_STATE])}`
}

export function stateNotUnderstood(): string {
  return stateQuestion("I didn't catch which state that is.")
}

export const LAGOS_AREA_BUTTONS = ['Ikoyi', 'Victoria Island', 'Apapa', 'Ikeja GRA', 'Elsewhere in Lagos']

export function lagosAreaQuestion(lead = ''): string {
  return `${lead ? `${lead}\n\n` : ''}A few parts of Lagos have different rules. **Is the property in one of these areas?**
${options(LAGOS_AREA_BUTTONS)}`
}

export const ESCALATED_REPLY = 'A Pandas LP lawyer is now handling this matter and will contact you directly. If there is anything else you would like them to know, tell me here and it will be on your file.'

export const UNSUPPORTED_STATE_REPLY = "Thank you. We don't yet handle property matters in that state through this chat, so I've passed your matter to a Pandas LP lawyer, who will contact you directly about how we can help."

export const CLOSED_REPLY = 'This matter has been closed by Pandas LP. To start something new, open the Property Law Agent again from the menu, or contact us if you have a question about this matter.'

export const AREA_NOT_LIVE_REPLY = "Thank you. That kind of matter is handled directly by our lawyers for now, so I've passed it to a Pandas LP lawyer, who will contact you shortly."
