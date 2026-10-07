// Runs the real sync engine against the LOCAL Supabase database (npx supabase start), with the
// pretend Google Drive and a stand-in for the AI. Skips itself when the local database isn't
// running or .env.local isn't pointed at it — it never touches the live database.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { FakeGoogleDrive } from '../google/fakeWorkspace'
import { emptySetupProgress } from '../google/workspaceTypes'
import type { BrandDrafter } from '../brandLetter'
import type * as SyncModule from '../brandSync'

function localEnv(): Record<string, string> | null {
  try {
    const text = readFileSync(path.resolve(__dirname, '../../.env.local'), 'utf8')
    const env = Object.fromEntries(
      text
        .split(/\r?\n/)
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
    )
    return env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http://127.0.0.1') ? env : null
  } catch {
    return null
  }
}

const env = localEnv()
const reachable = env
  ? await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY }, signal: AbortSignal.timeout(2000) })
      .then(() => true)
      .catch(() => false)
  : false

describe.skipIf(!reachable)('brand sync against the local database', () => {
  let sync: typeof SyncModule
  let db: typeof import('../supabaseAdmin').supabaseAdmin
  let drive: FakeGoogleDrive
  let brandId: string
  let ownerId: string
  let sheetId: string
  let docUrl: string
  let draftCalls: string[]
  const code = `ZT${Date.now().toString(36).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)}`

  /** Stand-in for the AI: one letter per call, or questions for the borrower named "Ask Me". */
  const draft: BrandDrafter = async ({ borrower, caseRef }) => {
    draftCalls.push(caseRef)
    await new Promise((r) => setTimeout(r, 50)) // a little real-world latency, so overlapping runs actually overlap
    if (borrower.fullName === 'Ask Me') return { ok: false, kind: 'needs_info', questions: ['Is there a guarantor?'] }
    return { ok: true, doc: { title: 'Letter of Demand', body: `Our Ref: {{REF_NUMBER}}\nDear ${borrower.fullName}, pay ₦${borrower.amountOutstanding}.` } }
  }
  const deps = () => ({ workspace: drive.workspace(), draft, now: () => new Date(), maxDraftsPerBrand: 10, deadline: Date.now() + 60_000 })

  const borrowerRow = (name: string, extra: Record<string, string | number> = {}) => ({
    'Borrower Full Name': name,
    'Phone Number': '08031234567',
    Email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    'Address for Service': '12 Allen Avenue, Ikeja, Lagos',
    'Loan Amount': 500000,
    'Amount Outstanding': 350000,
    'Loan Date': '15/01/2026',
    'Documents Link': docUrl,
    ...extra,
  })
  const statusOf = (name: string) => {
    const rows = drive.files.get(sheetId)!.rows!
    const r = rows.findIndex((cells) => cells[1] === name)
    return { caseId: drive.cell(sheetId, r + 1, 'Case ID'), status: drive.cell(sheetId, r + 1, 'Status') }
  }

  beforeAll(async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: env!.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env!.SUPABASE_SERVICE_ROLE_KEY,
    })
    db = (await import('../supabaseAdmin')).supabaseAdmin
    sync = await import('../brandSync')
    drive = new FakeGoogleDrive()
    draftCalls = []

    const { data: user, error: userErr } = await db.auth.admin.createUser({ email: `${code.toLowerCase()}@test.local`, email_confirm: true })
    if (userErr) throw userErr
    ownerId = user.user.id

    const progress = await drive.workspace().setupBrand({ name: 'Test Lender', code, contactEmails: ['ops@lender.test'] }, emptySetupProgress(), async () => {})
    sheetId = progress.sheetId!
    docUrl = `https://drive.google.com/file/d/${drive.addDocument(progress.documentsFolderId!)}/view`
    const { data: brand, error } = await db
      .from('brands')
      .insert({
        name: 'Test Lender',
        code,
        address: '18 Idowu Taylor Street, Victoria Island, Lagos',
        contact_emails: ['ops@lender.test'],
        per_letter_fee_kobo: 500000,
        created_by: 'test',
        owner_user_id: ownerId,
        sheet_id: progress.sheetId,
        sheet_tab_id: progress.sheetTabId,
        drive_folder_id: progress.driveFolderId,
        documents_folder_id: progress.documentsFolderId,
        letters_folder_id: progress.lettersFolderId,
        sheet_protected_at: progress.sheetProtectedAt,
        shared_with: progress.sharedWith,
        setup_completed_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) throw error
    brandId = brand.id
  }, 60_000) // imports the whole sync engine and creates a user: slower than the 10s default

  afterAll(async () => {
    if (!db || !brandId) return
    await db.from('cases').delete().eq('brand_id', brandId)
    await db.from('brand_change_flags').delete().eq('brand_id', brandId)
    await db.from('brand_cases').delete().eq('brand_id', brandId)
    await db.from('brands').delete().eq('id', brandId)
    if (ownerId) await db.auth.admin.deleteUser(ownerId)
  })

  it('gives each new row its own Case ID and marks it New, without drafting yet', async () => {
    drive.setRow(sheetId, 2, borrowerRow('Ada Obi'))
    drive.setRow(sheetId, 3, borrowerRow('Bayo Ade', { Email: '' }))
    drive.setRow(sheetId, 4, borrowerRow('Chi Eze'))
    const report = await sync.syncBrand(brandId, { ...deps(), maxDraftsPerBrand: 0 })
    expect(report).toMatchObject({ assigned: 3, drafted: 0 })
    expect([statusOf('Ada Obi'), statusOf('Bayo Ade'), statusOf('Chi Eze')]).toEqual([
      { caseId: `${code}-0001`, status: 'New' },
      { caseId: `${code}-0002`, status: 'New' },
      { caseId: `${code}-0003`, status: 'New' },
    ])
  })

  it('NEVER TWICE: two overlapping runs draft each borrower exactly once', async () => {
    const [a, b] = await Promise.all([sync.syncBrand(brandId, deps()), sync.syncBrand(brandId, deps())])
    expect(a.drafted + b.drafted).toBe(2)
    expect([...draftCalls].sort()).toEqual([`${code}-0001`, `${code}-0003`])

    const { data: events } = await db.from('brand_case_events').select('case_ref').eq('event_type', 'letter_drafted').like('case_ref', `${code}-%`)
    expect(events!.map((e) => e.case_ref).sort()).toEqual([`${code}-0001`, `${code}-0003`])
    const { count } = await db.from('cases').select('id', { count: 'exact', head: true }).eq('brand_id', brandId)
    expect(count).toBe(2)
  })

  it('writes the result back: Letter Drafted with a link, or Missing Documents', async () => {
    expect(statusOf('Ada Obi').status).toBe('Letter Drafted')
    expect(statusOf('Bayo Ade').status).toBe('Missing Documents')
    const row = drive.files.get(sheetId)!.rows!.find((r) => r[1] === 'Ada Obi')!
    expect(String(row[12])).toMatch(/^https:\/\/drive\.google\.com\/file\/d\//)

    const { data: matter } = await db.from('cases').select('status, document_body, expected_amount, delivery_option').eq('source_detail', `${code}-0001`).single()
    expect(matter).toMatchObject({ status: 'document_ready', expected_amount: 5000, delivery_option: 'pandas-serves' })
    expect(matter!.document_body).toMatch(new RegExp(`Our Ref: PLP/\\d{4}/\\d{6} \\(${code}-0001\\)`))
  })

  it('a later run does nothing new — no second letter, no second AI call', async () => {
    draftCalls = []
    const report = await sync.syncBrand(brandId, deps())
    expect(report).toMatchObject({ assigned: 0, drafted: 0 })
    expect(draftCalls).toEqual([])
  })

  it('keeps every borrower’s status on the right row after the brand sorts the sheet', async () => {
    drive.reverseDataRows(sheetId)
    await sync.syncBrand(brandId, deps())
    expect(statusOf('Ada Obi')).toEqual({ caseId: `${code}-0001`, status: 'Letter Drafted' })
    expect(statusOf('Bayo Ade')).toEqual({ caseId: `${code}-0002`, status: 'Missing Documents' })
    expect(statusOf('Chi Eze')).toEqual({ caseId: `${code}-0003`, status: 'Letter Drafted' })
  })

  it('re-checks a Missing Documents row once the brand fills the gap', async () => {
    const rows = drive.files.get(sheetId)!.rows!
    const r = rows.findIndex((cells) => cells[1] === 'Bayo Ade') + 1
    drive.setRow(sheetId, r, { ...borrowerRow('Bayo Ade'), 'Case ID': `${code}-0002` })
    await sync.syncBrand(brandId, deps())
    expect(statusOf('Bayo Ade').status).toBe('Letter Drafted')
  })

  it('turns the lawyer’s outstanding questions into Missing Documents', async () => {
    drive.setRow(sheetId, 6, borrowerRow('Ask Me'))
    await sync.syncBrand(brandId, deps())
    expect(statusOf('Ask Me').status).toBe('Missing Documents')
    const { data } = await db.from('brand_cases').select('missing_items').eq('case_ref', statusOf('Ask Me').caseId).single()
    expect(data!.missing_items).toEqual(['Lawyer’s question: Is there a guarantor?'])
  })

  it('flags a Case ID typed in by hand instead of processing it', async () => {
    drive.setRow(sheetId, 7, { ...borrowerRow('Made Up'), 'Case ID': `${code}-9999` })
    const report = await sync.syncBrand(brandId, deps())
    expect(report.flagged).toBe(1)
    expect(statusOf('Made Up').status).toBe('')
  })

  it('only one sync run at a time: an overlapping run backs off', async () => {
    const [a, b] = await Promise.all([
      sync.runBrandSync({ force: true, brandId, deps: deps() }),
      sync.runBrandSync({ force: true, brandId, deps: deps() }),
    ])
    expect([a.ran, b.ran].sort()).toEqual([false, true])
  })
})
