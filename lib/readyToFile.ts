// Turning a lapsed demand into a filed claim. The summons, not the letter, is what moves most
// debtors, so every served case whose fourteen days have run out without payment comes onto one
// list in Admin with exactly what still stands between it and the registry. Pure, so the queue,
// the bundle checklist and the tests share one set of rules.

import { packKinds, readiness, docTitle, type FilingRow } from './courtFiling'
import { addCalendarDays as addDays, RESPONSE_DAYS } from './debtorReminders'

export interface Blocker {
  key: string
  label: string
}

export interface FilingStatus {
  daysSinceLapse: number // days since the fourteen days ended (0 = the first day it can be filed)
  firstFilingDay: string
  packDrafted: number
  packTotal: number
  signedReceived: boolean
  blockers: Blocker[]
}

/** Where a served, unpaid case stands on the way to filing. `docKinds` are the kinds of the
    documents saved in the Court filing tab (any version). */
export function filingStatus(input: {
  received: string // date the debtor received the letter, YYYY-MM-DD
  filing: FilingRow | null
  docKinds: string[]
  today: string
}): FilingStatus {
  const firstFilingDay = addDays(input.received, RESPONSE_DAYS + 1)
  const daysSinceLapse = Math.round((Date.parse(`${input.today}T00:00:00Z`) - Date.parse(`${firstFilingDay}T00:00:00Z`)) / 86_400_000)
  const blockers: Blocker[] = []
  const f = input.filing

  if (!f) {
    blockers.push({ key: 'no_filing', label: 'Start the filing in the Court filing tab (choose the state and extract the facts)' })
    return { daysSinceLapse, firstFilingDay, packDrafted: 0, packTotal: packKinds('lagos').length, signedReceived: false, blockers }
  }

  // The registrar's Article 2 checks, except the 14-day one, which this list already enforces.
  for (const c of readiness({ ...f, demand_served_at: f.demand_served_at ?? input.received }, input.today)) {
    if (!c.ok && c.key !== 'demand_expired') blockers.push({ key: c.key, label: c.key === 'amount' && !(f.facts?.amount) ? 'Confirm the sum claimed' : c.label })
  }
  if (!f.demand_served_at) blockers.push({ key: 'demand_date', label: 'Record the date the debtor received the letter, and how it was served' })

  const kinds = packKinds(f.state)
  const have = new Set(input.docKinds)
  const missing = kinds.filter((k) => !have.has(k))
  for (const k of missing) blockers.push({ key: `pack_${k}`, label: `Draft the ${docTitle(k, f.state)}` })

  const signedReceived = have.has('signed_received')
  if (!signedReceived) blockers.push({ key: 'signed', label: 'Get the forms signed by the client (send the pack and the upload link)' })

  return { daysSinceLapse, firstFilingDay, packDrafted: kinds.length - missing.length, packTotal: kinds.length, signedReceived, blockers }
}

/** The filing-day checklist printed into the bundle. */
export function filingDayChecklist(stateName: string, status: FilingStatus): string {
  return [
    `FILING-DAY CHECKLIST (${stateName} Small Claims Court)`,
    '',
    status.blockers.length ? 'STILL TO DO BEFORE FILING:' : 'Nothing outstanding in the system.',
    ...status.blockers.map((b) => `[ ] ${b.label}`),
    '',
    'AT THE REGISTRY:',
    '[ ] The complaint (Form 2) signed by the client; affidavits sworn before the Commissioner for Oaths',
    '[ ] The served letter of demand and proof of service attached',
    '[ ] Exhibits in the order of the exhibit list, each marked',
    '[ ] Filing fees paid; keep the receipt',
    '[ ] Claim number written down and entered in Admin → Court filing (filing date and claim number)',
    '[ ] Summons issued; note the first hearing date in Admin',
    '',
    'AFTER FILING: the bailiff serves the summons within 7 days; the defence is due 7 days after service. Admin e-mails these deadlines each morning.',
  ].join('\n')
}
