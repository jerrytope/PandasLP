import { describe, expect, it } from 'vitest'
import { DOC_KINDS, addWorkingDays, claimFigures, claimFiguresText, claimTotal, currentStep, deadlinesFor, docTitle, formLabel, interestWording, packDraftOrder, packKinds, readiness, stepDone, type DocKind, type FilingRow } from '../courtFiling'
import { courtFilingSystem, draftInstruction } from '../courtFilingPrompts'

const ready: FilingRow = {
  state: 'lagos',
  facts: {
    claimant: { name: 'Ada Obi', workAddress: '1 Allen Avenue, Ikeja' },
    defendant: { name: 'Bayo Ltd', workAddress: '2 Opebi Road, Ikeja' },
    amount: 850_000,
  },
  demand_served_at: '2026-09-01',
  demand_service_proof: 'Delivered by hand, acknowledged copy on file',
}

describe('deadlines from the Practice Direction', () => {
  it('sets every period from the recorded dates', () => {
    const d = Object.fromEntries(deadlinesFor({ ...ready, filed_at: '2026-10-05', served_at: '2026-10-08', defence_type: 'defence', defence_received_at: '2026-10-12', first_hearing_at: '2026-10-20', judgment_at: '2026-11-10' }).map((x) => [x.key, x.due]))
    expect(d.demand).toBe('2026-09-15') // 14 days after receipt
    expect(d.service).toBe('2026-10-12') // 7 days after filing
    expect(d.defence).toBe('2026-10-15') // 7 days after service
    expect(d.reply).toBe('2026-10-17') // 5 days after the defence
    expect(d.mediation).toBe('2026-10-27') // 7 days
    expect(d.hearing).toBe('2026-11-19') // 30 days from first hearing
    expect(d.judgment_copy).toBe('2026-11-17')
    expect(d.appeal).toBe('2026-11-24') // 14 days after judgment
  })

  it('counts 60 working days, skipping weekends', () => {
    expect(addWorkingDays('2026-10-02', 1)).toBe('2026-10-05') // Friday -> Monday
    expect(addWorkingDays('2026-10-05', 60)).toBe('2026-12-28')
  })

  it('only asks for a reply when there is a defence or counterclaim', () => {
    const keys = deadlinesFor({ ...ready, defence_type: 'admission', defence_received_at: '2026-10-12' }).map((d) => d.key)
    expect(keys).not.toContain('reply')
  })
})

describe('readiness to file (Art. 2)', () => {
  it('passes a complete claim after the 14 days have run', () => {
    expect(readiness(ready, '2026-09-20').every((c) => c.ok)).toBe(true)
  })

  it('blocks filing before the 14 days have run, above the limit, or without proof of service', () => {
    const early = readiness(ready, '2026-09-10').find((c) => c.key === 'demand_expired')
    expect(early?.ok).toBe(false)
    expect(early?.detail).toMatch(/2026-09-15/)
    expect(readiness({ ...ready, facts: { ...ready.facts, amount: 5_000_001 } }, '2026-09-20').find((c) => c.key === 'amount')?.ok).toBe(false)
    expect(readiness({ ...ready, demand_service_proof: '' }, '2026-09-20').find((c) => c.key === 'demand_served')?.ok).toBe(false)
  })
})

describe('steps', () => {
  it('moves through the steps as dates are recorded', () => {
    expect(currentStep({ state: 'lagos', facts: {} })).toBe('prepare')
    expect(stepDone('file', { ...ready, filed_at: '2026-10-05' })).toBe(false) // needs the claim number too
    expect(currentStep({ ...ready, filed_at: '2026-10-05', claim_number: 'SCC/123/2026' })).toBe('service')
    expect(currentStep({ ...ready, filed_at: '2026-10-05', claim_number: 'X', service_outcome: 'served', served_at: '2026-10-08', defence_type: 'none' })).toBe('hearing')
  })

  it('labels forms by state', () => {
    expect(formLabel('delta', 1)).toBe('Form SCC 1')
    expect(formLabel('lagos', 2)).toBe('Form SCA 2')
  })
})

describe('AI instructions', () => {
  it('forbid dates and invented facts, and cover every document kind', () => {
    const sys = courtFilingSystem('lagos')
    expect(sys).toMatch(/Never write a date/)
    expect(sys).toMatch(/Never invent/)
    for (const kind of Object.keys(DOC_KINDS) as DocKind[]) expect(draftInstruction(kind, 'delta').length).toBeGreaterThan(50)
  })
})

