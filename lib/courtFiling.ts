// Small Claims Court filing workflow: the steps, the deadlines each step sets, and the
// readiness checks before a claim can be filed. Pure functions, so the admin panel, the API
// and the tests all agree on the same rules.
//
// Source: the Small Claims Practice Direction 2023 (Delta State text; the Lagos direction
// follows the same structure). Article numbers below refer to it. Every period here is the
// Practice Direction's own; nothing is inferred. The Lagos filing pack (Forms SCA 1, 2, 3, 3A,
// 3B, the Section 84 certificate, and the bailiff's SCA 6) follows a claim actually filed at
// the Lagos Magistrates' Court (Small Claims) in 2025.

import { numberToWords } from './money'

export type StateCode = 'lagos' | 'delta' | 'other'

export interface StateRules {
  name: string
  claimLimit: number
  // Form numbering differs by state: Delta uses SCC 1-9; our agents already call the Lagos
  // forms SCA 1 and SCA 2. Shown in labels only.
  formPrefix: string
  // The heading every form opens with, and what the form calls the person suing.
  courtHeading: string
  party: 'CLAIMANT' | 'PLAINTIFF'
  // Lagos files an application for summary judgment (SCA 3A) and its affidavit (SCA 3B) with
  // the complaint and summons.
  summaryJudgment: boolean
  // Lagos Form SCA 6: the bailiff's proof of service is filed within two days of service.
  affidavitOfServiceDays?: number
}

export const STATE_RULES: Record<StateCode, StateRules> = {
  lagos: { name: 'Lagos', claimLimit: 5_000_000, formPrefix: 'SCA', courtHeading: "IN THE MAGISTRATES' COURT OF LAGOS STATE (SMALL CLAIMS)", party: 'CLAIMANT', summaryJudgment: true, affidavitOfServiceDays: 2 },
  delta: { name: 'Delta', claimLimit: 5_000_000, formPrefix: 'SCC', courtHeading: 'IN THE MAGISTRATE COURT OF DELTA STATE (SMALL CLAIMS)', party: 'PLAINTIFF', summaryJudgment: false },
  other: { name: 'Other state', claimLimit: 5_000_000, formPrefix: 'Form', courtHeading: 'IN THE MAGISTRATE COURT OF [STATE] STATE (SMALL CLAIMS)', party: 'CLAIMANT', summaryJudgment: false },
}

export function rulesFor(state: string | null | undefined): StateRules {
  return STATE_RULES[(state as StateCode)] ?? STATE_RULES.other
}

export function formLabel(state: string | null | undefined, n: number | string): string {
  const p = rulesFor(state).formPrefix
  return p === 'Form' ? `Form ${n}` : `Form ${p} ${n}`
}

export interface Party {
  name?: string
  workAddress?: string
  residentialAddress?: string
  phone?: string
  email?: string
  // For substituted service (Art. 5(7)): verified WhatsApp, Instagram, Facebook etc.
  otherContacts?: string
}

export interface FilingFacts {
  claimant?: Party
  defendant?: Party
  amount?: number // liquidated sum claimed, excluding interest and costs
  interest?: string // older filings only; interest is now worked out from interestRate and dueDate
  interestRate?: number // simple interest, % a year, between INTEREST_RATE.min and .max
  interestAmount?: number // a practitioner's fixed interest figure, used instead of the calculation
  dueDate?: string // when the sum fell due; interest runs from here
  costs?: number // costs claimed; FLAT_COSTS unless a practitioner changes it
  costsNote?: string // what the costs are for
  particulars?: string // what the debt is for
  stepsTaken?: string // steps already taken to recover (Form 2 asks for this)
  documents?: string[] // contracts, receipts, invoices, messages to attach
  causeOfActionState?: string // where the debt arose, if known
  // The account the money was paid into, when the evidence shows it: the garnishee for
  // enforcing a judgment (Delta Form SCC 9 / 9A; Article 13).
  debtorBank?: { bank?: string; branch?: string; accountNumber?: string; accountName?: string }
}

