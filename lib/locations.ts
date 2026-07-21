export interface StateData {
  slug: string
  name: string
  claimLimit: number
  // Shown only when present — flags a figure that needs a human check before the page goes
  // indexed, distinct from the general "verified" gate below (this note stays visible even
  // after verification if the underlying ambiguity in the source material is never resolved).
  claimLimitNote?: string
  courtInfo: string
  // 14 for Lagos (see lib/agents.ts's demand letter templates for the same figure, sourced
  // from Form SCA 1). null everywhere else — each state has its own Practice Direction and
  // this session has not verified any of them beyond Lagos's.
  responsePeriodDays: number | null
  // Gates both indexing (see generateMetadata in app/recover-debt/[state]/page.tsx) and
  // sitemap inclusion (app/sitemap.ts). Flip to true only once the founder or a licensed
  // Nigerian lawyer has confirmed the figures on this page against the actual registry.
  verified: boolean
  faqs: { question: string; answer: string }[]
}

const GENERIC_FAQS = (name: string): StateData['faqs'] => [
  {
    question: `Do I need a lawyer to use the Small Claims Court in ${name}?`,
    answer:
      'No. Nigeria\'s Small Claims Courts are specifically designed for self-representation — lawyers are generally not permitted to appear for either party in the hearing itself. Where Pandas LP helps is earlier: preparing your Letter of Demand and, if you choose, serving it and filing the claim on your behalf.',
  },
  {
    question: 'What happens before I can file a claim?',
    answer:
      'You must first send the person who owes you a Letter of Demand and give them a chance to pay before you can file at the Small Claims Court. This is a mandatory step, not optional — the court will expect proof you sent one.',
  },
  {
    question: 'What kind of claims does this court handle?',
    answer:
      'Simple, liquidated money claims only — a specific, undisputed sum owed to you. It does not handle land disputes, criminal matters, or claims where the amount is genuinely contested on complex legal grounds.',
  },
]

export const STATES: StateData[] = [
  {
    slug: 'lagos',
    name: 'Lagos',
    claimLimit: 5_000_000,
    courtInfo:
      'Lagos State\'s Small Claims Courts sit across its magisterial districts, including Ikeja, Lagos (Island), Yaba, Apapa, Ikorodu, Badagry, and Epe. You file in the district covering where the person who owes you lives, works, or does business.',
    responsePeriodDays: 14,
    verified: false,
    faqs: GENERIC_FAQS('Lagos'),
  },
  {
    slug: 'abuja-fct',
    name: 'Abuja (FCT)',
    claimLimit: 7_000_000,
    claimLimitNote:
      'Sourced from the FCT Small Claims Court handbook, but the underlying text may describe this figure specifically for counterclaims rather than the primary claim limit — confirm before this page is indexed.',
    courtInfo: 'The FCT Small Claims Court registry sits at Plot 426, Tigris Crescent, Aguiyi Ironsi Street, Abuja.',
    responsePeriodDays: null,
    verified: false,
    faqs: GENERIC_FAQS('Abuja'),
  },
  {
    slug: 'rivers',
    name: 'Rivers State',
    claimLimit: 5_000_000,
    courtInfo:
      'Rivers State operates five Small Claims Courts within the Port Harcourt Magisterial District, with further courts in the state\'s other magisterial districts. You can file where you or the person who owes you lives, works, or does business anywhere in the state.',
    responsePeriodDays: null,
    verified: false,
    faqs: GENERIC_FAQS('Rivers State'),
  },
  {
    slug: 'kano',
    name: 'Kano State',
    claimLimit: 5_000_000,
    courtInfo:
      'Kano State\'s Small Claims Court has operated as a division of the Magistrate Court since January 2019, handling debt recovery claims under the Kano State Magistrate Court\'s Law Practice Directions on Small Claims 2018.',
    responsePeriodDays: null,
    verified: false,
    faqs: GENERIC_FAQS('Kano State'),
  },
  {
    slug: 'oyo',
    name: 'Oyo State',
    claimLimit: 5_000_000,
    courtInfo:
      'Oyo State\'s Small Claims Court operates under its own Practice Direction, signed into law in January 2023, with registries in Ibadan.',
    responsePeriodDays: null,
    verified: false,
    faqs: GENERIC_FAQS('Oyo State'),
  },
  {
    slug: 'enugu',
    name: 'Enugu State',
    claimLimit: 5_000_000,
    claimLimitNote: 'The limit rises to ₦10,000,000 where the claim involves a counterclaim.',
    courtInfo:
      'Enugu State inaugurated 10 Small Claims Courts in December 2023, operating through Small Claims Registries at the state\'s Magistrates\' Courts.',
    responsePeriodDays: null,
    verified: false,
    faqs: GENERIC_FAQS('Enugu State'),
  },
]

export function getStateBySlug(slug: string): StateData | undefined {
  return STATES.find((s) => s.slug === slug)
}
