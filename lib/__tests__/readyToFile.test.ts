import { describe, it, expect } from 'vitest'
import { filingStatus, filingDayChecklist } from '../readyToFile'
import { DELTA_SCC9_TEMPLATE, DELTA_SCC9A_TEMPLATE } from '../deltaForms'
import { draftInstruction } from '../courtFilingPrompts'
import type { FilingRow } from '../courtFiling'

const ready: FilingRow = {
  state: 'lagos',
  facts: {
    claimant: { name: 'Chidera Sunshine Innocent', residentialAddress: 'Iyana Paja, Lagos' },
    defendant: { name: 'Ikechukwu Peter Godpower', residentialAddress: 'Ikotun, Lagos' },
    amount: 300000,
  },
  demand_served_at: '2026-10-06',
  demand_service_proof: 'WhatsApp, link opened',
}
const FULL_PACK = ['demand_form', 'complaint', 'summons', 'summary_judgment', 'sj_affidavit', 's84_certificate', 'exhibits', 'signed_received']

describe('ready to file', () => {
  it('counts days from the first day the claim can be filed', () => {
    expect(filingStatus({ received: '2026-10-06', filing: ready, docKinds: FULL_PACK, today: '2026-10-21' }).daysSinceLapse).toBe(0)
    expect(filingStatus({ received: '2026-10-06', filing: ready, docKinds: FULL_PACK, today: '2026-10-25' }).daysSinceLapse).toBe(4)
    expect(filingStatus({ received: '2026-10-06', filing: ready, docKinds: FULL_PACK, today: '2026-10-18' }).daysSinceLapse).toBe(-3)
  })

  it('a complete, signed pack has nothing blocking it', () => {
    const s = filingStatus({ received: '2026-10-06', filing: ready, docKinds: FULL_PACK, today: '2026-10-21' })
    expect(s.blockers).toEqual([])
    expect(s.packDrafted).toBe(s.packTotal)
  })

  it('lists exactly what blocks filing', () => {
    const s = filingStatus({ received: '2026-10-06', filing: { ...ready, facts: { ...ready.facts, amount: undefined } }, docKinds: ['demand_form'], today: '2026-10-21' })
    const labels = s.blockers.map((b) => b.label)
    expect(labels).toContain('Confirm the sum claimed')
    expect(labels.some((l) => l.startsWith('Draft the Complaint form'))).toBe(true)
    expect(labels).toContain('Get the forms signed by the client (send the pack and the upload link)')
    expect(filingStatus({ received: '2026-10-06', filing: null, docKinds: [], today: '2026-10-21' }).blockers[0].key).toBe('no_filing')
  })

  it('prints a filing-day checklist with what is still to do', () => {
    const s = filingStatus({ received: '2026-10-06', filing: ready, docKinds: ['demand_form'], today: '2026-10-21' })
    const text = filingDayChecklist('Lagos', s)
    expect(text).toContain('STILL TO DO BEFORE FILING:')
    expect(text).toContain('[ ] Claim number written down')
  })
})

// Delta State Practice Direction on Small Claims 2023, pages 27 to 30.
describe('Delta garnishee forms', () => {
  it('Form SCC 9 carries the prescribed reliefs word for word', () => {
    expect(DELTA_SCC9_TEMPLATE).toContain('SECTIONS 83 AND 84 OF THE SHERIFFS AND CIVIL PROCESS ACT')
    expect(DELTA_SCC9_TEMPLATE).toContain('within fourteen (14) days of service of the order to show cause')
    expect(DELTA_SCC9_TEMPLATE).toContain('within eight (8) days of the service of the order of this Court')
    expect(DELTA_SCC9_TEMPLATE).toContain("JUDGMENT CREDITOR'S SIGNATURE")
  })

  it('Form SCC 9A asks for the bank, branch and account number', () => {
    expect(DELTA_SCC9A_TEMPLATE).toContain('AFFIDAVIT IN SUPPORT')
    expect(DELTA_SCC9A_TEMPLATE).toContain('account number')
    expect(DELTA_SCC9A_TEMPLATE).toContain('COMMISSIONER FOR OATHS')
  })

  it('the Court filing tab drafts both for Delta and uses the debtor bank facts', () => {
    const t = draftInstruction('garnishee', 'delta')
    expect(t).toContain(DELTA_SCC9_TEMPLATE)
    expect(t).toContain(DELTA_SCC9A_TEMPLATE)
    expect(t).toContain('facts.debtorBank')
    expect(draftInstruction('facts', 'delta')).toContain('"debtorBank"')
  })
})
