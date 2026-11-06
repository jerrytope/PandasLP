import { describe, expect, it } from 'vitest'
import { claimFigures, packKinds } from '../courtFiling'
import { clientPackMessage, unfilledPlaceholders, FIRM_WHATSAPP } from '../courtPackEmail'
import { buildCourtPackPdf } from '../courtFormPdf.js'
import { getCourtPackEmailHtml } from '../emailTemplates'

const lagos = {
  clientName: 'Olubunmi Tadema',
  defendantName: 'Zenith Bank Plc',
  state: 'lagos',
  registry: 'Magistrates’ Court, Igbosere',
  kinds: packKinds('lagos'),
  caseNumber: 42,
  figures: claimFigures({ amount: 365_000, dueDate: '2025-10-05' }, '2026-10-05'),
}

describe('e-mail to the client with the filing pack', () => {
  it('tells the client what to do, form by form', () => {
    const { subject, text } = clientPackMessage(lagos)
    expect(subject).toBe('Your court papers to sign (case #42) | Pandas LP')
    expect(text).toMatch(/^Dear Olubunmi,/)
    expect(text).toContain('against Zenith Bank Plc')
    expect(text).toContain('passport photograph at the top right of the first page of Form SCA 2')
    expect(text).toContain('"Claimant\'s signature" on Form SCA 1, Form SCA 2 and Form SCA 3A')
    expect(text).toContain('Do NOT sign Form SCA 3B (the affidavit) yet')
    expect(text).toContain('Section 84 certificate')
    expect(text).toMatch(/Scan every signed page.*replying to this e-mail or on WhatsApp/)
    expect(text).toContain('the Small Claims registry at Magistrates’ Court, Igbosere with a valid ID')
    expect(text).toContain(FIRM_WHATSAPP)
  })

  it('states the debt, the calculated interest, the costs and the total', () => {
    const { text } = clientPackMessage(lagos)
    expect(text).toContain('WHAT WE ARE CLAIMING')
    expect(text).toContain('- The debt: ₦365,000.00')
    expect(text).toContain('- Interest: ₦36,500.00 (10% a year from 5 October 2025 to 5 October 2026), and further interest at 10% a year until judgment')
    expect(text).toContain('- Costs: ₦200,000.00 (cost of litigation)')
    expect(text).toContain('- Total: ₦601,500.00, plus the court fees the registry sets')
  })

  it('leaves out the summary judgment steps outside Lagos', () => {
    const { text } = clientPackMessage({ ...lagos, state: 'delta', kinds: packKinds('delta') })
    expect(text).not.toContain('3B')
    expect(text).toContain('We will tell you if you need to come to the registry')
  })

  it('flags placeholders a practitioner has not filled, but not the photograph box', () => {
    expect(unfilledPlaceholders(['[AFFIX THE CLAIMANT\'S PASSPORT PHOTOGRAPH HERE]\nTO: [DEFENDANT\'S RESIDENTIAL ADDRESS]', 'Total: ₦601,500'])).toEqual(["[DEFENDANT'S RESIDENTIAL ADDRESS]"])
  })

  it('renders the message as branded HTML with lists and a WhatsApp button', () => {
    const html = getCourtPackEmailHtml(clientPackMessage(lagos).text, 'https://wa.me/2348118080189')
    expect(html).toContain('<ol')
    expect(html).toContain('WHAT WE ARE CLAIMING')
    expect(html).toContain('<li style="margin:0 0 8px;">Total: ₦601,500.00, plus the court fees the registry sets</li>')
    expect(html).toContain('Ask us on WhatsApp')
    expect(html).not.toContain('<script')
  })
})

describe('filing pack PDF', () => {
  it('puts each form on its own page', () => {
    expect(buildCourtPackPdf(['FORM SCA 1\nLETTER OF DEMAND\nTotal: ₦601,500', 'FORM SCA 2\nCOMPLAINT FORM']).getNumberOfPages()).toBe(2)
  })
})
