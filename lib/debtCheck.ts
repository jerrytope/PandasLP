// The free "Is my debt recoverable?" check (/debt-check). Questions and the assessment live
// here, in one pure function, so the page and the API (which recomputes the verdict rather than
// trusting the browser) can never disagree, and every rule is unit-tested.
//
// Legal points used, all already stated elsewhere on the site:
//   - Lagos Small Claims Court: claims up to ₦5,000,000 (lib/blogPosts.ts).
//   - Limitation: typically six years for a simple contract debt; a written acknowledgment or
//     part-payment can restart the clock, which only a lawyer should confirm.
//   - Claims against government bodies have special pre-action rules, so they always go to a
//     lawyer for review rather than getting an automatic verdict.
// This is general information, never advice; the page says so.

export const SMALL_CLAIMS_LIMIT_NAIRA = 5_000_000
export const DEMAND_LETTER_FEE_NAIRA = 10_000
export const PROPERTY_FEE_NAIRA = 25_000

export const DEBTOR_TYPES = ['individual', 'business', 'tenant', 'government'] as const
export const DEBT_AGES = ['under_1', '1_to_3', '3_to_6', 'over_6'] as const
export const PROOF_TYPES = ['agreement', 'invoice', 'transfer', 'messages', 'witness', 'none'] as const
export const ADMISSIONS = ['in_writing', 'verbally', 'disputes', 'not_asked'] as const
export const LOCATIONS = ['address', 'phone_only', 'unknown'] as const
export const STATES = ['lagos', 'other'] as const

export type DebtorType = (typeof DEBTOR_TYPES)[number]
export type DebtAge = (typeof DEBT_AGES)[number]
export type ProofType = (typeof PROOF_TYPES)[number]
export type Admission = (typeof ADMISSIONS)[number]
export type Location = (typeof LOCATIONS)[number]
export type DebtState = (typeof STATES)[number]

export interface DebtCheckAnswers {
  debtor: DebtorType
  amountNaira: number
  age: DebtAge
  proof: ProofType[]
  admission: Admission
  location: Location
  state: DebtState
}

export const LABELS = {
  debtor: {
    individual: 'A person',
    business: 'A business or company',
    tenant: 'A tenant (unpaid rent)',
    government: 'A government body or agency',
  } satisfies Record<DebtorType, string>,
  age: {
    under_1: 'Less than a year ago',
    '1_to_3': '1 to 3 years ago',
    '3_to_6': '3 to 6 years ago',
    over_6: 'More than 6 years ago',
  } satisfies Record<DebtAge, string>,
  proof: {
    agreement: 'A written or signed agreement',
    invoice: 'An invoice or receipt',
    transfer: 'Bank transfer records',
    messages: 'WhatsApp, SMS or email messages about it',
    witness: 'Someone who saw or heard the deal',
    none: 'Nothing written down',
  } satisfies Record<ProofType, string>,
  admission: {
    in_writing: 'Yes, in a message or in writing',
    verbally: 'Yes, but only by phone or in person',
    disputes: 'No, they say they don’t owe it',
    not_asked: 'I haven’t asked them yet',
  } satisfies Record<Admission, string>,
  location: {
    address: 'Yes, I know where they live or work',
    phone_only: 'I only have their phone number',
    unknown: 'No, I can’t reach them',
  } satisfies Record<Location, string>,
  state: {
    lagos: 'Lagos',
    other: 'Another state in Nigeria',
  } satisfies Record<DebtState, string>,
}

export type Verdict = 'strong' | 'good' | 'possible' | 'difficult' | 'review'
export type NextStep = 'demand_letter' | 'property' | 'lawyer_review'

export interface DebtAssessment {
  verdict: Verdict
  headline: string
  // What helps and what hurts, in plain words, strongest first.
  points: { tone: 'good' | 'caution'; text: string }[]
  nextStep: NextStep
  nextStepText: string
  court: 'small_claims' | 'high_court' | 'depends'
}

const WRITTEN_PROOF: ProofType[] = ['agreement', 'invoice', 'transfer', 'messages']

export function formatNairaPlain(n: number): string {
  return `₦${Math.round(n).toLocaleString('en-NG')}`
}