export interface FilingRow {
  state: string
  registry?: string | null
  facts: FilingFacts
  demand_served_at?: string | null
  demand_service_proof?: string | null
  filed_at?: string | null
  claim_number?: string | null
  filing_fee?: number | null
  summons_issued_at?: string | null
  first_hearing_at?: string | null
  service_outcome?: 'served' | 'not_served' | 'substituted_ordered' | 'served_substituted' | null
  served_at?: string | null
  defence_type?: 'none' | 'admission' | 'defence' | 'counterclaim' | null
  defence_received_at?: string | null
  settled_at?: string | null
  judgment_at?: string | null
  judgment_outcome?: 'won' | 'part' | 'lost' | 'struck_out' | 'consent' | null
  judgment_sum?: number | null
  enforcement_started_at?: string | null
}

const DAY = 86_400_000

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return new Date(d.getTime() + days * DAY).toISOString().slice(0, 10)
}

// Monday to Friday. Public holidays are not known here, so a date near a holiday should be
// checked against the court calendar.
export function addWorkingDays(iso: string, days: number): string {
  let d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  let left = days
  while (left > 0) {
    d = new Date(d.getTime() + DAY)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) left--
  }
  return d.toISOString().slice(0, 10)
}

export interface Deadline {
  key: string
  label: string
  due: string
  rule: string
}

// Every deadline that follows from the dates recorded so far.
export function deadlinesFor(f: FilingRow): Deadline[] {
  const out: Deadline[] = []
  if (f.demand_served_at) out.push({ key: 'demand', label: 'Demand period ends (earliest filing date)', due: addDays(f.demand_served_at, 14), rule: 'Form 1: 14 days after receipt of the letter of demand' })
  if (f.filed_at) {
    out.push({ key: 'service', label: 'Bailiff to serve the summons', due: addDays(f.filed_at, 7), rule: 'Art. 5(1): within 7 days of filing' })
    out.push({ key: 'judgment_target', label: 'Target: filing to judgment', due: addWorkingDays(f.filed_at, 60), rule: 'Art. 12(2): not more than 60 working days' })
  }
  const sos = rulesFor(f.state).affidavitOfServiceDays
  if (f.served_at && sos) out.push({ key: 'proof_of_service', label: `Bailiff's affidavit of service (${formLabel(f.state, 6)}) filed`, due: addDays(f.served_at, sos), rule: `${formLabel(f.state, 6)}: within two days of service` })
  if (f.served_at) out.push({ key: 'defence', label: 'Defendant’s defence, admission or counterclaim due', due: addDays(f.served_at, 7), rule: 'Art. 6(1): within 7 days of service' })
  if (f.defence_received_at && (f.defence_type === 'defence' || f.defence_type === 'counterclaim')) out.push({ key: 'reply', label: 'Our reply to the defence / counterclaim', due: addDays(f.defence_received_at, 5), rule: 'Art. 7(6): within 5 days of service of the defence' })
  if (f.first_hearing_at) {
    out.push({ key: 'mediation', label: 'Mediation / settlement window closes', due: addDays(f.first_hearing_at, 7), rule: 'Art. 9(1): not more than 7 days' })
    out.push({ key: 'hearing', label: 'Hearing to be concluded', due: addDays(f.first_hearing_at, 30), rule: 'Art. 9(6): within 30 days of the first hearing' })
  }
  if (f.judgment_at) {
    out.push({ key: 'judgment_copy', label: 'Authenticated copy of judgment', due: addDays(f.judgment_at, 7), rule: 'Art. 12(4): within 7 days of judgment' })
    out.push({ key: 'appeal', label: 'Appeal window closes (Form 8)', due: addDays(f.judgment_at, 14), rule: 'Art. 14(1): within 14 days of judgment' })
  }
  return out
}

