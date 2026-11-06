import { describe, expect, it } from 'vitest'
import { fillLagosForm, isLagosForm, lagosNarrativeNeeded, splitNarrative, LAGOS_FIXED_LINES, LAGOS_FORM_KINDS, type LagosFormInput } from '../lagosForms'

const input: LagosFormInput = {
  facts: {
    claimant: { name: 'Chidera Okafor', residentialAddress: '12 Bode Thomas Street, Surulere, Lagos', phone: '+2348011111111', email: 'chidera@example.com' },
    defendant: { name: 'Acme Ventures Limited (Attention: Mr John Bello)', workAddress: '4 Allen Avenue, Ikeja, Lagos', phone: '+2348022222222' },
    amount: 600_000,
    dueDate: '2026-01-01',
    interestRate: 10,
  },
  registry: 'Ikeja',
  filedAt: '2026-07-01',
}

describe('Lagos Small Claims forms', () => {
  it('applies only to Lagos and only to SCA 2, 3, 3A and 3B', () => {
    expect(isLagosForm('complaint', 'lagos')).toBe(true)
    expect(isLagosForm('complaint', 'delta')).toBe(false)
    expect(isLagosForm('demand_form', 'lagos')).toBe(false)
    expect(lagosNarrativeNeeded('summons')).toBe(false)
    expect(lagosNarrativeNeeded('sj_affidavit')).toBe(true)
  })

  it('keeps every printed line of each form, word for word', () => {
    for (const kind of LAGOS_FORM_KINDS) {
      const text = fillLagosForm(kind, input, 'narrative')
      for (const line of LAGOS_FIXED_LINES[kind]) expect(text, `${kind}: ${line}`).toContain(line)
      expect(text).not.toMatch(/[«»{}]/)
    }
  })

  it('fills the complaint form particulars from the record', () => {
    const t = fillLagosForm('complaint', input, 'On 1 December 2025 I paid the defendant.')
    expect(t).toContain('FULL NAME: Chidera Okafor')
    expect(t).toContain('RESIDENTIAL ADDRESS: 12 Bode Thomas Street, Surulere, Lagos')
    expect(t).toContain('TELEPHONE NO.(S) & E-MAIL ADDRESS: +2348011111111; e-mail: chidera@example.com')
    expect(t).toContain('WORK ADDRESS: 4 Allen Avenue, Ikeja, Lagos')
    expect(t).toContain('TOTAL SUM CLAIMED: ₦600,000.00 (Six Hundred Thousand Naira)')
    expect(t).toContain('INTEREST: ₦29,753.00, being simple interest at 10% per annum on ₦600,000.00 from 1 January 2026 to 1 July 2026, and further interest at 10% per annum from 1 July 2026 until judgment')
    expect(t).toContain('COSTS: ₦200,000.00, being cost of litigation')
    expect(t).toContain('On 1 December 2025 I paid the defendant.')
    // Unknown particulars are dotted lines, never "not known".
    expect(t).toMatch(/A\. PARTICULARS OF CLAIMANT\(S\)\nFULL NAME: .+\nWORK ADDRESS: …+\n/)
    expect(t).toContain('+2348022222222; e-mail: ……')
    expect(t.toLowerCase()).not.toContain('not known')
  })

  it('fills the summons, leaving what the registry completes blank', () => {
    const t = fillLagosForm('summons', input)
    expect(t).toContain('CHIDERA OKAFOR …')
    expect(t).toContain('ACME VENTURES LIMITED …')
    expect(t).not.toContain('ATTENTION')
    expect(t).toContain('Debt (particulars are attached): ₦600,000.00')
    expect(t).toContain('Costs: ₦200,000.00')
    expect(t).toMatch(/Court Fees: …+/)
    expect(t).toContain('To: Acme Ventures Limited (Attention: Mr John Bello)\n4 Allen Avenue,\nIkeja,\nLagos')
    expect(t).toMatch(/CLAIM NO: …+/)
    expect(t).toContain('before this Court on the ………… day of')
  })

  it('fills the claim number and hearing date once the registry has issued them', () => {
    const t = fillLagosForm('summons', { ...input, claimNumber: 'MCL/SCC/123/2026', firstHearingAt: '2026-07-15T09:00:00+01:00' })
    expect(t).toContain('CLAIM NO: MCL/SCC/123/2026')
    expect(t).toContain('before this Court on the 15th day of July 2026 at 9:00 am')
    // The form's own date line stays blank: the registry dates it.
    expect(t).toContain('Dated at …………………………… this ………… day of ………… 20……')
  })

  it('fills the summary judgment application', () => {
    const t = fillLagosForm('summary_judgment', input)
    expect(t).toContain('in the sum of [₦600,000.00] plus interest and costs.')
    expect(t).toContain('ADDRESS: 12 Bode Thomas Street, Surulere, Lagos')
    expect(t).toContain("DEFENDANT'S NAME: Acme Ventures Limited (Attention: Mr John Bello)")
    expect(t).toContain('ADDRESS: 4 Allen Avenue, Ikeja, Lagos')
  })

  it('fills the affidavit around the narrative paragraph 6', () => {
    const t = fillLagosForm('sj_affidavit', input, '(a) I agreed with the Defendant.\n(b) I paid.')
    expect(t).toContain('IN THE IKEJA MAGISTERIAL DISTRICT')
    expect(t).toContain('HOLDEN AT IKEJA')
    expect(t).toContain('I, [Chidera Okafor] of [12 Bode Thomas Street, Surulere, Lagos] Lagos State do hereby make an oath and state as follows.')
    expect(t).toContain('2. The Defendant is indebted to me in the sum of [₦600,000.00]')
    expect(t).toContain('6. The indebtedness arose on account of:\n(a) I agreed with the Defendant.\n(b) I paid.\n7. I depose')
  })

  it('separates practitioner notes and stray headings from the narrative', () => {
    const r = splitNarrative('**SUMMARISE YOUR COMPLAINT AND STATE THE STEPS:**\nI paid.\n\nPRACTITIONER NOTES\nPayee name differs.')
    expect(r.narrative).toBe('I paid.')
    expect(r.notes).toBe('Payee name differs.')
  })
})

describe('Lagos forms: printed misprints corrected', () => {
  it('uses the corrected wording', () => {
    const all = LAGOS_FORM_KINDS.map((k) => fillLagosForm(k, input, 'x')).join('\n')
    expect(all).toContain("CLAIMANT'S SIGNATURE/ THUMB PRINT")
    expect(all).toContain('If you require a longer time for payment')
    expect(all).toContain('(SMALL CLAIMS) REGISTRY THIS …')
    expect(all).toContain('who is blind (or illiterate)')
    expect(all).toContain('made his mark (or signature)')
    expect(all).not.toMatch(/THUMP|If require|THIS THIS|"blind|\*blind|remark/)
  })
})
