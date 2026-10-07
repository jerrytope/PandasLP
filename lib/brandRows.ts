// Turning the cells of a brand's sheet into borrowers, and borrowers back into the cells the
// app owns. Pure (no Google, no database), so all of it is unit-tested in
// lib/__tests__/brandRows.test.ts. The sync job (lib/brandSync.ts) does the I/O around it.
//
// Cells arrive as Google's UNFORMATTED values: text stays text, numbers are numbers, and real
// dates are serial numbers (days since 30 Dec 1899). Reading them unformatted avoids guessing
// whether "05/06/2026" was meant as 5 June or May 6 under some locale.

import { createHash } from 'crypto'
import {
  AGENT_COLUMNS,
  BRAND_CASE_STATUS_LABELS,
  BRAND_COLUMNS,
  BRAND_SHEET_HEADERS,
  validateHeaders,
  type BrandCaseStatus,
  type BrandSheetHeader,
} from './brandSheet'

export type Cell = string | number | boolean | null | undefined

/** One row as the brand left it, with every cell turned into trimmed text. */
export interface SheetRow {
  /** 1-based row number in the sheet. Only for writing back; NEVER an identity. */
  rowNumber: number
  values: Record<BrandSheetHeader, string>
  /** Date columns as typed, kept raw so a date serial can be read correctly. */
  raw: Partial<Record<BrandSheetHeader, Cell>>
}

const DATE_COLUMNS: BrandSheetHeader[] = ['Loan Date', 'Last Payment Date']

function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  return String(cell).trim()
}

/** Reads the whole sheet: checks the header row, then returns every non-empty row after it. */
export function parseSheetValues(values: Cell[][]): { ok: true; rows: SheetRow[] } | { ok: false; error: string } {
  const header = (values[0] ?? []).map(cellText)
  const check = validateHeaders(header)
  if (check.ok === false) return check

  const rows: SheetRow[] = []
  for (let i = 1; i < values.length; i++) {
    const cells = values[i] ?? []
    const row = Object.fromEntries(BRAND_SHEET_HEADERS.map((h, c) => [h, cellText(cells[c])])) as Record<BrandSheetHeader, string>
    const raw: SheetRow['raw'] = {}
    for (const h of DATE_COLUMNS) raw[h] = cells[BRAND_SHEET_HEADERS.indexOf(h)]
    if (BRAND_SHEET_HEADERS.every((h) => row[h] === '')) continue
    rows.push({ rowNumber: i + 1, values: row, raw })
  }
  return { ok: true, rows }
}

/** True when the brand hasn't typed anything into its own columns (e.g. a stray Case ID only). */
export function hasBorrowerData(row: SheetRow): boolean {
  return BRAND_COLUMNS.some((c) => row.values[c] !== '')
}

// ── Values ────────────────────────────────────────────────────────────────

/** "₦1,250,000.50", "N 50000", "250000" → number; anything else → null. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[₦,\s]/g, '').replace(/^(NGN|N)(?=\d)/i, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function isoDate(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  if (y < 1990 || y > 2100) return null
  return date.toISOString().slice(0, 10)
}

/**
 * A date cell → "YYYY-MM-DD", or null if it isn't a date. Accepts a real Sheets date (serial
 * number), 2026-01-15, 15/01/2026 (day first, as written in Nigeria), 15-01-2026 and 15 Jan 2026.
 */
export function parseSheetDate(cell: Cell): string | null {
  if (typeof cell === 'number') {
    if (cell < 1 || cell > 200000) return null
    const ms = Date.UTC(1899, 11, 30) + Math.round(cell) * 86_400_000
    const d = new Date(ms)
    return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  const text = cellText(cell)
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return isoDate(+m[1], +m[2], +m[3])
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return isoDate(+m[3], +m[2], +m[1])
  m = text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/)
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase())
    if (month >= 0) return isoDate(+m[3], month + 1, +m[1])
  }
  return null
}

/**
 * Nigerian phone numbers as typed. Sheets turns 08012345678 into the number 8012345678 unless
 * the column is formatted as text, so a 10-digit number starting 7/8/9 gets its 0 back.
 */
