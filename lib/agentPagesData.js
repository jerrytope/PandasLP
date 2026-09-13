/* ─────────────────────────────────────────────────────────────
   Plain data, deliberately NOT inside components/AgentPage.jsx.

   AgentPage.jsx has 'use client' at the top, and reading a named data
   export from a 'use client' module at Server Component module scope
   is not a safe pattern in the App Router — it renders fine when used
   as <AgentPage slug="..." /> (the supported way to use a Client
   Component), but the standalone agent-limits pages and the property
   district pages are Server Components that need this data directly,
   not by rendering the component. Server builds treated AGENT_PAGES as
   undefined when it lived in the client file, which is why this data
   lives in its own plain module instead.

   Every refusal and escalation trigger here is lifted from
   lib/agentCapabilities.ts and lib/agents.ts. Nothing is invented.
   ───────────────────────────────────────────────────────────── */

export const AGENT_PAGES = {
  'debt-recovery': {
    agentId: 'small-claims',
    preview: 'debt',
    crumb: 'Debt Recovery',
    title: 'Debt Recovery',
    price: 'From ₦10,000',
    lede: 'Someone owes you and has stopped replying. We draft the demand letter, a practitioner signs it, and the firm carries it to court.',
    cta: 'Start a recovery matter',
    produces: [
      'LETTER OF DEMAND', 'EVIDENCE REVIEW', 'LIMITATION CHECK', 'ARREARS CALCULATION',
      'DAY 7 FOLLOW-UP', 'DAY 14 FOLLOW-UP', 'SMALL CLAIMS FILING', 'COURT REPRESENTATION',
    ],
    ruleTitle: 'After it goes out, the chasing is ours.',
    rail: [
      { d: '00', t: 'Signed and served' },
      { d: '07', t: 'A firmer notice goes out' },
      { d: '14', t: 'The statutory window closes' },
      { d: '15', t: 'We file at the Small Claims Court', on: true },
    ],
    film: {
      src: '/film/pandas-lp-debt-recovery.mp4',
      poster: '/img/film-poster.jpg',
      title: 'See it end to end.',
      body: 'Seventy six seconds, narrated. One real matter from the first message to the court filing.',
    },
    limits: [
      { t: 'It will not take a matter above the court’s limit', b: 'Over the Small Claims threshold, a counterclaim, disputed liability or any hint of fraud goes to a practitioner instead.' },
      { t: 'It will not invent authority', b: 'No case references, statute sections or monetary limits it is not certain of. It asks you to confirm instead.' },
      { t: 'It will not tell you your odds', b: 'No prediction of winning, no guaranteed timeline. It will tell you where your evidence is thin, which is the useful version.' },
      { t: 'It will not claim to represent you', b: 'Drafting a letter is not appearing in court. Representation is a separate step you agree to.' },
    ],
    fees: [
      { label: 'Letter of demand, drafted and lawyer-reviewed, yours to serve', value: '₦10,000' },
      { label: 'The same letter, served on the debtor by Pandas LP', value: '₦25,000' },
      { label: 'Day 7 and Day 14 follow-ups', value: 'Included', accent: true },
      { label: 'Court filing fees', value: 'Set by the court', muted: true },
    ],
    close: 'Ten minutes of your time.',
  },

  'property-law': {
    agentId: 'recovery-of-premises',
    preview: 'property',
    crumb: 'Property Law',
    title: 'Property Law',
    price: 'From ₦25,000',
    lede: 'Tenancies, notices, deeds and title. You describe the property situation, and it works out which instrument the law actually requires.',
    cta: 'Start a property matter',
    docs: [
      { k: 'RECOVERING POSSESSION', t: 'Notice to Quit', b: 'With the statutory period matched to the tenancy type.' },
      { k: 'RECOVERING POSSESSION', t: 'Seven Days’ Notice', b: 'The separate notice that must follow an expired Notice to Quit.' },
      { k: 'LETTING', t: 'Tenancy and lease agreements', b: 'Terms, rent, repairs, and re-entry on breach.' },
      { k: 'TRANSFER', t: 'Deed of Assignment', b: 'For a sale, including the Governor’s Consent undertaking.' },
      { k: 'TRANSFER', t: 'Deed of Gift', b: 'For a transfer with no price. A different instrument, not a reworded sale.' },
      { k: 'TRANSFER', t: 'Contract for Sale of Land', b: 'The pre-completion agreement, kept distinct from the deed.' },
      { k: 'SECURITY', t: 'Deed of Mortgage', b: 'Legal charge over property, with the perfection steps stated.' },
      { k: 'AUTHORITY', t: 'Power of Attorney', b: 'Specific powers written out one by one, not a blanket authority.' },
      { k: 'DUE DILIGENCE', t: 'Property search', b: 'The firm searches the registry in person. The agent takes the instruction, it does not write the report.' },
    ],
    ruleTitle: 'How long the notice must be.',
    ladder: [
      { k: 'Weekly', v: '1 week' },
      { k: 'Monthly', v: '1 month' },
      { k: 'Quarterly', v: '3 months' },
      { k: 'Yearly', v: '6 months', on: true },
    ],
    ladderNote: 'A notice shorter than the statutory period is void. That is the most common and most expensive mistake in a recovery of premises.',
    limits: [
      { t: 'It will not advise self-help eviction', b: 'Changing locks or removing a tenant without a court order is never on the table. Notice, then court, every time.' },
      { t: 'It will not invent an identifier', b: 'No C of O number, plot number or consideration figure you have not supplied. Unsure of a section, it names the instrument instead.' },
      { t: 'It will not freehand an instrument', b: 'A sublease, a will, anything outside the nine: it gathers the facts and escalates rather than guessing at a structure.' },
      { t: 'It stands down on contested matters', b: 'Live litigation, disputed ownership, squatters, or skipping Governor’s Consent go to a practitioner before any drafting.' },
    ],
    fees: [
      { label: 'Each tenancy or lease document (agreement, notice to quit, recovery of possession)', value: '₦25,000' },
      { label: 'Deeds transferring title. No drafting fee, invoiced by the firm, not paid online', value: '2.5% of the consideration', accent: true },
      { label: 'Deeds of gift, mortgages, powers of attorney, sale agreements', value: '₦30,000' },
      { label: 'Standard property search, carried out by the firm', value: '₦50,000' },
      { label: 'Comprehensive search and due diligence, set by a lawyer', value: 'From ₦100,000', muted: true },
      { label: 'Court filing fees, where a matter goes that far', value: 'Set by the court', muted: true },
    ],
    close: 'Describe the property. We work out the instrument.',
  },
}
