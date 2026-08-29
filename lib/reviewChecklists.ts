// Per-document-type review checklists — currently covers the Property Law Agent's document
// types, with a generic fallback for every other agent. Built in response to a claude-council
// review that found the single reviewed_at toggle didn't force checking anything specific — it
// let a real, live defect (a missing Governor's Consent clause) ship silently because there was
// no substantive per-document check behind the click, just the click itself.
//
// Matching is by keyword against the case's document_title — freeform text the AI generates,
// not a fixed enum — rather than exact string equality, so minor LLM phrasing differences don't
// silently skip the gate. If nothing matches, GENERIC_CHECKLIST always applies: there is never a
// zero-item gate.

export interface ReviewChecklistItem {
  id: string
  label: string
}

const GENERIC_CHECKLIST: ReviewChecklistItem[] = [
  { id: 'parties', label: 'Party names, addresses, and roles are complete and correctly spelled' },
  { id: 'figures', label: 'All figures/dates are internally consistent and match what the client actually provided' },
  { id: 'no-placeholders', label: 'No bracketed placeholders or template instructions remain in the document text' },
]

interface ChecklistRule {
  matches: (title: string) => boolean
  items: ReviewChecklistItem[]
  // Documents that transfer, charge, or authorise transfer of an interest in land — flagged
  // for a recommended (not currently enforced — see app/admin/page.tsx) independent second
  // reviewer, since these carry the highest malpractice exposure per document.
  highRisk: boolean
}

const RULES: ChecklistRule[] = [
  {
    matches: (t) => t.includes('notice to quit'),
    items: [
      { id: 'state-law', label: 'Correct state law applied for the notice period (not assumed to be Lagos)' },
      { id: 'notice-period', label: 'Notice period matches the tenancy type stated by the client' },
      { id: 'grounds', label: 'Grounds for termination are specific, not vague ("outstanding rent" style language)' },
    ],
    highRisk: false,
  },
  {
    matches: (t) => t.includes('seven') && t.includes('notice'),
    items: [
      { id: 'prior-notice', label: "Prior Notice to Quit's date and expiry are stated and consistent with the client's account" },
      { id: 'mesne-profits', label: 'Mesne profits rate is a real figure the client supplied, not invented' },
    ],
    highRisk: false,
  },
  {
    matches: (t) => t.includes('tenancy agreement') || t.includes('lease'),
    items: [
      { id: 'rent-consistency', label: 'Rent amount, frequency, and deposit are internally consistent' },
      { id: 'execution-block', label: "Execution block matches each party's actual type (individual/company/etc.), not defaulted blindly" },
    ],
    highRisk: false,
  },
  {
    matches: (t) => t.includes('deed of assignment'),
    items: [
      { id: 'consent-clause', label: "Governor's Consent clause (Land Use Act s.22) is present" },
      { id: 'consideration', label: 'Consideration figure matches what the client actually disclosed' },
      { id: 'execution-block', label: "Execution block matches each party's actual type" },
    ],
    highRisk: true,
  },
  {
    matches: (t) => t.includes('deed of gift'),
    items: [
      { id: 'consent-clause', label: "Governor's Consent clause (Land Use Act s.22) is present" },
      { id: 'no-consideration', label: 'No consideration/price figure appears anywhere — this is a gift, not a sale' },
      { id: 'execution-block', label: "Execution block matches each party's actual type" },
    ],
    highRisk: true,
  },
  {
    matches: (t) => t.includes('power of attorney'),
    items: [
      { id: 'specific-powers', label: 'Every power is specific (lease/sell/mortgage/collect rent), never a vague "to manage"' },
      { id: 'irrevocability', label: 'Irrevocability clause (if any) matches whether consideration was actually paid for it' },
    ],
    highRisk: true,
  },
  {
    matches: (t) => t.includes('mortgage'),
    items: [
      { id: 'consent-clause', label: "Governor's Consent clause (Land Use Act s.22) is present" },
      { id: 'loan-terms', label: 'Principal, interest rate, and repayment date are internally consistent' },
      { id: 'guarantor', label: 'A guarantor, if disclosed by the client, is correctly reflected as a party' },
    ],
    highRisk: true,
  },
  {
    matches: (t) => t.includes('sale of land') || t.includes('sale agreement') || t.includes('contract for sale'),
    items: [
      { id: 'deposit-balance', label: 'Deposit + balance sum to the stated total consideration' },
      { id: 'completion', label: 'Completion date and place are stated' },
      { id: 'consent-clause', label: "Governor's Consent undertaking is present" },
    ],
    highRisk: true,
  },
  {
    matches: (t) => t.includes('search report'),
    items: [
      { id: 'encumbrances-stated', label: 'Encumbrances section explicitly states findings or "NIL" — never left blank' },
      { id: 'not-overpromised', label: 'Report does not guarantee registry outcomes or imply a formal registry search was actually conducted' },
    ],
    highRisk: false,
  },
]

function matchRule(documentTitle: string | null | undefined): ChecklistRule | undefined {
  const title = (documentTitle ?? '').toLowerCase()
  return RULES.find((r) => r.matches(title))
}

export function getReviewChecklist(documentTitle: string | null | undefined): ReviewChecklistItem[] {
  const rule = matchRule(documentTitle)
  return rule ? [...rule.items, ...GENERIC_CHECKLIST] : GENERIC_CHECKLIST
}

export function isHighRiskDocument(documentTitle: string | null | undefined): boolean {
  return matchRule(documentTitle)?.highRisk ?? false
}