// Deadlines worth a reminder: due today or within the next `days` days, and not already dealt
// with according to what the Court filing tab records. Used by the morning e-mail digest
// (app/api/cron/court-deadlines). Overdue items are left to the tab, which shows them in red.
export function upcomingDeadlines(f: FilingRow, today: string, days = 3): (Deadline & { daysLeft: number })[] {
  const closed = !!f.judgment_at || !!f.settled_at
  const handled: Record<string, boolean> = {
    demand: !!f.filed_at,
    service: !!f.served_at || f.service_outcome === 'served' || f.service_outcome === 'served_substituted',
    defence: !!f.defence_type,
    mediation: closed,
    hearing: closed,
    judgment_target: closed,
  }
  const start = Date.parse(`${today.slice(0, 10)}T00:00:00Z`)
  return deadlinesFor(f)
    .map((d) => ({ ...d, daysLeft: Math.round((Date.parse(`${d.due}T00:00:00Z`) - start) / DAY) }))
    .filter((d) => d.daysLeft >= 0 && d.daysLeft <= days && !handled[d.key])
}

export type StepKey = 'prepare' | 'pack' | 'file' | 'service' | 'defence' | 'hearing' | 'judgment' | 'enforce'

export const STEPS: { key: StepKey; title: string; summary: string }[] = [
  { key: 'prepare', title: 'Check the claim can be filed', summary: 'Facts, the served demand letter and its proof, and the Article 2 conditions.' },
  { key: 'pack', title: 'Prepare the filing pack', summary: 'Every form, the Section 84 certificate and the exhibits, drafted from the case.' },
  { key: 'file', title: 'File at the registry', summary: 'Swear the affidavit, pay the fees, get the claim number and the summons.' },
  { key: 'service', title: 'Service of the summons', summary: 'Served by the bailiff within 7 days, or substituted service.' },
  { key: 'defence', title: 'Defence window', summary: 'Admission, defence or counterclaim within 7 days; our reply within 5.' },
  { key: 'hearing', title: 'Mediation and hearing', summary: 'Up to 7 days for settlement, hearing concluded within 30 days.' },
  { key: 'judgment', title: 'Judgment', summary: 'Outcome and sum; copies within 7 days, appeal within 14.' },
  { key: 'enforce', title: 'Enforcement', summary: 'Garnishee proceedings if the judgment sum is not paid.' },
]

export function stepDone(key: StepKey, f: FilingRow): boolean {
  switch (key) {
    case 'prepare': return readiness(f).every((c) => c.ok)
    case 'pack': return !!f.filed_at // the pack is done once it has been filed
    case 'file': return !!f.filed_at && !!f.claim_number
    case 'service': return f.service_outcome === 'served' || f.service_outcome === 'served_substituted'
    case 'defence': return !!f.defence_type
    case 'hearing': return !!f.settled_at || !!f.judgment_at
    case 'judgment': return !!f.judgment_at
    case 'enforce': return !!f.enforcement_started_at
  }
}

export function currentStep(f: FilingRow): StepKey {
  if (f.settled_at && !f.judgment_at) return 'hearing'
  return STEPS.find((s) => !stepDone(s.key, f))?.key ?? 'enforce'
}

export interface Check {
  key: string
  label: string
  ok: boolean
  detail?: string
}