describe('the filing pack', () => {
  it('files summary judgment forms in Lagos only', () => {
    expect(packKinds('lagos')).toEqual(['demand_form', 'complaint', 'summons', 'summary_judgment', 'sj_affidavit', 's84_certificate', 'exhibits'])
    expect(packKinds('delta')).not.toContain('summary_judgment')
    expect(docTitle('summary_judgment', 'lagos')).toBe('Application for summary judgment (Form SCA 3A)')
    expect(docTitle('sj_affidavit', 'lagos')).toBe('Affidavit in support of summary judgment (Form SCA 3B)')
  })

  it("sets the bailiff's two-day proof of service deadline in Lagos", () => {
    const lagos = deadlinesFor({ ...ready, served_at: '2026-10-08' }).find((d) => d.key === 'proof_of_service')
    expect(lagos?.due).toBe('2026-10-10')
    expect(deadlinesFor({ ...ready, state: 'delta', served_at: '2026-10-08' }).some((d) => d.key === 'proof_of_service')).toBe(false)
  })

  it('claims flat costs of ₦200,000 and simple interest at 10–15% a year on every claim', () => {
    // No due date: costs only, and interest claimed as a rate until judgment.
    expect(claimTotal({ amount: 30_000 }, '2026-10-05')).toBe(230_000)
    const fig = claimFigures({ amount: 365_000, dueDate: '2025-10-05' }, '2026-10-05')
    expect(fig).toMatchObject({ rate: 10, days: 365, interest: 36_500, costs: 200_000, total: 601_500, interestFixed: false })
    expect(claimFigures({ amount: 365_000, dueDate: '2025-10-05', interestRate: 15 }, '2026-10-05').interest).toBe(54_750)
    expect(claimFigures({ amount: 100_000, interestRate: 40 }).rate).toBe(15) // held within 10–15%
    expect(claimFigures({ amount: 100_000, interestRate: 2 }).rate).toBe(10)
    expect(claimFigures({ amount: 100_000, costs: 150_000, costsNote: 'cost of the demand' }).costs).toBe(150_000) // a practitioner may change it
    const text = claimFiguresText(fig)
    expect(text).toContain('SUM CLAIMED: ₦365,000.00 (Three Hundred and Sixty-Five Thousand Naira)')
    expect(text).toContain('INTEREST: ₦36,500.00, being simple interest at 10% per annum on ₦365,000.00 from 5 October 2025 to 5 October 2026, and further interest at 10% per annum from 5 October 2026 until judgment')
    expect(text).toContain('COSTS: ₦200,000.00, being cost of litigation')
    expect(text).toContain('TOTAL: ₦601,500.00 (debt, interest and costs, before court fees)')
    expect(text).not.toContain('NOTE FOR THE DRAFTER')
  })

  it('keeps drafting notes apart from the wording the forms copy', () => {
    const text = claimFiguresText(claimFigures({ amount: 600_000 }))
    expect(text).toContain('INTEREST: interest at 10% per annum on ₦600,000.00 from the date the sum fell due until judgment\n')
    expect(text).toMatch(/NOTE FOR THE DRAFTER \(never copy into a form\): No due date is recorded/)
  })

  it('lets a practitioner fix the interest amount instead of the calculation', () => {
    const fig = claimFigures({ amount: 600_000, dueDate: '2025-11-03', interestAmount: 150_000 }, '2026-10-05')
    expect(fig).toMatchObject({ interest: 150_000, interestFixed: true, total: 950_000 })
    expect(interestWording(fig)).toBe('₦150,000.00, being interest on ₦600,000.00 from 3 November 2025 to the date of filing')
    expect(interestWording(claimFigures({ amount: 600_000, interestAmount: 150_000 }))).toBe('₦150,000.00, being interest on ₦600,000.00 from the date the sum fell due to the date of filing')
  })

  it('drafts the exhibit list first so every form uses its marks', () => {
    expect(packDraftOrder('lagos')[0]).toBe('exhibits')
    expect(packDraftOrder('lagos').slice().sort()).toEqual(packKinds('lagos').slice().sort())
  })

  it('makes every form carry the interest and costs, from the claim figures', () => {
    const complaint = draftInstruction('complaint', 'lagos')
    expect(complaint).toContain('INTEREST: «the INTEREST line from the CLAIM FIGURES, word for word»')
    expect(complaint).toContain('TOTAL: «the TOTAL line from the CLAIM FIGURES, word for word»')
    expect(draftInstruction('summons', 'lagos')).toContain('Total: «the TOTAL line from the CLAIM FIGURES, word for word»')
    expect(draftInstruction('sj_affidavit', 'lagos')).toContain('By reason of the foregoing, I claim against the Defendant:')
    expect(courtFilingSystem('lagos')).toMatch(/never recalculate, round or restate them differently/)
  })

  it('follows the printed Lagos forms and the firm’s house style', () => {
    const sys = courtFilingSystem('lagos')
    expect(sys).toMatch(/Never copy «…» or any of the words inside it/)
    expect(sys).toMatch(/left as a dotted line .* never "Not known"/)
    expect(sys).toMatch(/write both party names in CAPITALS/)
    expect(sys).toMatch(/₦600,000.00 \(Six Hundred Thousand Naira\)/)
    const complaint = draftInstruction('complaint', 'lagos')
    expect(complaint).toContain("IN THE MAGISTRATES' COURT OF LAGOS STATE (SMALL CLAIMS)")
    expect(complaint).toContain('C. PARTICULARS OF CLAIM(S)')
    expect(complaint).toContain("CLAIMANT'S SIGNATURE / THUMB PRINT")
    expect(complaint).not.toContain('PASSPORT PHOTOGRAPH HERE')
    expect(draftInstruction('complaint', 'delta')).toContain('A. PARTICULARS OF PLAINTIFF(S)')
    expect(draftInstruction('summons', 'lagos')).toContain('complete and return Form SCA 5 to the Registry of the Small Claims Court within 7 days after the service of this Summons, including the day of service')
    expect(draftInstruction('summary_judgment', 'lagos')).toContain('Entering Summary Judgment against the Defendant')
    const aff = draftInstruction('sj_affidavit', 'lagos')
    expect(aff).toContain('Notwithstanding the issuance of a Letter of Demand, Defendant failed to liquidate his indebtedness to me.')
    expect(aff).toContain('Lettered sub-paragraphs (a), (b), (c)')
    expect(aff).toContain('MAGISTERIAL DISTRICT')
    expect(draftInstruction('s84_certificate', 'lagos')).toContain('SECTION 84 OF THE EVIDENCE ACT 2011')
    const ex = draftInstruction('exhibits', 'lagos')
    expect(ex).toContain('Never create an exhibit for a document that is not there')
    expect(ex).toContain('DOCUMENTS STILL TO OBTAIN')
    expect(sys).toMatch(/write them in the claimant's own voice/)
  })
})