export function assessDebt(a: DebtCheckAnswers): DebtAssessment {
  const points: DebtAssessment['points'] = []
  const proof = a.proof.filter((p) => p !== 'none')
  const hasWritten = proof.some((p) => WRITTEN_PROOF.includes(p))
  const hasAgreement = proof.includes('agreement') || proof.includes('invoice')
  const court: DebtAssessment['court'] =
    a.state !== 'lagos' ? 'depends' : a.amountNaira <= SMALL_CLAIMS_LIMIT_NAIRA ? 'small_claims' : 'high_court'

  // Evidence
  if (hasAgreement) points.push({ tone: 'good', text: 'You have a written agreement, invoice or receipt. That is the strongest proof of what was agreed.' })
  if (proof.includes('transfer')) points.push({ tone: 'good', text: 'Bank records show the money moved, which is hard to deny.' })
  if (proof.includes('messages')) points.push({ tone: 'good', text: 'Messages about the debt can be used as evidence in Nigerian courts.' })
  if (!hasWritten && proof.includes('witness')) points.push({ tone: 'caution', text: 'A witness helps, but with nothing in writing it becomes your word against theirs.' })
  if (proof.length === 0) points.push({ tone: 'caution', text: 'With nothing written down, recovery is harder. Messages where they mention the debt would help a lot.' })

  // Admission
  if (a.admission === 'in_writing') points.push({ tone: 'good', text: 'They have admitted the debt in writing. That is one of the best positions to be in.' })
  if (a.admission === 'verbally') points.push({ tone: 'good', text: 'They have admitted it, though only verbally. A demand letter often gets that admission in writing.' })
  if (a.admission === 'disputes') points.push({ tone: 'caution', text: 'They dispute the debt, so your proof will matter more if it goes to court.' })
  if (a.admission === 'not_asked') points.push({ tone: 'good', text: 'You haven’t formally asked yet. A lawyer’s demand letter is the right first step and often ends it.' })

  // Finding them
  if (a.location === 'phone_only') points.push({ tone: 'caution', text: 'With only a phone number, a demand letter can go by WhatsApp or email, but court papers need an address.' })
  if (a.location === 'unknown') points.push({ tone: 'caution', text: 'If they can’t be reached, a letter or court claim can’t be delivered. Any address, workplace or email helps.' })

  // Time
  if (a.age === 'over_6') {
    points.unshift({
      tone: 'caution',
      text: 'Debts over six years old may be too late to take to court. If they admitted it in writing or paid part of it more recently, the clock may have restarted.',
    })
  } else if (a.age === '3_to_6') {
    points.push({ tone: 'caution', text: 'Most contract debts must be taken to court within six years, so it is worth acting soon.' })
  }

  // Court route
  if (court === 'small_claims') points.push({ tone: 'good', text: `At ${formatNairaPlain(a.amountNaira)}, it fits the Lagos Small Claims Court (up to ₦5 million), which is quicker and simpler than the High Court.` })
  if (court === 'high_court') points.push({ tone: 'caution', text: `Above ₦5 million, a court claim goes to the High Court, which takes longer. A demand letter is still the first step.` })

  // Government bodies and old debts always go to a lawyer first.
  if (a.debtor === 'government') {
    points.unshift({ tone: 'caution', text: 'Claims against government bodies follow special rules, including notice before any court claim. A lawyer needs to look at this first.' })
    return { verdict: 'review', headline: 'A lawyer should look at this first', points, nextStep: 'lawyer_review', nextStepText: 'Leave your number and a lawyer will call you back for free to explain your options.', court }
  }
  if (a.age === 'over_6') {
    return { verdict: 'review', headline: 'It may be too late, but it’s worth checking', points, nextStep: 'lawyer_review', nextStepText: 'Before you spend anything, a lawyer will check for free whether the time limit has passed.', court }
  }

  let verdict: Verdict
  if (hasWritten && a.location === 'address' && a.admission !== 'disputes') verdict = 'strong'
  else if (hasWritten && a.location !== 'unknown') verdict = 'good'
  else if ((proof.length > 0 || a.admission === 'in_writing' || a.admission === 'verbally') && a.location !== 'unknown') verdict = 'possible'
  else verdict = 'difficult'

  const headline = {
    strong: 'Your debt looks very recoverable',
    good: 'Your debt looks recoverable',
    possible: 'Your debt may be recoverable',
    difficult: 'This one will be hard to recover',
    review: '',
  }[verdict]

  if (a.debtor === 'tenant') {
    return {
      verdict,
      headline,
      points,
      nextStep: 'property',
      nextStepText: `If you only want the rent, a demand letter (${formatNairaPlain(DEMAND_LETTER_FEE_NAIRA)}) is the first step. If you also want the tenant out, the legal notices come from our property service (${formatNairaPlain(PROPERTY_FEE_NAIRA)}).`,
      court,
    }
  }
  if (verdict === 'difficult') {
    return { verdict, headline, points, nextStep: 'lawyer_review', nextStepText: 'Leave your number and a lawyer will call you back for free to see what can be done.', court }
  }
  return {
    verdict,
    headline,
    points,
    nextStep: 'demand_letter',
    nextStepText: `Next step: a letter of demand signed by a licensed Lagos lawyer, ${formatNairaPlain(DEMAND_LETTER_FEE_NAIRA)}, with Day 7 and Day 14 follow-ups included. Many debtors pay once a lawyer is involved.`,
    court,
  }
}

