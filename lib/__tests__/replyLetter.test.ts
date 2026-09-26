import { describe, expect, it } from 'vitest'
import { isReplyHeading, parseReplyDraft, referenceFor } from '../replyLetter.js'
import { buildReplyLetterPdf } from '../pdfGenerator.js'
import { buildReplyLetterDocxBuffer } from '../docxGenerator.js'

const BODY = `We continue to act as Solicitors to Mr. Joel Ukpebor **(Our Client)**, and write in response to your recent correspondence.

1. ACCEPTANCE OF SUM SUBJECT TO STRICT TERMS:
For the sole purpose of amicable resolution, our client is willing to accept **₦3,300,000.00 (Three Million, Three Hundred Thousand Naira Only)**.

a. **DEADLINE FOR FULL PAYMENT:** The sum must be paid on or before **[DATE]**.

4. RESERVATION OF RIGHTS & COURT ACTION:
i. This conditional concession shall stand revoked.
ii. We hold strict instructions to commence legal proceedings.

We trust your client will take advantage of this final window to conclude this matter amicably.`

const LETTER = {
  date: '',
  ourRef: 'PLP/2026/000036',
  addressee: {
    firm: 'Odell Attorneys (Francisca Chambers)',
    email: 'odellattorneys@gmail.com',
    address: 'No 60 Okpe Road, Sapele, Delta State',
    attention: 'O. D. Onokpa Esq.',
  },
  salutation: 'Dear Sir,',
  re: 'LETTER OF DEMAND FOR RECOVERY OF OUTSTANDING SUM OF ₦3,300,000 (THREE MILLION, THREE HUNDRED THOUSAND NAIRA)',
  body: BODY,
  signatory: 'Adeyemo Adedeji',
}

describe('replyLetter', () => {
  it('recognises numbered section headings only', () => {
    expect(isReplyHeading('1. ACCEPTANCE OF SUM SUBJECT TO STRICT TERMS:')).toBe(true)
    expect(isReplyHeading('4. RESERVATION OF RIGHTS & COURT ACTION:')).toBe(true)
    expect(isReplyHeading('a. **DEADLINE FOR FULL PAYMENT:** The sum must be paid')).toBe(false)
    expect(isReplyHeading('i. This conditional concession shall stand revoked.')).toBe(false)
    expect(isReplyHeading('We trust your client will take advantage.')).toBe(false)
  })

  it('builds the reference the demand letter uses', () => {
    expect(referenceFor(36, new Date('2026-09-26T10:00:00Z'))).toBe('PLP/2026/000036')
    expect(referenceFor(null, new Date('2026-09-26T10:00:00Z'))).toBe('PLP/2026/PENDING')
  })

  it('splits the agent output into RE line, body and staff note', () => {
    const out = parseReplyDraft(`RE: LETTER OF DEMAND FOR RECOVERY OF OUTSTANDING SUM OF ₦3,300,000 (THREE MILLION, THREE HUNDRED THOUSAND NAIRA)
===BODY===
${BODY}
===STAFF NOTE===
Commits the firm to accepting ₦3.3m. [DATE] placeholders left for the lawyer.`)
    expect(out.re).toBe('LETTER OF DEMAND FOR RECOVERY OF OUTSTANDING SUM OF ₦3,300,000 (THREE MILLION, THREE HUNDRED THOUSAND NAIRA)')
    expect(out.body.startsWith('We continue to act as Solicitors')).toBe(true)
    expect(out.body.endsWith('conclude this matter amicably.')).toBe(true)
    expect(out.staffNote).toContain('Commits the firm')
  })

  it('strips a salutation and sign-off the agent added by mistake', () => {
    const out = parseReplyDraft(`Dear Sir,\n\n${BODY}\n\nYours faithfully,\nFOR: PANDAS LP\nAdeyemo Adedeji`)
    expect(out.body.startsWith('We continue')).toBe(true)
    expect(out.body).not.toContain('Yours faithfully')
  })

  it('builds the stamped PDF and the Word copy', async () => {
    const pdf = buildReplyLetterPdf(LETTER)
    const bytes = Buffer.from(pdf.output('arraybuffer'))
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1)

    const docx = await buildReplyLetterDocxBuffer(LETTER)
    expect(docx.subarray(0, 2).toString('ascii')).toBe('PK')
  })
})
