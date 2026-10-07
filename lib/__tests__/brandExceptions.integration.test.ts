// Phase 4 against the LOCAL Supabase database (npx supabase start): rows edited or deleted
// after processing, outcomes, court only with the brand's written approval, and monthly
// billing. Pretend Google Drive, stand-in AI and mailer. Skips itself when the local database
// isn't running or .env.local isn't pointed at it — it never touches the live database.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { FakeGoogleDrive } from '../google/fakeWorkspace'
import { emptySetupProgress } from '../google/workspaceTypes'
import { BRAND_SHEET_HEADERS } from '../brandSheet'
import type { BrandDrafter } from '../brandLetter'
import type { SendMailOptions } from '../mailer'
import type * as SyncModule from '../brandSync'
import type * as ServingModule from '../brandServing'
import type * as ExceptionsModule from '../brandExceptions'
import type * as BillingModule from '../brandBilling'

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

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

describe.skipIf(!reachable)('brand exceptions and billing against the local database', () => {
  let sync: typeof SyncModule
  let serving: typeof ServingModule
  let exc: typeof ExceptionsModule
  let billing: typeof BillingModule
  let db: typeof import('../supabaseAdmin').supabaseAdmin
  let drive: FakeGoogleDrive
  let brandId: string
  let ownerId: string
  let sheetId: string
  let docUrl: string
  const code = `ZX${Date.now().toString(36).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)}`
  const ada = `${code}-0001`
  const bola = `${code}-0002`
  const chidi = `${code}-0003`
  const matterOf: Record<string, string> = {}
  const clock = new Date('2026-10-08T09:00:00.000Z') // 10:00 in Lagos
  const mails: SendMailOptions[] = []
  let draftCalls = 0

  const draft: BrandDrafter = async ({ borrower }) => {
    draftCalls++
    return { ok: true, doc: { title: 'Letter of Demand', body: `Our Ref: {{REF_NUMBER}}\nDear ${borrower.fullName}.` } }
  }
  const deps = () => ({
    workspace: drive.workspace(),
    draft,
    now: () => clock,
    maxDraftsPerBrand: 10,
    deadline: Date.now() + 60_000,
    mail: async (m: SendMailOptions) => void mails.push(m),
  })
  const borrowerRow = (name: string, extra: Record<string, string | number> = {}) => ({
    'Borrower Full Name': name,
    'Phone Number': '08031234567',
    Email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    'Address for Service': '12 Allen Avenue, Ikeja, Lagos',
    'Loan Amount': 500000,
    'Amount Outstanding': 350000,
    'Loan Date': '15/01/2026',
    'Documents Link': docUrl,
    ...extra,
  })
  const rows = () => drive.files.get(sheetId)!.rows!
  const rowOf = (ref: string) => rows().findIndex((cells) => cells[0] === ref) + 1
  const setCell = (ref: string, header: (typeof BRAND_SHEET_HEADERS)[number], value: string) => {
    rows()[rowOf(ref) - 1][BRAND_SHEET_HEADERS.indexOf(header)] = value
  }
  const brandCase = async (ref: string) => (await db.from('brand_cases').select('*').eq('case_ref', ref).single()).data!
  const openFlags = async (ref: string) =>
    (await db.from('brand_change_flags').select('*').eq('case_ref', ref).is('resolved_at', null).order('detected_at')).data!

  beforeAll(async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: env!.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env!.SUPABASE_SERVICE_ROLE_KEY,
    })
    db = (await import('../supabaseAdmin')).supabaseAdmin
    sync = await import('../brandSync')
    serving = await import('../brandServing')
    exc = await import('../brandExceptions')
    billing = await import('../brandBilling')
    drive = new FakeGoogleDrive()

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

    drive.setRow(sheetId, 2, borrowerRow('Ada Obi'))
    drive.setRow(sheetId, 3, borrowerRow('Bola Ade'))
    drive.setRow(sheetId, 4, borrowerRow('Chidi Eze', { Email: '' })) // → Missing Documents, never billable
    expect(await sync.syncBrand(brandId, deps())).toMatchObject({ assigned: 3, drafted: 2, missing: 1 })
    for (const ref of [ada, bola]) {
      matterOf[ref] = (await db.from('cases').select('id').eq('source_detail', ref).single()).data!.id
      await serving.approveBrandLetter(matterOf[ref], 'lawyer@pandaslp.test', { workspace: drive.workspace(), now: () => clock })
      await db.from('cases').update({ status: 'letter_served', reviewed_at: clock.toISOString() }).eq('id', matterOf[ref])
      await serving.recordBrandServed(matterOf[ref], 'staff@pandaslp.test', { workspace: drive.workspace(), now: () => clock })
    }
    // Back to the same price list after the brand changes its fee: approval fixed it.
    await db.from('brands').update({ per_letter_fee_kobo: 900000 }).eq('id', brandId)
  }, 60_000)

  afterAll(async () => {
    if (!db || !brandId) return
    const { data: bcs } = await db.from('brand_cases').select('court_approval_evidence_path').eq('brand_id', brandId)
    const paths = (bcs ?? []).map((b) => b.court_approval_evidence_path).filter(Boolean) as string[]
    if (paths.length) await db.storage.from('case-evidence').remove(paths)
    await db.from('cases').delete().eq('brand_id', brandId)
    await db.from('brand_change_flags').delete().eq('brand_id', brandId)
    await db.from('brand_cases').delete().eq('brand_id', brandId)
    await db.from('invoices').delete().eq('brand_id', brandId)
    await db.from('brands').delete().eq('id', brandId)
    if (ownerId) await db.auth.admin.deleteUser(ownerId)
  })

  // ── Edited and deleted rows ──

  it('an edit after processing is flagged with old and new values, not reprocessed; the brand is told once', async () => {
    const drafts = draftCalls
    setCell(ada, 'Email', 'ada.new@example.com')
    await sync.syncBrand(brandId, deps())
    await sync.syncBrand(brandId, deps())

    const flags = await openFlags(ada)
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ kind: 'edited_after_processing', column_name: 'Email', old_value: 'ada.obi@example.com', new_value: 'ada.new@example.com' })
    expect(draftCalls).toBe(drafts)
    expect((await brandCase(ada)).status).toBe('served')

    const notices = mails.filter((m) => m.subject.startsWith('Changes to rows'))
    expect(notices).toHaveLength(1)
    expect(notices[0].to).toBe('ops@lender.test')
    expect(notices[0].text).toContain(`${ada}: Email changed from "ada.obi@example.com" to "ada.new@example.com"`)
  })

  it('Notes may change: logged, never flagged', async () => {
    setCell(bola, 'Notes', 'Borrower called, promised to pay Friday')
    await sync.syncBrand(brandId, deps())
    expect(await openFlags(bola)).toHaveLength(0)
    const { data: ev } = await db.from('brand_case_events').select('detail').eq('case_ref', bola).eq('event_type', 'notes_updated')
    expect(ev!.map((e) => e.detail.to)).toEqual(['Borrower called, promised to pay Friday'])
  })

  it('accepting a change makes it the record (reminders would use the new email) and the flag stays closed', async () => {
    const [flag] = await openFlags(ada)
    expect(await exc.resolveFlag(flag.id, 'accept', '', 'staff')).toMatchObject({ ok: false, status: 400 }) // a note is required
    expect(await exc.resolveFlag(flag.id, 'accept', 'Brand confirmed the new email by phone', 'staff')).toEqual({ ok: true })
    expect((await brandCase(ada)).borrower.Email).toBe('ada.new@example.com')
    await sync.syncBrand(brandId, deps())
    expect(await openFlags(ada)).toHaveLength(0)
  })

  it('keeping the original: the same new value is never flagged again', async () => {
    setCell(bola, 'Amount Outstanding', '999999')
    await sync.syncBrand(brandId, deps())
    const [flag] = await openFlags(bola)
    expect(await exc.resolveFlag(flag.id, 'keep', 'Typo by the brand; the letter amount stands', 'staff')).toEqual({ ok: true })
    await sync.syncBrand(brandId, deps())
    expect(await openFlags(bola)).toHaveLength(0)
    expect((await brandCase(bola)).borrower['Amount Outstanding']).toBe('350000')
    setCell(bola, 'Amount Outstanding', '350000')
  })

  it('a deleted row is flagged and the record kept; when it comes back the flag closes itself', async () => {
    const saved = [...rows()[rowOf(bola) - 1]]
    rows().splice(rowOf(bola) - 1, 1)
    await sync.syncBrand(brandId, deps())
    expect((await openFlags(bola)).map((f) => f.kind)).toEqual(['row_missing'])
    expect((await brandCase(bola)).row_missing_since).not.toBeNull()

    rows().push(saved)
    await sync.syncBrand(brandId, deps())
    expect(await openFlags(bola)).toHaveLength(0)
    expect((await brandCase(bola)).row_missing_since).toBeNull()
  })

  // ── Court ──

  it('court filing is refused for a brand borrower until the brand’s written approval is recorded', async () => {
    expect(await exc.courtFilingAllowed(matterOf[ada])).toBe(false)
    const id = (await brandCase(ada)).id
    expect(await exc.recordCourtApproval(id, 'ok', PNG, 'staff')).toMatchObject({ ok: false, status: 400 }) // note too short
    expect(await exc.recordCourtApproval(id, 'Email from Ade, Head of Recoveries, 3 Nov', Buffer.from('<html>'), 'staff')).toMatchObject({ ok: false, status: 400 })
    expect(await exc.recordCourtApproval(id, 'Email from Ade, Head of Recoveries, 3 Nov', PNG, 'staff')).toEqual({ ok: true })
    expect(await exc.courtFilingAllowed(matterOf[ada])).toBe(true)
    expect(await exc.recordCourtApproval(id, 'Second time', PNG, 'staff')).toMatchObject({ ok: false, status: 409 })
    const c = await brandCase(ada)
    const { data: stored } = await db.storage.from('case-evidence').download(c.court_approval_evidence_path)
    expect(stored).not.toBeNull()
  })

  it('…and the real status route enforces it', async () => {
    const lawyerEmail = `${code.toLowerCase()}-lawyer@test.local`
    const password = `Pw-${Date.now()}-x`
    const { data: lawyer, error } = await db.auth.admin.createUser({ email: lawyerEmail, password, email_confirm: true })
    if (error) throw error
    try {
      process.env.ADMIN_EMAILS = lawyerEmail
      const { createClient } = await import('@supabase/supabase-js')
      const anon = createClient(env!.NEXT_PUBLIC_SUPABASE_URL, env!.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
      const { data: session } = await anon.auth.signInWithPassword({ email: lawyerEmail, password })
      const { POST } = await import('../../app/api/update-case-status/route')
      const file = (caseId: string) =>
        POST(
          new Request('http://localhost/api/update-case-status', {
            method: 'POST',
            headers: { authorization: `Bearer ${session.session!.access_token}`, 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
            body: JSON.stringify({ caseId, action: 'markFiled' }),
          }),
        )
      expect((await file(matterOf[bola])).status).toBe(409) // no approval
      expect((await db.from('cases').select('status').eq('id', matterOf[bola]).single()).data!.status).toBe('letter_served')
      expect((await file(matterOf[ada])).status).toBe(200) // approval recorded above
    } finally {
      await db.auth.admin.deleteUser(lawyer.user.id)
    }
  }, 30_000)

  // ── Outcomes ──

  it('Paid, Disputed, Closed: only from sensible stages, logged and written to the sheet', async () => {
    const id = (await brandCase(bola)).id
    expect(await exc.setOutcome(id, 'disputed', 'Borrower says it was repaid', 'staff', drive.workspace())).toEqual({ ok: true })
    expect(drive.cell(sheetId, rowOf(bola), 'Status')).toBe('Disputed')
    expect(await exc.setOutcome(id, 'disputed', '', 'staff', null)).toMatchObject({ ok: false, status: 409 })
    expect(await exc.setOutcome(id, 'paid', 'Receipt seen', 'staff', drive.workspace())).toEqual({ ok: true })
    expect(drive.cell(sheetId, rowOf(bola), 'Status')).toBe('Paid')
    expect(serving.dueReminder(await brandCase(bola), new Date('2026-12-01T09:00:00Z'))).toBeNull() // no more reminders
  })

  // ── Billing ──

  it('a month with nothing approved in it has nothing to bill', async () => {
    expect(await billing.createBrandInvoice(brandId, '2026-09', 'staff')).toMatchObject({ ok: false, status: 409 })
  })

  it('the monthly invoice: one line per approved letter, at the fee fixed on approval; missing documents never billed', async () => {
    const result = await billing.createBrandInvoice(brandId, '2026-10', 'finance@pandaslp.test')
    if (result.ok === false) throw new Error(result.error)
    expect(result.letters).toBe(2)
    expect(result.invoice.items.map((i) => i.description)).toEqual([
      `${ada} · Ada Obi · letter of demand, approved 8 Oct 2026`,
      `${bola} · Bola Ade · letter of demand, approved 8 Oct 2026`,
    ])
    expect(result.invoice.items.every((i) => i.amount_kobo === 500000)).toBe(true) // not today's 900000
    expect(result.invoice).toMatchObject({ client_name: 'Test Lender', client_email: 'ops@lender.test', status: 'draft', matter: 'Loan recovery letters, October 2026' })
    expect((await brandCase(chidi)).billed_invoice_id).toBeNull()
  })

  it('creating it again bills nothing twice', async () => {
    expect(await billing.createBrandInvoice(brandId, '2026-10', 'staff')).toMatchObject({ ok: false, status: 409 })
    const { count } = await db.from('invoices').select('id', { count: 'exact', head: true }).eq('brand_id', brandId)
    expect(count).toBe(1)
  })

  it('two people clicking at once: each letter lands on exactly one invoice', async () => {
    const { data: inv } = await db.from('invoices').select('id').eq('brand_id', brandId).single()
    await db.from('invoices').update({ status: 'void' }).eq('id', inv!.id)
    expect(await billing.releaseVoidedInvoice(inv!.id, 'staff')).toBe(2)

    const [a, b] = await Promise.all([billing.createBrandInvoice(brandId, '2026-10', 'one'), billing.createBrandInvoice(brandId, '2026-10', 'two')])
    const lines = [a, b].reduce((n, r) => n + (r.ok ? r.invoice.items.length : 0), 0)
    expect(lines).toBe(2)
    const { data: billed } = await db.from('brand_cases').select('billed_invoice_id').eq('brand_id', brandId).not('billed_invoice_id', 'is', null)
    expect(billed).toHaveLength(2)
    const { data: live } = await db.from('invoices').select('id, items').eq('brand_id', brandId).neq('status', 'void')
    expect(live!.reduce((n, i) => n + (i.items as unknown[]).length, 0)).toBe(2)
  })
})
