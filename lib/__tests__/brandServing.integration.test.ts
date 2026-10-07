// Phase 3 against the LOCAL Supabase database (npx supabase start): lawyer approval, serving by
// email, and the Day 7 / Day 14 borrower reminders, with the pretend Google Drive, a stand-in
// for the AI and a stand-in mailer. Skips itself when the local database isn't running or
// .env.local isn't pointed at it — it never touches the live database.
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

const DAY = 24 * 60 * 60 * 1000

describe.skipIf(!reachable)('brand approval, serving and reminders against the local database', () => {
  let sync: typeof SyncModule
  let serving: typeof ServingModule
  let db: typeof import('../supabaseAdmin').supabaseAdmin
  let drive: FakeGoogleDrive
  let brandId: string
  let ownerId: string
  let sheetId: string
  let lettersFolderId: string
  const code = `ZS${Date.now().toString(36).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)}`
  const ada = `${code}-0001`
  const bola = `${code}-0002`
  const chidi = `${code}-0003`
  const lawyerEmail = `${code.toLowerCase()}-lawyer@test.local`
  let lawyerId: string
  const matterOf: Record<string, string> = {}

  // 10:00 in Lagos on serving day; every step below moves this clock forward.
  const servedAt = new Date('2026-10-08T09:00:00.000Z')
  let clock = servedAt
  const mails: SendMailOptions[] = []
  let mailFails = false
  const mail = async (opts: SendMailOptions) => {
    if (mailFails) throw new Error('SMTP is down')
    mails.push(opts)
  }
  const pdf = async () => Buffer.from('%PDF-1.4 stamped test letter')

  const draft: BrandDrafter = async ({ borrower }) => ({
    ok: true,
    doc: { title: 'Letter of Demand', body: `Our Ref: {{REF_NUMBER}}\nDear ${borrower.fullName}, pay ₦${borrower.amountOutstanding}.` },
  })
  const syncDeps = () => ({ workspace: drive.workspace(), draft, now: () => clock, maxDraftsPerBrand: 10, deadline: Date.now() + 60_000, mail })
  const serveDeps = () => ({ workspace: drive.workspace(), now: () => clock, mail, loadServedPdf: pdf })

  const rowOf = (ref: string) => drive.files.get(sheetId)!.rows!.findIndex((cells) => cells[0] === ref) + 1
  const cell = (ref: string, header: (typeof BRAND_SHEET_HEADERS)[number]) => drive.cell(sheetId, rowOf(ref), header)
  const brandCase = async (ref: string) => (await db.from('brand_cases').select('*').eq('case_ref', ref).single()).data!
  const eventsOf = async (ref: string, type: string) =>
    (await db.from('brand_case_events').select('id').eq('case_ref', ref).eq('event_type', type)).data!.length

  beforeAll(async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: env!.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env!.SUPABASE_SERVICE_ROLE_KEY,
    })
    db = (await import('../supabaseAdmin')).supabaseAdmin
    sync = await import('../brandSync')
    serving = await import('../brandServing')
    drive = new FakeGoogleDrive()

    const { data: user, error: userErr } = await db.auth.admin.createUser({ email: `${code.toLowerCase()}@test.local`, email_confirm: true })
    if (userErr) throw userErr
    ownerId = user.user.id

    const progress = await drive.workspace().setupBrand({ name: 'Test Lender', code, contactEmails: ['ops@lender.test'] }, emptySetupProgress(), async () => {})
    sheetId = progress.sheetId!
    lettersFolderId = progress.lettersFolderId!
    const docUrl = `https://drive.google.com/file/d/${drive.addDocument(progress.documentsFolderId!)}/view`
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

    for (const [r, name] of [[2, 'Ada Obi'], [3, 'Bola Ade'], [4, 'Chidi Eze']] as const) {
      drive.setRow(sheetId, r, {
        'Borrower Full Name': name,
        'Phone Number': '08031234567',
        Email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
        'Address for Service': '12 Allen Avenue, Ikeja, Lagos',
        'Loan Amount': 500000,
        'Amount Outstanding': 350000,
        'Loan Date': '15/01/2026',
        'Documents Link': docUrl,
      })
    }
    const report = await sync.syncBrand(brandId, syncDeps())
    expect(report).toMatchObject({ assigned: 3, drafted: 3 })
    for (const ref of [ada, bola, chidi]) {
      matterOf[ref] = (await db.from('cases').select('id').eq('source_detail', ref).single()).data!.id
    }
  }, 60_000)

  afterAll(async () => {
    if (!db || !brandId) return
    await db.from('cases').delete().eq('brand_id', brandId)
    await db.from('brand_change_flags').delete().eq('brand_id', brandId)
    await db.from('brand_cases').delete().eq('brand_id', brandId)
    await db.from('brands').delete().eq('id', brandId)
    if (ownerId) await db.auth.admin.deleteUser(ownerId)
    if (lawyerId) await db.auth.admin.deleteUser(lawyerId)
  })

  it('the real status route: approval needs the full checklist, works before payment, and reaches the borrower record', async () => {
    const password = `Pw-${Date.now()}-x`
    const { data: lawyer, error } = await db.auth.admin.createUser({ email: lawyerEmail, password, email_confirm: true })
    if (error) throw error
    lawyerId = lawyer.user.id
    process.env.ADMIN_EMAILS = lawyerEmail
    const { createClient } = await import('@supabase/supabase-js')
    const anon = createClient(env!.NEXT_PUBLIC_SUPABASE_URL, env!.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data: session, error: signInErr } = await anon.auth.signInWithPassword({ email: lawyerEmail, password })
    if (signInErr) throw signInErr
    const { POST } = await import('../../app/api/update-case-status/route')
    const { getReviewChecklist } = await import('../reviewChecklists')
    const call = (action: string, reviewChecklist?: Record<string, boolean>) =>
      POST(
        new Request('http://localhost/api/update-case-status', {
          method: 'POST',
          headers: { authorization: `Bearer ${session.session!.access_token}`, 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Date.now() % 250}` },
          body: JSON.stringify({ caseId: matterOf[chidi], action, reviewChecklist }),
        }),
      )

    expect((await call('markServed')).status).toBe(409) // not reviewed yet
    expect((await call('markReviewed', {})).status).toBe(400) // checklist not completed
    expect((await brandCase(chidi)).status).toBe('letter_drafted')

    const { data: matter } = await db.from('cases').select('document_title').eq('id', matterOf[chidi]).single()
    const all = Object.fromEntries(getReviewChecklist(matter!.document_title).map((i) => [i.id, true]))
    expect((await call('markReviewed', all)).status).toBe(200)
    const reviewed = (await db.from('cases').select('status, reviewed_by').eq('id', matterOf[chidi]).single()).data!
    expect(reviewed).toEqual({ status: 'document_ready', reviewed_by: lawyerEmail }) // reviewed, still unpaid, still not served
    expect(await brandCase(chidi)).toMatchObject({ status: 'lawyer_approved', billable_at: expect.any(String) })

    expect((await call('markServed')).status).toBe(200)
    expect((await db.from('cases').select('status').eq('id', matterOf[chidi]).single()).data!.status).toBe('letter_served')
    expect(await brandCase(chidi)).toMatchObject({ status: 'served', served_at: expect.any(String) })
    // Out of the reminder tests below: they're about Ada and Bola.
    await db.from('brand_cases').update({ status: 'closed' }).eq('case_ref', chidi)
  }, 30_000) // signs in and loads the whole route

  it('approval: billable, FINAL letter replaces the DRAFT in place, sheet says Lawyer Approved', async () => {
    const before = await brandCase(ada)
    await serving.approveBrandLetter(matterOf[ada], 'lawyer@pandaslp.test', { workspace: drive.workspace(), now: () => clock })
    await serving.approveBrandLetter(matterOf[ada], 'lawyer@pandaslp.test', { workspace: drive.workspace(), now: () => clock })

    const after = await brandCase(ada)
    expect(after).toMatchObject({ status: 'lawyer_approved', letter_file_id: before.letter_file_id })
    expect(after.billable_at).not.toBeNull()
    expect(after.final_letter_at).not.toBeNull()
    expect(drive.files.get(after.letter_file_id)!.name).toMatch(/FINAL, approved by a lawyer/)
    expect([...drive.files.values()].filter((f) => f.parentId === lettersFolderId)).toHaveLength(3) // one per borrower, no copies
    expect(cell(ada, 'Status')).toBe('Lawyer Approved')
    expect(await eventsOf(ada, 'lawyer_approved')).toBe(1)
  })

  it('serving refuses until a lawyer has signed off the review and the stamped letter is attached', async () => {
    const unreviewed = await serving.serveBrandCaseByEmail(matterOf[ada], 'staff', serveDeps())
    expect(unreviewed).toMatchObject({ ok: false, status: 409 })

    await db.from('cases').update({ reviewed_at: clock.toISOString(), reviewed_by: 'lawyer@pandaslp.test' }).eq('id', matterOf[ada])
    const noStamp = await serving.serveBrandCaseByEmail(matterOf[ada], 'staff', { ...serveDeps(), loadServedPdf: async () => null })
    expect(noStamp).toMatchObject({ ok: false, status: 409 })
    expect(mails).toHaveLength(0)
  })

  it('a failed email serves nothing, and leaves it free to try again', async () => {
    mailFails = true
    const result = await serving.serveBrandCaseByEmail(matterOf[ada], 'staff', serveDeps())
    mailFails = false
    expect(result).toMatchObject({ ok: false, status: 502 })
    expect((await brandCase(ada)).status).toBe('lawyer_approved')
    expect(await eventsOf(ada, 'served')).toBe(0)
  })

  it('serves by email: to the borrower, brand copied, letter attached; matter and sheet updated', async () => {
    const result = await serving.serveBrandCaseByEmail(matterOf[ada], 'staff@pandaslp.test', serveDeps())
    expect(result).toEqual({ ok: true, servedAt: servedAt.toISOString() })
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({ to: 'ada.obi@example.com', cc: ['ops@lender.test'] })
    expect(mails[0].subject).toContain(ada)
    expect(mails[0].attachments?.[0].contentType).toBe('application/pdf')

    expect(await brandCase(ada)).toMatchObject({ status: 'served' })
    const { data: matter } = await db.from('cases').select('status, deadline_at').eq('id', matterOf[ada]).single()
    expect(matter!.status).toBe('letter_served')
    expect(new Date(matter!.deadline_at).getTime()).toBe(servedAt.getTime() + 14 * DAY)
    expect(cell(ada, 'Status')).toBe('Served')
    expect(cell(ada, 'Date Served')).toBe('8 Oct 2026')
  })

  it('cannot be served twice', async () => {
    const again = await serving.serveBrandCaseByEmail(matterOf[ada], 'staff', serveDeps())
    expect(again).toMatchObject({ ok: false, status: 409 })
    expect(mails).toHaveLength(1)
  })

  it('"Mark Served" after a WhatsApp serve records the borrower as served too', async () => {
    await serving.approveBrandLetter(matterOf[bola], 'lawyer@pandaslp.test', { workspace: drive.workspace(), now: () => clock })
    await db.from('cases').update({ status: 'letter_served' }).eq('id', matterOf[bola]) // what update-case-status does first
    await serving.recordBrandServed(matterOf[bola], 'staff@pandaslp.test', { workspace: drive.workspace(), now: () => clock })
    expect(await brandCase(bola)).toMatchObject({ status: 'served', served_at: expect.any(String) })
    expect(cell(bola, 'Status')).toBe('Served')
    expect(mails).toHaveLength(1) // marking served sends nothing by itself
  })

  it('no reminder before Day 7', async () => {
    clock = new Date(servedAt.getTime() + 6 * DAY)
    const report = await sync.syncBrand(brandId, syncDeps())
    expect(report.reminded).toBe(0)
    expect(mails).toHaveLength(1)
  })

  it('never sends a reminder whose date the sheet already shows, and says why', async () => {
    drive.files.get(sheetId)!.rows![rowOf(bola) - 1][BRAND_SHEET_HEADERS.indexOf('Day 7 Date')] = '15 Oct 2026'
    clock = new Date(servedAt.getTime() + 7 * DAY)
    const report = await sync.syncBrand(brandId, syncDeps())
    expect(report.reminded).toBe(1) // Ada only
    expect(mails.map((m) => m.to)).toEqual(['ada.obi@example.com', 'ada.obi@example.com'])
    expect((await brandCase(bola)).last_error).toMatch(/Day 7 reminder may already have been sent/)
  })

  it('…and keeps blocking it after the sync has put the sheet back in line with the database', async () => {
    const report = await sync.syncBrand(brandId, syncDeps())
    expect(cell(bola, 'Day 7 Date')).toBe('')
    expect(report.reminded).toBe(0)
    expect(mails.filter((m) => m.to === 'bola.ade@example.com')).toHaveLength(0)
  })

  it('Day 7: once, to the borrower with the brand copied; the sheet shows it', async () => {
    expect(mails[1]).toMatchObject({ to: 'ada.obi@example.com', cc: ['ops@lender.test'] })
    expect(mails[1].subject).toBe(`Reminder: 7 days left to respond | ${ada}`)
    expect(await brandCase(ada)).toMatchObject({ status: 'day7_sent' })
    expect(cell(ada, 'Status')).toBe('Day 7 Sent')
    expect(cell(ada, 'Day 7 Date')).toBe('15 Oct 2026')

    const again = await sync.syncBrand(brandId, syncDeps())
    expect(again.reminded).toBe(0)
    expect(await eventsOf(ada, 'day7_reminder')).toBe(1)
  })

  it('nothing is sent at night (Lagos)', async () => {
    clock = new Date(servedAt.getTime() + 14 * DAY + 13 * 60 * 60 * 1000) // 23:00 Lagos
    expect((await sync.syncBrand(brandId, syncDeps())).reminded).toBe(0)
  })

  it('a failed Day 14 email is retried on the next run, and sent only once', async () => {
    clock = new Date(servedAt.getTime() + 15 * DAY) // 10:00 Lagos
    mailFails = true
    const failed = await sync.syncBrand(brandId, syncDeps())
    mailFails = false
    expect(failed).toMatchObject({ reminded: 0, failed: 1 })
    expect(await brandCase(ada)).toMatchObject({ status: 'day7_sent', day14_sent_at: null })
    expect(await eventsOf(ada, 'day14_reminder')).toBe(0)

    const retried = await sync.syncBrand(brandId, syncDeps())
    expect(retried.reminded).toBe(1)
    const again = await sync.syncBrand(brandId, syncDeps())
    expect(again.reminded).toBe(0)
    expect(await eventsOf(ada, 'day14_reminder')).toBe(1)
  })

  it('after Day 14 the borrower waits for the brand’s decision', async () => {
    const c = await brandCase(ada)
    expect(c.status).toBe('day14_sent')
    expect(c.awaiting_brand_decision_at).not.toBeNull()
    expect(cell(ada, 'Status')).toBe('Day 14 Sent')
    expect(cell(ada, 'Day 14 Date')).toBe('23 Oct 2026')
    expect(mails.at(-1)!.subject).toBe(`Response period ended | ${ada}`)
  })

  it('the old client follow-up emails never go out for a brand borrower', async () => {
    process.env.GMAIL_APP_PASSWORD ||= 'test-only'
    const { sendCaseEmail } = await import('../sendCaseEmail')
    const result = await sendCaseEmail(matterOf[ada], { type: 'follow_up', day: 7 })
    expect(result).toMatchObject({ ok: false, status: 409 })
  })
})