export function normalisePhone(text: string): string | null {
  const digits = text.replace(/[\s()-]/g, '')
  if (/^[789]\d{9}$/.test(digits)) return `0${digits}`
  if (/^0[789]\d{9}$/.test(digits)) return digits
  if (/^\+?234[789]\d{9}$/.test(digits)) return `+${digits.replace(/^\+/, '')}`
  return null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The Drive file or folder ID inside a sharing link, or null if it isn't a Google Drive link. */
export function driveFileIdFromUrl(url: string): string | null {
  if (!/^https:\/\/(drive|docs)\.google\.com\//.test(url)) return null
  const m = url.match(/\/(?:d|folders)\/([A-Za-z0-9_-]{10,})/) ?? url.match(/[?&]id=([A-Za-z0-9_-]{10,})/)
  return m ? m[1] : null
}

// ── Checking a borrower ───────────────────────────────────────────────────

export interface Borrower {
  fullName: string
  phone: string
  email: string
  addressForService: string
  loanAmount: number
  amountOutstanding: number
  loanDate: string
  lastPaymentDate: string | null
  documentsLink: string
  documentsFileId: string
  notes: string
}

/**
 * Everything the app can check without Google. Returns the borrower, or the list of what's
 * missing — in plain words, because this list is shown to the brand's staff and to ours.
 * Whether the Documents Link actually opens is checked separately (it needs Drive).
 */
export function checkBorrower(row: SheetRow): { ok: true; borrower: Borrower } | { ok: false; missing: string[] } {
  const v = row.values
  const missing: string[] = []

  if (!v['Borrower Full Name']) missing.push('Borrower Full Name')
  const phone = normalisePhone(v['Phone Number'])
  if (!v['Phone Number']) missing.push('Phone Number')
  else if (!phone) missing.push('Phone Number (not a valid Nigerian number)')
  if (!v['Email']) missing.push('Email (needed to send the reminders)')
  else if (!EMAIL_RE.test(v['Email'])) missing.push('Email (not a valid email address)')
  if (!v['Address for Service']) missing.push('Address for Service')
  else if (v['Address for Service'].length < 10) missing.push('Address for Service (too short to serve a letter at)')

  const loan = parseAmount(v['Loan Amount'])
  if (!v['Loan Amount']) missing.push('Loan Amount')
  else if (loan === null) missing.push('Loan Amount (not a number)')
  const outstanding = parseAmount(v['Amount Outstanding'])
  if (!v['Amount Outstanding']) missing.push('Amount Outstanding')
  else if (outstanding === null || outstanding <= 0) missing.push('Amount Outstanding (must be a number above 0)')
  if (loan !== null && outstanding !== null && outstanding > 0 && loan > 0 && outstanding > loan * 2) {
    // Interest and charges can push the balance above the principal, but not past double it
    // without someone checking: that's far more often a typo (an extra zero).
    missing.push('Amount Outstanding (more than twice the Loan Amount — please confirm)')
  }

  const loanDate = parseSheetDate(row.raw['Loan Date'] ?? v['Loan Date'])
  if (!v['Loan Date']) missing.push('Loan Date')
  else if (!loanDate) missing.push('Loan Date (not a valid date — use e.g. 15/01/2026)')
  const lastPaymentDate = v['Last Payment Date'] ? parseSheetDate(row.raw['Last Payment Date'] ?? v['Last Payment Date']) : null
  if (v['Last Payment Date'] && !lastPaymentDate) missing.push('Last Payment Date (not a valid date — use e.g. 15/01/2026)')

  const fileId = driveFileIdFromUrl(v['Documents Link'])
  if (!v['Documents Link']) missing.push('Documents Link (the loan documents)')
  else if (!fileId) missing.push('Documents Link (must be a Google Drive link — upload to the brand’s Documents folder)')

  if (missing.length > 0) return { ok: false, missing }
  return {
    ok: true,
    borrower: {
      fullName: v['Borrower Full Name'],
      phone: phone!,
      email: v['Email'].toLowerCase(),
      addressForService: v['Address for Service'],
      loanAmount: loan!,
      amountOutstanding: outstanding!,
      loanDate: loanDate!,
      lastPaymentDate,
      documentsLink: v['Documents Link'],
      documentsFileId: fileId!,
      notes: v['Notes'],
    },
  }
}

/**
 * A fingerprint of the brand's columns (except Notes, which the brand is ALLOWED to keep
 * updating). Stored when a row is picked up; if it later changes, the brand edited the row.
 */
export function snapshotHash(row: SheetRow): string {
  const tracked = BRAND_COLUMNS.filter((c) => c !== 'Notes').map((c) => [c, row.values[c]])
  return createHash('sha256').update(JSON.stringify(tracked)).digest('hex')
}

export function brandColumnsSnapshot(row: SheetRow): Record<string, string> {
  return Object.fromEntries(BRAND_COLUMNS.map((c) => [c, row.values[c]]))
}

// ── Writing back ──────────────────────────────────────────────────────────

const LAGOS_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' })
const LAGOS_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false })

/** "7 Oct 2026" in Lagos time, or '' for no date. */
export function sheetDate(iso: string | null | undefined): string {
  return iso ? LAGOS_DATE.format(new Date(iso)) : ''
}

/** "7 Oct 2026 14:05" in Lagos time. */
export function sheetDateTime(iso: string): string {
  const d = new Date(iso)
  return `${LAGOS_DATE.format(d)} ${LAGOS_TIME.format(d)}`
}

export interface BrandCaseState {
  status: BrandCaseStatus
  letter_url: string | null
  served_at: string | null
  day7_sent_at: string | null
  day14_sent_at: string | null
  updated_at: string
}

export type AgentCells = Record<(typeof AGENT_COLUMNS)[number], string>

/** The six app-owned cells for a borrower, straight from the database (the source of truth). */
export function agentCellsFor(c: BrandCaseState): AgentCells {
  return {
    Status: BRAND_CASE_STATUS_LABELS[c.status],
    'Letter Link': c.letter_url ?? '',
    'Date Served': sheetDate(c.served_at),
    'Day 7 Date': sheetDate(c.day7_sent_at),
    'Day 14 Date': sheetDate(c.day14_sent_at),
    'Last Updated': sheetDateTime(c.updated_at),
  }
}

/** True when the sheet's app-owned cells (ignoring Last Updated) don't match the database. */
export function agentCellsDiffer(row: SheetRow, cells: AgentCells): boolean {
  return AGENT_COLUMNS.some((c) => c !== 'Last Updated' && row.values[c] !== cells[c])
}