// Article 2(1): the conditions the registrar checks before a summons will issue.
export function readiness(f: FilingRow, today = new Date().toISOString().slice(0, 10)): Check[] {
  const r = rulesFor(f.state)
  const c = f.facts?.claimant ?? {}
  const d = f.facts?.defendant ?? {}
  const amount = f.facts?.amount ?? 0
  const demandEnds = f.demand_served_at ? addDays(f.demand_served_at, 14) : null
  return [
    { key: 'claimant', label: 'Claimant’s name and address complete', ok: !!c.name && !!(c.workAddress || c.residentialAddress), detail: c.name ? undefined : 'Extract the facts, or type them in.' },
    { key: 'defendant', label: 'Defendant’s name and address complete', ok: !!d.name && !!(d.workAddress || d.residentialAddress) },
    { key: 'amount', label: `Liquidated sum within the ₦${r.claimLimit.toLocaleString()} limit`, ok: amount > 0 && amount <= r.claimLimit, detail: amount > r.claimLimit ? 'Above the limit: not a Small Claims matter.' : amount ? `₦${amount.toLocaleString()} claimed, excluding interest and costs.` : undefined },
    { key: 'demand_served', label: 'Letter of demand served, with proof', ok: !!f.demand_served_at && !!f.demand_service_proof?.trim(), detail: f.demand_served_at ? undefined : 'Record the date it was received and how it was served.' },
    { key: 'demand_expired', label: '14 days have passed since the letter was received', ok: !!demandEnds && today >= demandEnds, detail: demandEnds ? (today >= demandEnds ? `Expired ${demandEnds}.` : `Earliest filing date: ${demandEnds}.`) : undefined },
    { key: 'jurisdiction', label: `A party lives or does business in ${r.name}, or the debt arose there`, ok: !!(c.workAddress || c.residentialAddress || d.workAddress || d.residentialAddress || f.facts?.causeOfActionState), detail: 'Confirm against the addresses above.' },
  ]
}

export const DOC_KINDS = {
  facts: { title: 'Case facts for the forms', step: 'prepare' },
  demand_form: { title: 'Letter of demand (Form 1)', step: 'pack' },
  complaint: { title: 'Complaint form (Form 2)', step: 'pack' },
  summons: { title: 'Summons (Form 3)', step: 'pack' },
  summary_judgment: { title: 'Application for summary judgment (Form 3A)', step: 'pack' },
  sj_affidavit: { title: 'Affidavit in support of summary judgment (Form 3B)', step: 'pack' },
  s84_certificate: { title: 'Certificate of identification (Section 84, Evidence Act 2011)', step: 'pack' },
  exhibits: { title: 'Exhibit list and bundle order', step: 'pack' },
  substituted_service: { title: 'Motion for substituted service (Form 7) with affidavit', step: 'service' },
  reply: { title: 'Reply to defence / counterclaim', step: 'defence' },
  hearing_pack: { title: 'Hearing pack: statement, documents, witnesses', step: 'hearing' },
  settlement: { title: 'Terms of settlement for a consent judgment', step: 'hearing' },
  garnishee: { title: 'Garnishee motion ex parte (Form 9) with affidavit (Form 9A)', step: 'enforce' },
} as const

export type DocKind = keyof typeof DOC_KINDS

// The documents filed together to start a claim, in the order they go into the bundle.
export function packKinds(state: string | null | undefined): DocKind[] {
  const sj: DocKind[] = rulesFor(state).summaryJudgment ? ['summary_judgment', 'sj_affidavit'] : []
  return ['demand_form', 'complaint', 'summons', ...sj, 's84_certificate', 'exhibits']
}

// The order the pack is drafted in: the exhibit list first, so every other form can use its
// exhibit marks, then the forms in bundle order.
export function packDraftOrder(state: string | null | undefined): DocKind[] {
  const kinds = packKinds(state)
  return ['exhibits', ...kinds.filter((k) => k !== 'exhibits')]
}

// A document title with the state's form numbers, e.g. "Form 3A" -> "Form SCA 3A".
export function docTitle(kind: DocKind, state: string | null | undefined): string {
  return DOC_KINDS[kind].title.replace(/Form (\d+[AB]?)/g, (_, n) => formLabel(state, n))
}

// The firm claims the same costs on every claim, and simple interest on the sum from the date it
// fell due, at 10 to 15% a year (10% unless a practitioner sets it higher). Interest is worked out
// to the filing date and claimed as continuing at the same rate until judgment.
export const FLAT_COSTS = 200_000
export const DEFAULT_COSTS_NOTE = 'cost of litigation'
export const INTEREST_RATE = { min: 10, max: 15, default: 10 } as const

