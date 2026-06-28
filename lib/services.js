export const SERVICES = [
  {
    id: 'small-claims',
    type: 'document',
    title: 'Small Claims (Debt Recovery)',
    tagline: 'Forms SCA 1 & 2',
    description: 'Recover money owed to you through the Small Claims Court process.',
    price: 5000,
    forms: ['SCA 1', 'SCA 2'],
    fields: [
      { name: 'claimantName', label: 'Your Full Name', type: 'text', required: true },
      { name: 'claimantAddress', label: 'Your Address', type: 'text', required: true },
      { name: 'defendantName', label: "Debtor's Full Name", type: 'text', required: true },
      { name: 'defendantAddress', label: "Debtor's Address", type: 'text', required: true },
      { name: 'debtAmount', label: 'Amount Owed (₦)', type: 'number', required: true },
      { name: 'debtDate', label: 'Date Debt Was Incurred', type: 'date', required: true },
      { name: 'debtDescription', label: 'Description of Debt', type: 'textarea', required: true },
      { name: 'evidence', label: 'Upload Supporting Evidence', type: 'file', required: false },
    ],
    filingInstructions: 'Print and sign both forms, then file them at the Small Claims Court registry nearest to the defendant\'s address. Pay the prescribed filing fee at the registry and obtain a suit number.',
  },
  {
    id: 'tenancy',
    type: 'document',
    title: 'Tenancy & Quit Notices',
    tagline: 'Statutory notices',
    description: 'Generate a valid statutory notice to recover your rented property.',
    price: 5000,
    forms: ['Notice to Quit', 'Notice of Owner\'s Intention'],
    fields: [
      { name: 'landlordName', label: "Landlord's Full Name", type: 'text', required: true },
      { name: 'landlordAddress', label: "Landlord's Address", type: 'text', required: true },
      { name: 'tenantName', label: "Tenant's Full Name", type: 'text', required: true },
      { name: 'propertyAddress', label: 'Property Address', type: 'text', required: true },
      { name: 'noticeType', label: 'Notice Type', type: 'select', required: true, options: ['7 Days', '1 Month', '3 Months', '6 Months'] },
      { name: 'rentAmount', label: 'Annual Rent (₦)', type: 'number', required: true },
      { name: 'leaseStart', label: 'Lease Start Date', type: 'date', required: true },
      { name: 'reason', label: 'Reason for Notice', type: 'textarea', required: true },
    ],
    filingInstructions: 'Sign the notice and have it served personally on the tenant, or through a process server / registered courier with proof of delivery. Keep a copy and the proof of service for your records.',
  },
  {
    id: 'contracts',
    type: 'document',
    title: 'Contracts & Agreements',
    tagline: 'NDA, SLA, Employment',
    description: 'Draft a professional, enforceable agreement tailored to your needs.',
    price: 5000,
    forms: ['NDA', 'SLA', 'Employment Agreement'],
    fields: [
      { name: 'contractType', label: 'Contract Type', type: 'select', required: true, options: ['NDA', 'SLA', 'Employment Agreement'] },
      { name: 'partyAName', label: 'Party A Name', type: 'text', required: true },
      { name: 'partyAAddress', label: 'Party A Address', type: 'text', required: true },
      { name: 'partyBName', label: 'Party B Name', type: 'text', required: true },
      { name: 'partyBAddress', label: 'Party B Address', type: 'text', required: true },
      { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
      { name: 'duration', label: 'Term / Duration', type: 'text', required: true },
      { name: 'keyTerms', label: 'Key Terms', type: 'textarea', required: true },
    ],
    filingInstructions: 'Both parties should review, sign, and date the agreement. Each party should retain a fully signed copy. No court filing is required unless a dispute arises.',
  },
  {
    id: 'business-registration',
    type: 'document',
    title: 'Business Registration',
    tagline: 'CAC forms',
    description: 'Prepare your CAC registration documents to formally launch your business.',
    price: 15000,
    forms: ['CAC-BN1', 'CAC-IT1'],
    fields: [
      { name: 'businessName', label: 'Proposed Business Name', type: 'text', required: true },
      { name: 'altBusinessName', label: 'Alternative Business Name', type: 'text', required: false },
      { name: 'businessType', label: 'Business Type', type: 'select', required: true, options: ['Sole Proprietorship', 'Limited Liability Company', 'Partnership'] },
      { name: 'registeredAddress', label: 'Registered Business Address', type: 'text', required: true },
      { name: 'ownerName', label: "Owner's Full Name", type: 'text', required: true },
      { name: 'ownerId', label: "Owner's ID Number (NIN/Passport)", type: 'text', required: true },
      { name: 'natureOfBusiness', label: 'Nature of Business', type: 'textarea', required: true },
    ],
    filingInstructions: 'Submit the prepared forms through the CAC portal (post.cac.gov.ng) along with your means of identification and passport photograph, then pay the applicable CAC fee.',
  },
]

export const CUSTOM_CLAIM_FEE = 2000
export const LAWYER_CONSULT_FEE = 15000

export function getServiceById(id) {
  return SERVICES.find((s) => s.id === id)
}
