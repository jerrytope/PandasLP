import { describe, it, expect } from 'vitest'
import {
  agentCellsDiffer,
  agentCellsFor,
  checkBorrower,
  driveFileIdFromUrl,
  hasBorrowerData,
  normalisePhone,
  parseAmount,
  parseSheetDate,
  parseSheetValues,
  snapshotHash,
  type Cell,
} from '../brandRows'
import { BRAND_SHEET_HEADERS } from '../brandSheet'

type Header = (typeof BRAND_SHEET_HEADERS)[number]
const row = (values: Partial<Record<Header, Cell>>): Cell[] => BRAND_SHEET_HEADERS.map((h) => values[h] ?? '')

const DOC = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view'
const complete: Partial<Record<Header, Cell>> = {
  'Borrower Full Name': 'Chinedu Okafor',
  'Phone Number': 8031234567, // as Sheets stores it when the column isn't text: leading 0 lost
  Email: 'Chinedu@Example.com',
  'Address for Service': '12 Allen Avenue, Ikeja, Lagos',
  'Loan Amount': 500000,
  'Amount Outstanding': '₦350,000',
  'Loan Date': 46037, // a real Sheets date: 15 Jan 2026
  'Last Payment Date': '03/06/2026',
  'Documents Link': DOC,
}

function parsedRow(values: Partial<Record<Header, Cell>>) {
  const parsed = parseSheetValues([[...BRAND_SHEET_HEADERS], row(values)])
  if (parsed.ok === false) throw new Error(parsed.error)
  return parsed.rows[0]
}

describe('parseSheetValues', () => {
  it('skips empty rows and keeps the real row numbers', () => {
    const parsed = parseSheetValues([[...BRAND_SHEET_HEADERS], row({}), row({ 'Borrower Full Name': 'A' }), [], row({ 'Borrower Full Name': 'B' })])
    expect(parsed.ok && parsed.rows.map((r) => r.rowNumber)).toEqual([3, 5])
  })

  it('refuses a sheet whose header row was changed', () => {
    const headers = [...BRAND_SHEET_HEADERS] as string[]
    headers[1] = 'Customer'
    expect(parseSheetValues([headers]).ok).toBe(false)
  })

  it('tells a stray Case ID apart from a real borrower', () => {
    expect(hasBorrowerData(parsedRow({ 'Case ID': 'LAPO-0001' }))).toBe(false)
    expect(hasBorrowerData(parsedRow({ Notes: 'call me' }))).toBe(true)
  })
})

describe('values', () => {
  it('reads amounts with ₦, N, NGN and commas', () => {
    expect(parseAmount('₦1,250,000.50')).toBe(1250000.5)
    expect(parseAmount('N 50000')).toBe(50000)
    expect(parseAmount('NGN250000')).toBe(250000)
    expect(parseAmount('fifty thousand')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })

  it('reads dates day-first, as written in Nigeria, plus real Sheets dates', () => {
    expect(parseSheetDate(46037)).toBe('2026-01-15')
    expect(parseSheetDate('05/06/2026')).toBe('2026-06-05')
    expect(parseSheetDate('2026-06-05')).toBe('2026-06-05')
    expect(parseSheetDate('5 Jun 2026')).toBe('2026-06-05')
    expect(parseSheetDate('31/02/2026')).toBeNull()
    expect(parseSheetDate('soon')).toBeNull()
  })

  it('restores the leading 0 Sheets drops from Nigerian phone numbers', () => {
    expect(normalisePhone('8031234567')).toBe('08031234567')
    expect(normalisePhone('0803 123 4567')).toBe('08031234567')
    expect(normalisePhone('+2348031234567')).toBe('+2348031234567')
    expect(normalisePhone('12345')).toBeNull()
  })

  it('finds the file ID in Drive links, and rejects other links', () => {
    expect(driveFileIdFromUrl(DOC)).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz')
    expect(driveFileIdFromUrl('https://drive.google.com/drive/folders/1FolderIdAbCdEf')).toBe('1FolderIdAbCdEf')
    expect(driveFileIdFromUrl('https://dropbox.com/s/abc/file.pdf')).toBeNull()
  })
})

describe('checkBorrower', () => {
  it('accepts a complete row and normalises it', () => {
    const result = checkBorrower(parsedRow(complete))
    expect(result).toMatchObject({
      ok: true,
      borrower: {
        phone: '08031234567',
        email: 'chinedu@example.com',
        loanAmount: 500000,
        amountOutstanding: 350000,
        loanDate: '2026-01-15',
        lastPaymentDate: '2026-06-03',
        documentsFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
      },
    })
  })

  it('lists everything missing in plain words', () => {
    const result = checkBorrower(parsedRow({ 'Borrower Full Name': 'Ada', 'Loan Amount': 'lots', 'Documents Link': 'https://dropbox.com/x' }))
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.missing).toEqual([
        'Phone Number',
        'Email (needed to send the reminders)',
        'Address for Service',
        'Loan Amount (not a number)',
        'Amount Outstanding',
        'Loan Date',
        'Documents Link (must be a Google Drive link — upload to the brand’s Documents folder)',
      ])
    }
  })

  it('treats Last Payment Date as optional, but checks it when given', () => {
    expect(checkBorrower(parsedRow({ ...complete, 'Last Payment Date': '' })).ok).toBe(true)
    expect(checkBorrower(parsedRow({ ...complete, 'Last Payment Date': 'last week' })).ok).toBe(false)
  })

  it('questions a balance more than double the loan (usually a typo)', () => {
    const result = checkBorrower(parsedRow({ ...complete, 'Amount Outstanding': 5000000 }))
    expect(result.ok === false && result.missing[0]).toContain('more than twice')
  })
})

describe('snapshotHash', () => {
  it('changes when a brand column changes, but not when only Notes change', () => {
    const base = snapshotHash(parsedRow(complete))
    expect(snapshotHash(parsedRow({ ...complete, Notes: 'promised to pay Friday' }))).toBe(base)
    expect(snapshotHash(parsedRow({ ...complete, 'Amount Outstanding': 300000 }))).not.toBe(base)
  })
})

describe('agent cells', () => {
  const state = {
    status: 'letter_drafted' as const,
    letter_url: 'https://drive.google.com/file/d/x/view',
    served_at: null,
    day7_sent_at: null,
    day14_sent_at: null,
    updated_at: '2026-10-07T13:05:00Z',
  }

  it('shows the database state in the brand’s words, in Lagos time', () => {
    expect(agentCellsFor(state)).toEqual({
      Status: 'Letter Drafted',
      'Letter Link': state.letter_url,
      'Date Served': '',
      'Day 7 Date': '',
      'Day 14 Date': '',
      'Last Updated': '7 Oct 2026 14:05',
    })
  })

  it('notices when the sheet has drifted from the database (ignoring Last Updated)', () => {
    const cells = agentCellsFor(state)
    expect(agentCellsDiffer(parsedRow({ ...complete, ...cells }), cells)).toBe(false)
    expect(agentCellsDiffer(parsedRow({ ...complete, ...cells, Status: 'Paid' }), cells)).toBe(true)
    expect(agentCellsDiffer(parsedRow({ ...complete, ...cells, 'Last Updated': 'yesterday' }), cells)).toBe(false)
  })
})
