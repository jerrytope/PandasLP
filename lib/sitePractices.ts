// The practice areas as the public site presents them: the menu, the homepage, the footer.
// Facts only: names, prices and documents come from lib/agentPagesData.js and lib/propertyPricing.ts
// (via the agent pages), and availability is kept in step with app/agents/page.tsx. Two practices
// are open today; the other four are written and priced but not open, and the site says so.

export interface LivePractice {
  slug: string
  href: string
  agentId: string
  name: string
  price: string
  line: string
  documents: string[]
}

export const LIVE_PRACTICES: LivePractice[] = [
  {
    slug: 'debt-recovery',
    href: '/agents/debt-recovery',
    agentId: 'small-claims',
    name: 'Debt recovery',
    price: 'From ₦10,000',
    line: 'Demand letter, Day 7 and Day 14 follow-ups, then filing at the Small Claims Court.',
    documents: ['Letter of demand', 'Day 7 and Day 14 follow-ups', 'Small Claims filing'],
  },
  {
    slug: 'property-law',
    href: '/agents/property-law',
    agentId: 'recovery-of-premises',
    name: 'Property law',
    price: 'From ₦25,000',
    line: 'Notices to quit, tenancy and lease documents, deeds, and property searches by the firm.',
    documents: ['Notice to quit', 'Tenancy and lease agreements', 'Deed of assignment', 'Property search'],
  },
]

export const OPENING_LATER: { name: string; line: string }[] = [
  { name: 'Judgment enforcement', line: 'For when a debtor has lost in court and still has not paid.' },
  { name: 'Lawyer consultation', line: 'For matters that need judgment and conversation, not a document.' },
  { name: 'Contracts and commercial', line: 'NDAs, employment, partnership and vendor agreements.' },
  { name: 'CAC registration', line: 'Business name or company registration, as a guided conversation.' },
]

/** The documents the homepage carousel shows, each as a short paper preview. */
export const DRAFTED_DOCUMENTS: {
  practice: string
  agentId: string
  title: string
  price: string
  reference: string
  body: string[]
}[] = [
  {
    practice: 'Debt recovery',
    agentId: 'small-claims',
    title: 'Letter of demand',
    price: '₦10,000, or ₦25,000 served by us',
    reference: 'PLP · Debt recovery',
    body: [
      'Our client instructs us that you owe the sum stated below, being the balance due on the invoice attached to this letter.',
      'TAKE NOTICE that unless the said sum is paid within fourteen (14) days of the receipt of this letter, we have firm instructions to commence proceedings against you without further notice.',
    ],
  },
  {
    practice: 'Property law',
    agentId: 'recovery-of-premises',
    title: 'Notice to quit',
    price: '₦25,000',
    reference: 'PLP · Recovery of premises',
    body: [
      'TAKE NOTICE that our Client hereby gives you notice to QUIT AND DELIVER UP vacant possession of the premises which you hold as our Client’s tenant,',
      'on or before the date stated, being the expiration of the notice period the law requires for your tenancy.',
    ],
  },
  {
    practice: 'Property law',
    agentId: 'recovery-of-premises',
    title: 'Seven days’ notice',
    price: '₦25,000',
    reference: 'PLP · Recovery of premises',
    body: [
      'Notice of the owner’s intention to apply to recover possession, served only after the notice to quit has expired.',
      'TAKE NOTICE that unless peaceable possession is delivered within seven (7) days, our Client will apply to the court to recover possession.',
    ],
  },
  {
    practice: 'Property law',
    agentId: 'recovery-of-premises',
    title: 'Tenancy agreement',
    price: '₦25,000',
    reference: 'PLP · Letting',
    body: [
      'THIS TENANCY AGREEMENT is made BETWEEN the Landlord of the one part AND the Tenant of the other part.',
      '1. RENT. The Tenant shall pay the rent stated in the Schedule, in advance, on the dates agreed. 2. REPAIRS. …',
    ],
  },
  {
    practice: 'Property law',
    agentId: 'recovery-of-premises',
    title: 'Deed of assignment',
    price: '2.5% of the consideration',
    reference: 'PLP · Transfer',
    body: [
      'THIS DEED OF ASSIGNMENT is made BETWEEN the Assignor of the one part AND the Assignee of the other part.',
      'The Assignor undertakes to obtain the consent of the Governor to this assignment, as section 22 of the Land Use Act requires.',
    ],
  },
  {
    practice: 'Property law',
    agentId: 'recovery-of-premises',
    title: 'Property search',
    price: 'From ₦50,000',
    reference: 'PLP · Due diligence',
    body: [
      'Instruction to search the land registry for the property described below, carried out in person by the firm.',
      'The report states the registered owner, any encumbrances recorded, and anything the registry could not confirm.',
    ],
  },
]

export const FIRM = {
  name: 'Pandas LP',
  registration: 'CAC BN 9646741',
  email: 'pandaslegalpractitioners@gmail.com',
  phone: '+234 811 808 0189',
  phoneHref: 'tel:+2348118080189',
  address: ['3B Elegba Festival Drive, Oniru', 'Victoria Island, Lagos'],
}
