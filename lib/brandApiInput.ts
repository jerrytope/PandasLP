// The brand API's input rules, kept pure (no database, no network) so they are unit-tested in
// lib/__tests__/brandApiInput.test.ts. lib/brandApi.ts does the I/O around them.
//
// A borrower sent by API is turned into exactly the same fields as a sheet row (the same
// column names), so every check the sheet path runs (checkBorrower in lib/brandRows.ts) runs
// unchanged on API borrowers. Plan: plans/phase-5-api-intake.md.

import { createHash, randomBytes } from 'crypto'
import { isIP } from 'net'
import { BRAND_SHEET_HEADERS, type BrandSheetHeader } from './brandSheet'
import type { SheetRow } from './brandRows'

// ── Keys ──────────────────────────────────────────────────────────────────

export type ApiKeyMode = 'test' | 'live'

/** A new key: shown to staff once, then only its hash is kept. Format: plp_live_<32 chars>. */
export function generateApiKey(mode: ApiKeyMode): { key: string; prefix: string; hash: string } {
  const key = `plp_${mode}_${randomBytes(24).toString('base64url')}`
  return { key, prefix: key.slice(0, 13), hash: hashApiKey(key) }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/** The key from an `Authorization: Bearer plp_…` header, or null if it isn't one of ours. */
export function readApiKey(authorization: string | null): { key: string; mode: ApiKeyMode } | null {
  const m = /^Bearer\s+(plp_(test|live)_[A-Za-z0-9_-]{32})$/.exec((authorization ?? '').trim())
  return m ? { key: m[1], mode: m[2] as ApiKeyMode } : null
}

// ── Borrowers ─────────────────────────────────────────────────────────────

/** JSON field → sheet column. The same fields as the brand's Google Sheet. */
export const API_FIELDS = {
  borrower_full_name: 'Borrower Full Name',
  phone_number: 'Phone Number',
  email: 'Email',
  address_for_service: 'Address for Service',
  loan_amount: 'Loan Amount',
  amount_outstanding: 'Amount Outstanding',
  loan_date: 'Loan Date',
  last_payment_date: 'Last Payment Date',
  notes: 'Notes',
} as const satisfies Record<string, BrandSheetHeader>

const ALLOWED_KEYS = new Set<string>(['loan_id', 'documents', ...Object.keys(API_FIELDS)])

export const MAX_BATCH = 50
export const MAX_DOCUMENTS = 5
/** "Less than 1 MB per borrower", all documents together. */
export const MAX_DOCUMENT_BYTES = 1024 * 1024
const LOAN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._/:-]{0,99}$/

export type DocumentInput =
  | { kind: 'inline'; filename: string; base64: string }
  | { kind: 'url'; filename: string; url: string }

export interface BorrowerInput {
  loanId: string
  /** The sheet columns, as text. Documents Link and the app's columns are always ''. */
  values: Record<BrandSheetHeader, string>
  documents: DocumentInput[]
}

function asText(v: unknown): string | null {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}

/** A filename safe to use in a storage path. */
export function safeFilename(name: string, fallback: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '').slice(0, 80)
  return cleaned || fallback
}

/**
 * Checks the SHAPE of one submitted borrower (fields, types, documents). Whether the details are
 * good enough to draft a letter (a valid phone, an amount, a date) is checkBorrower's job, so
 * those problems become "Missing Documents" exactly as they do for a sheet row.
 */
export function parseBorrowerInput(raw: unknown): { ok: true; input: BorrowerInput } | { ok: false; loanId: string | null; errors: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, loanId: null, errors: ['Each borrower must be a JSON object.'] }
  const obj = raw as Record<string, unknown>
  const errors: string[] = []

  const loanId = typeof obj.loan_id === 'string' ? obj.loan_id.trim() : typeof obj.loan_id === 'number' ? String(obj.loan_id) : ''
  if (!loanId) errors.push('loan_id is required (your own ID for this loan).')
  else if (!LOAN_ID_RE.test(loanId)) errors.push('loan_id may only contain letters, numbers and . _ / : - (at most 100 characters).')

  const unknown = Object.keys(obj).filter((k) => !ALLOWED_KEYS.has(k))
  if (unknown.length) errors.push(`Unknown field${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}. Allowed: ${[...ALLOWED_KEYS].join(', ')}.`)

  const values = Object.fromEntries(BRAND_SHEET_HEADERS.map((h) => [h, ''])) as Record<BrandSheetHeader, string>
  for (const [field, column] of Object.entries(API_FIELDS)) {
    const text = asText(obj[field])
    if (text === null) errors.push(`${field} must be text or a number.`)
    else values[column] = text.slice(0, column === 'Notes' ? 2000 : 500)
  }

  const documents: DocumentInput[] = []
  if (obj.documents !== undefined) {
    if (!Array.isArray(obj.documents)) errors.push('documents must be a list.')
    else if (obj.documents.length > MAX_DOCUMENTS) errors.push(`At most ${MAX_DOCUMENTS} documents per borrower.`)
    else {
      obj.documents.forEach((d, i) => {
        const n = i + 1
        if (!d || typeof d !== 'object') return void errors.push(`documents[${i}] must be an object.`)
        const doc = d as Record<string, unknown>
        const filename = safeFilename(typeof doc.filename === 'string' ? doc.filename : '', `document-${n}`)
        const hasInline = typeof doc.content_base64 === 'string' && doc.content_base64.length > 0
        const hasUrl = typeof doc.url === 'string' && doc.url.length > 0
        if (hasInline === hasUrl) return void errors.push(`documents[${i}] needs exactly one of content_base64 or url.`)
        if (hasInline) documents.push({ kind: 'inline', filename, base64: doc.content_base64 as string })
        else documents.push({ kind: 'url', filename, url: (doc.url as string).trim() })
      })
    }
  }

  if (errors.length) return { ok: false, loanId: loanId || null, errors }
  return { ok: true, input: { loanId, values, documents } }
}

/** A borrower's values as the sheet-shaped row checkBorrower expects. */
export function toSheetRow(values: Record<BrandSheetHeader, string>): SheetRow {
  return { rowNumber: 0, values, raw: {} }
}

/** Decodes a document sent inside the JSON (plain base64, or a data: URL). Null if it isn't base64. */
export function decodeInlineDocument(base64: string): Buffer | null {
  const body = base64.replace(/^data:[\w/+.-]+;base64,/, '').replace(/\s+/g, '')
  if (!body || body.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return null
  return Buffer.from(body, 'base64')
}

// ── Fetching document links safely ────────────────────────────────────────

/**
 * True for addresses a fetch must never reach: our own machine and private networks (the
 * classic way to turn "fetch this URL" into a look inside someone's infrastructure).
 */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    )
  }
  if (v === 6) {
    const lower = ip.toLowerCase()
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
    if (mapped) return isPrivateAddress(mapped[1])
    return lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith('ff')
  }
  return true // not an IP at all: never treat as safe
}

/** Rules a document link must pass before we even look it up. Returns the reason it's refused, or null. */
export function documentUrlProblem(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return 'is not a valid web address'
  }
  if (u.protocol !== 'https:') return 'must start with https://'
  if (u.username || u.password) return 'must not contain a username or password'
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return 'points to a private address'
  if (isIP(host) && isPrivateAddress(host)) return 'points to a private address'
  return null
}
