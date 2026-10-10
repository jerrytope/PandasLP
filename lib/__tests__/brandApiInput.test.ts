import { describe, it, expect } from 'vitest'
import {
  decodeInlineDocument,
  documentUrlProblem,
  generateApiKey,
  hashApiKey,
  isPrivateAddress,
  parseBorrowerInput,
  readApiKey,
  safeFilename,
  toSheetRow,
} from '../brandApiInput'
import { checkBorrower } from '../brandRows'

const PDF_B64 = Buffer.from('%PDF-1.4 loan agreement').toString('base64')

const valid = {
  loan_id: 'LN-2026-00042',
  borrower_full_name: 'Adebayo Ogunleye',
  phone_number: '08031234501',
  email: 'adebayo@example.com',
  address_for_service: '5 Oke-Ado Road, Ibadan, Oyo State',
  loan_amount: 500000,
  amount_outstanding: '380000',
  loan_date: '2026-03-15',
  last_payment_date: '10/06/2026',
  notes: 'Sample',
  documents: [{ filename: 'agreement.pdf', content_base64: PDF_B64 }],
}

describe('API keys', () => {
  it('live and test keys look different, and only the hash is meant to be stored', () => {
    const live = generateApiKey('live')
    const test = generateApiKey('test')
    expect(live.key).toMatch(/^plp_live_[A-Za-z0-9_-]{32}$/)
    expect(test.key).toMatch(/^plp_test_[A-Za-z0-9_-]{32}$/)
    expect(live.hash).toBe(hashApiKey(live.key))
    expect(live.hash).not.toContain(live.key)
    expect(live.prefix).toBe(live.key.slice(0, 13))
  })

  it('reads a key from the Authorization header, and nothing else', () => {
    const { key } = generateApiKey('test')
    expect(readApiKey(`Bearer ${key}`)).toEqual({ key, mode: 'test' })
    expect(readApiKey(key)).toBeNull()
    expect(readApiKey('Bearer plp_live_short')).toBeNull()
    expect(readApiKey(null)).toBeNull()
  })
})

describe('reading a borrower from JSON', () => {
  it('maps the fields onto the same columns as the Google Sheet', () => {
    const r = parseBorrowerInput(valid)
    if (r.ok === false) throw new Error(r.errors.join(' '))
    expect(r.input.loanId).toBe('LN-2026-00042')
    expect(r.input.values['Borrower Full Name']).toBe('Adebayo Ogunleye')
    expect(r.input.values['Loan Amount']).toBe('500000')
    expect(r.input.values['Documents Link']).toBe('')
    expect(r.input.documents).toEqual([{ kind: 'inline', filename: 'agreement.pdf', base64: PDF_B64 }])
  })

  it('the sheet’s checks then accept it, with no Google Drive link needed', () => {
    const r = parseBorrowerInput(valid)
    if (r.ok === false) throw new Error('unexpected')
    const checked = checkBorrower(toSheetRow(r.input.values), { documentsStored: true })
    expect(checked.ok).toBe(true)
    if (checked.ok) expect(checked.borrower).toMatchObject({ loanDate: '2026-03-15', lastPaymentDate: '2026-06-10', amountOutstanding: 380000 })
  })

  it('a sheet row still needs its Drive link', () => {
    const r = parseBorrowerInput(valid)
    if (r.ok === false) throw new Error('unexpected')
    const checked = checkBorrower(toSheetRow(r.input.values))
    expect(checked.ok === false && checked.missing).toEqual(['Documents Link (the loan documents)'])
  })

  it('bad details are not a rejection: they become the Missing Documents list, like a sheet row', () => {
    const r = parseBorrowerInput({ ...valid, email: '', phone_number: '123' })
    if (r.ok === false) throw new Error('unexpected')
    const checked = checkBorrower(toSheetRow(r.input.values), { documentsStored: true })
    expect(checked.ok === false && checked.missing).toEqual(['Phone Number (not a valid Nigerian number)', 'Email (needed to send the reminders)'])
  })

  it('rejects the wrong shape with a clear reason', () => {
    expect(parseBorrowerInput([])).toMatchObject({ ok: false })
    expect(parseBorrowerInput({ ...valid, loan_id: '' })).toMatchObject({ ok: false, errors: [expect.stringContaining('loan_id is required')] })
    expect(parseBorrowerInput({ ...valid, loan_id: 'has spaces in it' })).toMatchObject({ ok: false })
    expect(parseBorrowerInput({ ...valid, phone: '0803' })).toMatchObject({ ok: false, errors: [expect.stringContaining('Unknown field: phone')] })
    expect(parseBorrowerInput({ ...valid, loan_amount: { n: 1 } })).toMatchObject({ ok: false, errors: ['loan_amount must be text or a number.'] })
  })

  it('each document is either inside the JSON or a link, never both or neither', () => {
    expect(parseBorrowerInput({ ...valid, documents: [{ filename: 'a.pdf' }] })).toMatchObject({ ok: false })
    expect(parseBorrowerInput({ ...valid, documents: [{ content_base64: PDF_B64, url: 'https://x.com/a.pdf' }] })).toMatchObject({ ok: false })
    const link = parseBorrowerInput({ ...valid, documents: [{ url: 'https://files.lender.ng/a.pdf' }] })
    expect(link.ok && link.input.documents).toEqual([{ kind: 'url', filename: 'document-1', url: 'https://files.lender.ng/a.pdf' }])
    expect(parseBorrowerInput({ ...valid, documents: Array(6).fill({ content_base64: PDF_B64 }) })).toMatchObject({ ok: false })
  })
})

describe('documents', () => {
  it('decodes base64, with or without a data: prefix, and refuses anything else', () => {
    expect(decodeInlineDocument(PDF_B64)?.toString()).toBe('%PDF-1.4 loan agreement')
    expect(decodeInlineDocument(`data:application/pdf;base64,${PDF_B64}`)?.toString()).toBe('%PDF-1.4 loan agreement')
    expect(decodeInlineDocument('not base64!!')).toBeNull()
    expect(decodeInlineDocument('')).toBeNull()
  })

  it('makes filenames safe for storage', () => {
    expect(safeFilename('../../etc/passwd', 'x')).toBe('etc-passwd')
    expect(safeFilename('Loan Agreement (signed).pdf', 'x')).toBe('Loan-Agreement-signed-.pdf')
    expect(safeFilename('', 'document-1')).toBe('document-1')
  })
})

describe('fetching links safely', () => {
  it('never reaches our own machine or a private network', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.4.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true)
    }
    for (const ip of ['102.89.4.1', '8.8.8.8', '2001:4860:4860::8888']) expect(isPrivateAddress(ip)).toBe(false)
    expect(isPrivateAddress('not-an-ip')).toBe(true)
  })

  it('only secure public links are accepted', () => {
    expect(documentUrlProblem('https://files.lender.ng/loan.pdf')).toBeNull()
    expect(documentUrlProblem('http://files.lender.ng/loan.pdf')).toBe('must start with https://')
    expect(documentUrlProblem('https://127.0.0.1/x.pdf')).toBe('points to a private address')
    expect(documentUrlProblem('https://localhost/x.pdf')).toBe('points to a private address')
    expect(documentUrlProblem('https://user:pw@files.lender.ng/x.pdf')).toBe('must not contain a username or password')
    expect(documentUrlProblem('not a url')).toBe('is not a valid web address')
  })
})
