import type { AgentId } from './agents'

// Marketing-facing "what this agent actually does" copy for the homepage's Capabilities
// modal — kept separate from the agent's systemPrompt (which is written for the model, not a
// visitor) but grounded in the same real scope. No accuracy/speed statistics here: none have
// ever been measured for any of these agents, so none are quoted (see docs/property-law-agent-test-plan.md
// for why that measurement doesn't exist yet). `safeguards` is drawn directly from each
// agent's real ESCALATION / HALLUCINATION PREVENTION / ETHICAL LIMITS rules in lib/agents.ts —
// presented plainly, no animation or dramatization.

export type AgentAvailability = 'live' | 'testing' | 'soon'

export interface AgentCapabilities {
  availability: AgentAvailability
  highlights: string[]
  differentiator: string
  safeguards: string[]
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
    safeguards: [
      'A licensed Pandas LP lawyer reviews and signs every letter before it is served — never sent as drafted, unreviewed',
      'Escalates to a human lawyer if the debt exceeds the Small Claims Court limit, there is a counterclaim or disputed liability, or the matter involves fraud or criminal conduct',
      'Never invents case references, statute sections, or monetary limits it is not certain of — asks you to confirm instead',
      'Never claims to represent you in court at the letter stage — courtroom representation is a separate, explicit step',
    ],
  },
  'recovery-of-premises': {
    availability: 'live',
    highlights: [
      'Notices to Quit and Seven-Day Notices, with the correct statutory notice period for the tenancy type',
      'Tenancy and lease agreements',
      'Deeds of Assignment, Gift, and Legal Mortgage, with Governor\'s Consent handling under the Land Use Act',
      'Powers of Attorney and Agreements for Sale of Land',
      'Property searches: the agent takes the instruction, the firm carries out the search and writes the report',
    ],
    differentiator: 'Covers nine distinct Nigerian property-law document types end to end, from a single guided conversation, instead of separate consultations for each.',
    safeguards: [
      'Each document type is checked against its own reviewer checklist (e.g. Governor\'s Consent clause present, correct execution block for a company or Power-of-Attorney signatory) before it can be marked reviewed — not a single toggle',
      'Escalates to a human lawyer for active litigation, disputed ownership, squatters, or a client intending to skip Governor\'s Consent entirely',
      'Never advises self-help eviction — changing locks or removing a tenant without a court order — always the notice-then-court process',
      'Never invents a C of O number, plot number, or consideration figure you have not provided',
      'Escalates rather than freehands anything outside its nine covered document types (e.g. Deed of Sublease, Wills)',
    ],
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
    safeguards: [
      'Escalates to a human lawyer for contracts over ₦50 million with complex risk allocation, regulated-sector licensing (CBN, SEC, NAFDAC, NCC), foreign parties, or an existing active dispute',
      'Never invents case law citations or statute references it is not certain of',
      'Drafts agreements only — does not advise on commercial terms, tax treatment, or represent either party',
    ],
  },
  'cac-registration': {
    availability: 'soon',
    highlights: [
      'Business Name or full company (Limited Liability) registration guidance',
      'Document checklist and CAC filing preparation',
      'Explains the real difference between a Business Name and an RC company registration',
    ],
    differentiator: 'Registering a company in Nigeria usually means learning CAC\'s process from scratch. This turns it into a guided conversation.',
    safeguards: [
      'Escalates to a human lawyer if foreign directors or shareholders are involved, the business is in a regulated sector, or there is a dispute among proposed shareholders/directors',
      'Never invents CAC form numbers or fee amounts',
      'Never guarantees name availability or processing timelines — those depend on the CAC portal, not this agent',
    ],
  },
  'judgment-enforcement': {
    availability: 'soon',
    highlights: [
      'For when a debtor has lost in court but still hasn\'t paid',
      'Prepares Garnishee Order or Writ of Execution filings',
      'Priced as a base fee plus a percentage of the judgment, so cost scales with what\'s actually owed',
    ],
    differentiator: 'Winning a case is not the same as getting paid. This picks up exactly where a court judgment leaves off.',
    safeguards: [
      'Escalates to a human lawyer if the debtor has appealed, applied for a stay of execution, is a government body, or the assets are subject to a competing claim',
      'Never invents court rules or fee schedules, and never guarantees an enforcement timeline',
      'Never advises on priority between competing judgment creditors without flagging the complexity to a lawyer',
    ],
  },
  'lawyer-consultation': {
    availability: 'soon',
    highlights: [
      'Book real time with a licensed Nigerian lawyer',
      'For matters that need judgment and conversation, not just a document',
      'The honest option when a situation doesn\'t fit a template',
    ],
    differentiator: 'Not every legal problem should be templated. This is the option for when it genuinely needs a human lawyer\'s judgment.',
    safeguards: [
      'Flags limitation periods, active court deadlines, criminal exposure, matters involving children, and personal-safety risks for direct lawyer attention',
      'Never predicts the outcome or odds of success of a case',
      'Never states a specific statute section unless certain of it',
    ],
  },
}
