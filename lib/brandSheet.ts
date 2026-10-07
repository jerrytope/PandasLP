// The fixed layout of every brand's Google Sheet, and the rules about it. Pure (no Google, no
// database), so it is unit-tested in lib/__tests__/brandSheet.test.ts. The template sheet the
// owner creates in Drive must have exactly these headers in row 1, in this order (A–Q).

export const BRAND_SHEET_HEADERS = [
  'Case ID',
  'Borrower Full Name',
  'Phone Number',
  'Email',
  'Address for Service',
  'Loan Amount',
  'Amount Outstanding',
  'Loan Date',
  'Last Payment Date',
  'Documents Link',
  'Notes',
  'Status',
  'Letter Link',
  'Date Served',
  'Day 7 Date',
  'Day 14 Date',
  'Last Updated',
] as const

export type BrandSheetHeader = (typeof BRAND_SHEET_HEADERS)[number]

/** Columns the brand types into. Case ID is filled by the app, so it is NOT one of them. */
export const BRAND_COLUMNS = [
  'Borrower Full Name',
  'Phone Number',
  'Email',
  'Address for Service',
  'Loan Amount',
  'Amount Outstanding',
  'Loan Date',
  'Last Payment Date',
  'Documents Link',
  'Notes',
] as const satisfies readonly BrandSheetHeader[]

/** Columns only the app writes. Protected in the sheet, together with Case ID and the header row. */
export const AGENT_COLUMNS = ['Status', 'Letter Link', 'Date Served', 'Day 7 Date', 'Day 14 Date', 'Last Updated'] as const satisfies readonly BrandSheetHeader[]

export const CASE_ID_COLUMN: BrandSheetHeader = 'Case ID'

/** brand_cases.status in the database, and the label the brand sees in the Status column. */
export const BRAND_CASE_STATUS_LABELS = {
  new: 'New',
  checking: 'Checking',
  missing_documents: 'Missing Documents',
  letter_drafted: 'Letter Drafted',
  lawyer_approved: 'Lawyer Approved',
  served: 'Served',
  day7_sent: 'Day 7 Sent',
  day14_sent: 'Day 14 Sent',
  paid: 'Paid',
  disputed: 'Disputed',
  closed: 'Closed',
} as const

export type BrandCaseStatus = keyof typeof BRAND_CASE_STATUS_LABELS

export const BRAND_CASE_STATUS_VALUES = Object.values(BRAND_CASE_STATUS_LABELS)

/** Zero-based column index of a header in the fixed layout (A = 0). */
export function columnIndex(header: BrandSheetHeader): number {
  return BRAND_SHEET_HEADERS.indexOf(header)
}

/** Spreadsheet column letter for a header (A, B, … Q). The layout has fewer than 26 columns. */
export function columnLetter(header: BrandSheetHeader): string {
  return String.fromCharCode(65 + columnIndex(header))
}

/**
 * Checks a sheet's actual header row against the fixed layout. Columns are always matched by
 * header NAME, but a renamed, missing or reordered header means the brand changed the sheet's
 * structure — the sync stops for that brand rather than guess which column is which.
 */
export function validateHeaders(row: readonly string[]): { ok: true } | { ok: false; error: string } {
  const actual = BRAND_SHEET_HEADERS.map((_, i) => (row[i] ?? '').trim())
  const wrong = BRAND_SHEET_HEADERS.flatMap((expected, i) =>
    actual[i] === expected ? [] : [`column ${String.fromCharCode(65 + i)} should be "${expected}" but is "${actual[i] || '(empty)'}"`],
  )
  if (wrong.length === 0) return { ok: true }
  return { ok: false, error: `The sheet's header row has been changed: ${wrong.join('; ')}.` }
}

/** Brand codes are the Case ID prefix: 2–8 capital letters, matching the database CHECK. */
export function isValidBrandCode(code: string): boolean {
  return /^[A-Z]{2,8}$/.test(code)
}

/** Case IDs look like LAPO-0001 (at least 4 digits; grows past 9999). */
export function isValidCaseRef(ref: string): boolean {
  return /^[A-Z]{2,8}-\d{4,}$/.test(ref)
}
