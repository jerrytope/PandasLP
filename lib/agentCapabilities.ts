import type { AgentId } from './agents'

// Marketing-facing "what this agent actually does" copy for the homepage's Capabilities
// modal — kept separate from the agent's systemPrompt (which is written for the model, not a
// visitor) but grounded in the same real scope. No accuracy/speed statistics here: none have
// ever been measured for any of these agents, so none are quoted (see docs/property-law-agent-test-plan.md
// for why that measurement doesn't exist yet).

export type AgentAvailability = 'live' | 'testing' | 'soon'

export interface AgentCapabilities {
  availability: AgentAvailability
  highlights: string[]
  differentiator: string
}

export const AGENT_CAPABILITIES: Record<AgentId, AgentCapabilities> = {
  'small-claims': {
    availability: 'live',
    highlights: [
      'Guided interview to establish who owes you, how much, and why',
      'Court-ready Letter of Demand on Pandas LP letterhead',
      'A licensed lawyer serves it — self-serve PDF or Pandas LP delivers it for you',
      'Automatic Day 0 / 7 / 14 follow-up tracking, with escalation to court filing if ignored',
    ],
    differentiator: 'A traditional retainer for a demand letter typically takes days of back-and-forth to schedule and draft. This is a guided interview measured in minutes, reviewed by a licensed lawyer before it goes out.',
  },
  'recovery-of-premises': {
    availability: 'soon',
    highlights: [
      'Notices to Quit and Seven-Day Notices, with the correct statutory notice period for the tenancy type',
      'Tenancy and lease agreements',
      'Deeds of Assignment, Gift, and Legal Mortgage, with Governor\'s Consent handling under the Land Use Act',
      'Powers of Attorney, Agreements for Sale of Land, and property title search reports',
    ],
    differentiator: 'Covers nine distinct Nigerian property-law document types end to end, from a single guided conversation, instead of separate consultations for each.',
  },
  contracts: {
    availability: 'soon',
    highlights: [
      'NDAs, employment and contractor agreements, service agreements',
      'Partnership, joint-venture, and vendor agreements',
      'IP assignments, MoUs, and data-processing agreements',
      'Clause set assembled from your actual answers, not a static template you edit yourself',
    ],
    differentiator: 'Most template sites hand you a generic document to edit alone. This asks about your specific deal first, then assembles the clauses that actually apply.',
  },
  'cac-registration': {
    availability: 'soon',
    highlights: [
      'Business Name or full company (Limited Liability) registration guidance',
      'Document checklist and CAC filing preparation',
      'Explains the real difference between a Business Name and an RC company registration',
    ],
    differentiator: 'Registering a company in Nigeria usually means learning CAC\'s process from scratch. This turns it into a guided conversation.',
  },
  'judgment-enforcement': {
    availability: 'testing',
    highlights: [
      'For when a debtor has lost in court but still hasn\'t paid',
      'Prepares Garnishee Order or Writ of Execution filings',
      'Priced as a base fee plus a percentage of the judgment, so cost scales with what\'s actually owed',
    ],
    differentiator: 'Winning a case is not the same as getting paid. This picks up exactly where a court judgment leaves off.',
  },
  'lawyer-consultation': {
    availability: 'testing',
    highlights: [
      'Book real time with a licensed Nigerian lawyer',
      'For matters that need judgment and conversation, not just a document',
      'The honest option when a situation doesn\'t fit a template',
    ],
    differentiator: 'Not every legal problem should be templated. This is the option for when it genuinely needs a human lawyer\'s judgment.',
  },
}