export function costsOf(facts: FilingFacts): number {
  return facts.costs ?? FLAT_COSTS
}

export function interestRateOf(facts: FilingFacts): number {
  const r = facts.interestRate ?? INTEREST_RATE.default
  return Math.min(INTEREST_RATE.max, Math.max(INTEREST_RATE.min, r))
}

export interface ClaimFigures {
  sum: number
  rate: number
  interestFrom: string | null // the due date, if known
  interestTo: string
  days: number
  interest: number // to interestTo; 0 when it cannot be worked out
  interestFixed: boolean // a practitioner typed the interest amount instead of the calculation
  costs: number
  costsNote: string
  total: number // sum + interest + costs, before court fees
}

// The figures every form uses, worked out to the filing date (or today, before filing). A
// practitioner may fix the interest amount instead (facts.interestAmount); otherwise it is
// simple interest from the due date at the chosen rate.
export function claimFigures(facts: FilingFacts, until = new Date().toISOString().slice(0, 10)): ClaimFigures {
  const sum = facts.amount ?? 0
  const rate = interestRateOf(facts)
  const from = facts.dueDate?.slice(0, 10) || null
  const to = until.slice(0, 10)
  const days = from && to > from ? Math.round((Date.parse(to) - Date.parse(from)) / DAY) : 0
  const fixed = typeof facts.interestAmount === 'number' && facts.interestAmount > 0
  const interest = fixed ? Math.round(facts.interestAmount as number) : Math.round((sum * rate * days) / (100 * 365))
  const costs = costsOf(facts)
  return { sum, rate, interestFrom: from, interestTo: to, days, interest, interestFixed: fixed, costs, costsNote: facts.costsNote?.trim() || DEFAULT_COSTS_NOTE, total: sum + interest + costs }
}

export function claimTotal(facts: FilingFacts, until?: string): number {
  return claimFigures(facts, until).total
}

// ₦600,000.00 — the way the court forms write money.
export const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ₦600,000.00 (Six Hundred Thousand Naira)
export function nairaWithWords(n: number): string {
  return `${naira(n)} (${numberToWords(Math.round(n))} Naira)`
}

export function longDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// The INTEREST wording the forms copy word for word.
export function interestWording(fig: ClaimFigures): string {
  const on = `on ${naira(fig.sum)}`
  if (fig.interestFixed) return `${naira(fig.interest)}, being interest ${on} from ${fig.interestFrom ? longDate(fig.interestFrom) : 'the date the sum fell due'} to the date of filing`
  if (fig.interestFrom) return `${naira(fig.interest)}, being simple interest at ${fig.rate}% per annum ${on} from ${longDate(fig.interestFrom)} to ${longDate(fig.interestTo)}, and further interest at ${fig.rate}% per annum from ${longDate(fig.interestTo)} until judgment`
  return `interest at ${fig.rate}% per annum ${on} from the date the sum fell due until judgment`
}

// The figures written out for the drafts: form-ready lines, then notes for the drafter only.
export function claimFiguresText(fig: ClaimFigures): string {
  const notes: string[] = []
  if (!fig.interestFrom && !fig.interestFixed) notes.push('No due date is recorded, so no interest amount can be stated: claim the rate only, and do not invent an amount.')
  return [
    `SUM CLAIMED: ${nairaWithWords(fig.sum)}`,
    `INTEREST: ${interestWording(fig)}`,
    `COSTS: ${naira(fig.costs)}, being ${fig.costsNote}`,
    `TOTAL: ${naira(fig.total)} (debt, interest and costs, before court fees)`,
    ...(notes.length ? ['', `NOTE FOR THE DRAFTER (never copy into a form): ${notes.join(' ')}`] : []),
  ].join('\n')
}
