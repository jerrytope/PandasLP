// Phase 5C against the LOCAL Supabase database (npx supabase start): the API's test mode. A test
// borrower walks the whole journey with no AI, no matter, no email and no bill, sending each
// update to the test address; the brand passes the test-mode checks; a brand with only test
// borrowers can still be deleted. Skips itself when the local database isn't running or
// .env.local isn't pointed at it — it never touches the live database.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { FakeGoogleDrive } from '../google/fakeWorkspace'
import type * as ApiModule from '../brandApi'
import type * as WebhooksModule from '../brandWebhooks'
import type * as TestModeModule from '../brandTestMode'
import type * as InputModule from '../brandApiInput'

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

const PDF = (text: string) => Buffer.from(`%PDF-1.4 ${text}`).toString('base64')
const TEST_URL = 'https://sandbox.lender.example/pandas'

describe.skipIf(!reachable)('brand API test mode (phase 5C) against the local database', () => {
  let db: typeof import('../supabaseAdmin').supabaseAdmin
  let api: typeof ApiModule
  let hooks: typeof WebhooksModule
  let testMode: typeof TestModeModule
  let input: typeof InputModule
  let POST: (req: Request) => Promise<Response>
  let LETTER: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  let ADVANCE: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  let brandId: string
  let ownerId: string
  let liveKey: string
  let testKey: string
  let testCtx: ApiModule.ApiContext
  const code = `ZT${Date.now().toString(36).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)}`
  let ip = 0
  let deleted = false

  const calls: { url: string; body: Record<string, any> }[] = []
  const post: WebhooksModule.WebhookPoster = async (url, body) => {
    calls.push({ url, body: JSON.parse(body) })
    return { status: 200 }
  }

  const borrower = (loanId: string, extra: Record<string, unknown> = {}) => ({
    loan_id: loanId,
    borrower_full_name: `Borrower ${loanId}`,
    phone_number: '08031234501',
    email: `${loanId.toLowerCase()}@example.com`,
    address_for_service: '5 Oke-Ado Road, Ibadan, Oyo State',
    loan_amount: 500000,
    amount_outstanding: 380000,
    loan_date: '2026-03-15',
    documents: [{ filename: 'agreement.pdf', content_base64: PDF(loanId) }],
    ...extra,
  })
  const submit = async (key: string, body: unknown) => {
    const res = await POST(
      new Request('http://localhost/api/v1/borrowers', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.3.3.${++ip}`, authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      }),
    )
    return (await res.json()).results[0]
  }
  // The real URL matters: the access log records its path, and the test-mode checks read it.
  const call = (handler: typeof LETTER, key: string, id: string, method = 'GET') =>
    handler(new Request(`http://localhost/api/v1/borrowers/${id}/${handler === LETTER ? 'letter' : 'advance'}`, { method, headers: { authorization: `Bearer ${key}`, 'x-forwarded-for': `10.3.4.${++ip}` } }), { params: Promise.resolve({ id }) })
  const testCase = async (loanId: string) => (await db.from('brand_cases').select('*').eq('brand_id', brandId).eq('external_ref', loanId).eq('is_test', true).single()).data!
  const advance = (id: string) => api.advanceBorrower(testCtx, id, { post })

  beforeAll(async () => {
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: env!.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env!.SUPABASE_SERVICE_ROLE_KEY })
    db = (await import('../supabaseAdmin')).supabaseAdmin
    api = await import('../brandApi')
    hooks = await import('../brandWebhooks')
    testMode = await import('../brandTestMode')
    input = await import('../brandApiInput')
    POST = (await import('../../app/api/v1/borrowers/route')).POST
    LETTER = (await import('../../app/api/v1/borrowers/[id]/letter/route')).GET
    ADVANCE = (await import('../../app/api/v1/borrowers/[id]/advance/route')).POST

    const { data: user, error: userErr } = await db.auth.admin.createUser({ email: `${code.toLowerCase()}@test.local`, email_confirm: true })
    if (userErr) throw userErr
    ownerId = user.user.id
    const { data: brand, error } = await db
      .from('brands')
      .insert({
        name: 'Sandbox Lender',
        code,
        address: '18 Idowu Taylor Street, Victoria Island, Lagos',
        contact_emails: ['ops@sandboxlender.test'],
        per_letter_fee_kobo: 500000,
        created_by: 'test',
        owner_user_id: ownerId,
        intake_channel: 'api',
      })
      .select('id')
      .single()
    if (error) throw error
    brandId = brand.id
    for (const mode of ['live', 'test'] as const) {
      const k = input.generateApiKey(mode)
      await db.from('brand_api_keys').insert({ brand_id: brandId, mode, key_prefix: k.prefix, key_hash: k.hash, created_by: 'test' })
      if (mode === 'live') liveKey = k.key
      else testKey = k.key
    }
    await hooks.saveWebhookSettings(brandId, { liveUrl: '', testUrl: TEST_URL }, 'staff')
    testCtx = (await api.authenticate(new Request('http://localhost', { headers: { authorization: `Bearer ${testKey}` } }))) as ApiModule.ApiContext
  }, 60_000)

  afterAll(async () => {
    if (!db || !brandId || deleted) return
    const { data: docs } = await db.from('brand_case_documents').select('storage_path, brand_cases!inner(brand_id)').eq('brand_cases.brand_id', brandId)
    if (docs?.length) await db.storage.from('case-evidence').remove(docs.map((d) => d.storage_path))
    await db.from('brand_cases').delete().eq('brand_id', brandId)
    await db.from('brands').delete().eq('id', brandId)
    if (ownerId) await db.auth.admin.deleteUser(ownerId)
  })

  it('before any test: the checks are all open', async () => {
    expect(await testMode.testModeProgress(brandId)).toEqual({ submitted: false, journeyFinished: false, letterPulled: false, webhookDelivered: false, passed: false })
  })

  it('the scheduled run moves a waiting test borrower on: "drafted" with no AI and no matter', async () => {
    expect((await submit(testKey, borrower('T-1'))).status).toBe('new')
    expect((await testMode.advanceTestBorrowers(new Date(), brandId)).advanced).toBe(0) // hasn't waited 5 minutes yet

    await testMode.advanceTestBorrowers(new Date(Date.now() + testMode.TEST_STEP_MS + 60_000), brandId)
    const c = await testCase('T-1')
    expect(c).toMatchObject({ status: 'letter_drafted', case_id: null, attempts: 0, billable_at: null })
    expect((await db.from('cases').select('id').eq('brand_id', brandId)).data).toEqual([])
  })

  it('the letter is a SAMPLE, available from the same step as a real one', async () => {
    const early = await call(LETTER, testKey, 'T-1')
    expect(early.status).toBe(409)

    expect(await advance('T-1')).toMatchObject({ ok: true, from: 'letter_drafted', status: 'lawyer_approved' })
    const res = await call(LETTER, testKey, 'T-1')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('SAMPLE')
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF')
    expect((await testCase('T-1')).billable_at).toBeNull() // never billable
  })

  it('advance is for test keys only, and goes through the real route', async () => {
    const live = await call(ADVANCE, liveKey, 'T-1', 'POST')
    expect(live.status).toBe(403)
    expect((await live.json()).error.code).toBe('test_key_only')
  })

  it('served, Day 7, Day 14, closed — and nobody is ever emailed', async () => {
    expect(await advance('T-1')).toMatchObject({ status: 'served' })

    // Even with the served date long gone, the real reminder job leaves test borrowers alone.
    await db.from('brand_cases').update({ served_at: new Date(Date.now() - 20 * 86_400_000).toISOString() }).eq('id', (await testCase('T-1')).id)
    const mails: unknown[] = []
    const sync = await import('../brandSync')
    await sync.syncBrand(brandId, {
      workspace: new FakeGoogleDrive().workspace(),
      draft: async () => {
        throw new Error('test borrowers must never be drafted')
      },
      now: () => new Date(new Date().setUTCHours(10)), // inside sending hours
      maxDraftsPerBrand: 5,
      maxApiDraftsPerBrand: 20,
      deadline: Date.now() + 60_000,
      mail: async (m) => {
        mails.push(m)
      },
    })
    expect(mails).toEqual([])
    expect((await testCase('T-1')).status).toBe('served')

    expect(await advance('T-1')).toMatchObject({ status: 'day7_sent' })
    expect(await advance('T-1')).toMatchObject({ status: 'day14_sent' })
    expect((await testCase('T-1')).awaiting_brand_decision_at).not.toBeNull()
    expect(await advance('T-1')).toMatchObject({ status: 'closed' })
    expect(await advance('T-1')).toMatchObject({ ok: false, status: 409, code: 'cannot_advance' })
  })

  it('every step reached the test address, in order', async () => {
    await hooks.deliverDueWebhooks({ post, brandId, now: () => new Date(Date.now() + 10 * 60_000) })
    const mine = calls.filter((x) => x.body.data.loan_id === 'T-1')
    expect(new Set(mine.map((x) => x.url))).toEqual(new Set([TEST_URL]))
    expect(mine.every((x) => x.body.test === true)).toBe(true)
    expect(mine.map((x) => x.body.event)).toEqual([
      'borrower.letter_drafted',
      'borrower.lawyer_approved',
      'borrower.served',
      'borrower.day7_sent',
      'borrower.day14_sent',
      'borrower.awaiting_decision',
      'borrower.outcome',
    ])
  })

  it('a test borrower with a gap stops at Missing Documents, with its update', async () => {
    await submit(testKey, borrower('T-2', { phone_number: '' }))
    const c = await testCase('T-2')
    expect(c.status).toBe('missing_documents')
    expect(await advance('T-2')).toMatchObject({ ok: false, code: 'cannot_advance' })
  })

  it('after the journey the brand has passed the checks (a live key can be issued)', async () => {
    // The letter download is logged in the background; give it a moment to land.
    for (let i = 0; i < 20 && !(await testMode.testModeProgress(brandId)).letterPulled; i++) await new Promise((r) => setTimeout(r, 100))
    expect(await testMode.testModeProgress(brandId)).toEqual({ submitted: true, journeyFinished: true, letterPulled: true, webhookDelivered: true, passed: true })
  })

  it('a brand with only test borrowers can be deleted; they go with it', async () => {
    const { deleteBrand } = await import('../brands')
    expect(await deleteBrand(brandId)).toEqual({ ok: true })
    deleted = true
    expect((await db.from('brand_cases').select('id').eq('brand_id', brandId)).data).toEqual([])
    await db.auth.admin.deleteUser(ownerId)
  })
})