// Validates untrusted input (the API body) into answers, or returns a reason it can't.
export function parseAnswers(raw: unknown): { ok: true; answers: DebtCheckAnswers } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Missing answers.' }
  const r = raw as Record<string, unknown>
  const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
  if (!oneOf(DEBTOR_TYPES, r.debtor)) return { ok: false, error: 'Who owes you?' }
  const amount = Number(r.amountNaira)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000_000) return { ok: false, error: 'How much are you owed?' }
  if (!oneOf(DEBT_AGES, r.age)) return { ok: false, error: 'When was the money due?' }
  if (!Array.isArray(r.proof) || r.proof.length === 0 || r.proof.length > PROOF_TYPES.length || !r.proof.every((p) => oneOf(PROOF_TYPES, p))) {
    return { ok: false, error: 'What proof do you have?' }
  }
  if (!oneOf(ADMISSIONS, r.admission)) return { ok: false, error: 'Have they admitted the debt?' }
  if (!oneOf(LOCATIONS, r.location)) return { ok: false, error: 'Can you reach them?' }
  if (!oneOf(STATES, r.state)) return { ok: false, error: 'Which state are they in?' }
  return {
    ok: true,
    answers: {
      debtor: r.debtor,
      amountNaira: Math.round(amount),
      age: r.age,
      proof: [...new Set(r.proof as ProofType[])],
      admission: r.admission,
      location: r.location,
      state: r.state,
    },
  }
}

// Nigerian mobile numbers: 080..., 0701..., +234..., 234... → 234XXXXXXXXXX, or null.
export function normaliseNgPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '')
  let n = digits
  if (n.startsWith('234')) n = n.slice(3)
  else if (n.startsWith('0')) n = n.slice(1)
  if (!/^[789][01]\d{8}$/.test(n)) return null
  return `234${n}`
}

// A first message for the debt-recovery agent, so someone who starts a letter from the check
// doesn't have to repeat themselves.
export function agentOpener(a: DebtCheckAnswers): string {
  const proof = a.proof.filter((p) => p !== 'none').map((p) => LABELS.proof[p].toLowerCase())
  return [
    `I want to recover ${formatNairaPlain(a.amountNaira)} owed to me by ${LABELS.debtor[a.debtor].toLowerCase()} in ${a.state === 'lagos' ? 'Lagos' : 'another state'}.`,
    `It was due ${LABELS.age[a.age].toLowerCase()}.`,
    proof.length ? `For proof I have: ${proof.join(', ')}.` : 'I don’t have anything written down.',
    `Have they admitted it? ${LABELS.admission[a.admission]}.`,
  ].join(' ')
}

// Admin follow-up states for a lead.
export const LEAD_STATUSES = ['new', 'contacted', 'converted', 'not_a_fit'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Became a client',
  not_a_fit: 'Not a fit',
}
