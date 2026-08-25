export const SERVICES = [
  {
    id: 'small-claims',
    type: 'document',
    title: 'Small Claims (Debt Recovery)',
    tagline: 'Forms SCA 1 & 2',
    description: 'Recover money owed to you through the Small Claims Court process.',
    price: 10000,
    forms: ['SCA 1', 'SCA 2'],
    filingInstructions:
      "Print and sign both forms, then file them at the Small Claims Court registry nearest to the defendant's address. Pay the prescribed filing fee at the registry and obtain a suit number.",
  },
  {
    id: 'tenancy',
    type: 'document',
    title: 'Property Law',
    tagline: 'Tenancy, deeds & recovery',
    description: 'Notices to Quit, tenancy agreements, Deeds of Assignment, and property title search reports.',
    price: 5000,
    forms: ['Notice to Quit', "Notice of Owner's Intention", 'Tenancy Agreement', 'Deed of Assignment', 'Property Search Report'],
    filingInstructions:
      'For notices: sign and have it served personally on the tenant, or through a process server / registered courier with proof of delivery, keeping a copy and proof of service. For agreements and deeds: sign, have witnesses execute, and complete stamping/registration (and Governor\'s Consent, where required) to perfect the document.',
  },
  {
    id: 'contracts',
    type: 'document',
    title: 'Contracts & Agreements',
    tagline: 'NDA, SLA, Employment',
    description: 'Draft a professional, enforceable agreement tailored to your needs.',
    price: 5000,
    forms: ['NDA', 'SLA', 'Employment Agreement'],
    filingInstructions:
      'Both parties should review, sign, and date the agreement. Each party should retain a fully signed copy. No court filing is required unless a dispute arises.',
  },
  {
    id: 'business-registration',
    type: 'document',
    title: 'Business Registration',
    tagline: 'CAC forms',
    description: 'Prepare your CAC registration documents to formally launch your business.',
    price: 15000,
    forms: ['CAC-BN1', 'CAC-IT1'],
    filingInstructions:
      'Submit the prepared forms through the CAC portal (post.cac.gov.ng) along with your means of identification and passport photograph, then pay the applicable CAC fee.',
  },
  {
    id: 'judgment-enforcement',
    type: 'document',
    title: 'Judgment Enforcement',
    tagline: 'Garnishee / Writ of Execution',
    description: 'Enforce a court judgment: we file a Garnishee Order or Writ of Execution to compel payment.',
    // Base price only. AgentChat overrides via PRICE in the document block (₦10,000 + 5% of judgment)
    price: 10000,
  },
]

export const CUSTOM_CLAIM_FEE = 10000
export const LAWYER_CONSULT_FEE = 15000

export function getServiceById(id) {
  return SERVICES.find((s) => s.id === id)
}
