// Phase 5A against the LOCAL Supabase database (npx supabase start): a brand sending borrowers
// by API through the real routes, then the sync drafting them with a stand-in for the AI. Skips
// itself when the local database isn't running or .env.local isn't pointed at it — it never
// touches the live database.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { FakeGoogleDrive } from '../google/fakeWorkspace'
import type { BrandDrafter } from '../brandLetter'
import type * as ApiModule from '../brandApi'
import type * as SyncModule from '../brandSync'
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

describe.skipIf(!reachable)('brand API (phase 5A) against the local database', () => {
  let db: typeof import('../supabaseAdmin').supabaseAdmin
  let api: typeof ApiModule
  let sync: typeof SyncModule
  let input: typeof InputModule
  let POST: (req: Request) => Promise<Response>
  let GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  let brandId: string
  let ownerId: string
  let liveKey: string
  let testKey: string
  const code = `ZA${Date.now().toString(36).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)}`
  let ip = 0
  let draftCalls: string[] = []

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
  const submit = async (key: string | null, body: unknown, raw?: string) => {
    const res = await POST(
      new Request('http://localhost/api/v1/borrowers', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.1.1.${++ip}`, ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: raw ?? JSON.stringify(body),
      }),
    )
    return { status: res.status, json: await res.json() }
  }
  const lookup = async (key: string, id: string) => {
    const res = await GET(new Request(`http://localhost/api/v1/borrowers/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${key}` } }), {
      params: Promise.resolve({ id: encodeURIComponent(id) }),
    })
    return { status: res.status, json: await res.json() }
  }
  const casesFor = async (loanId: string) => (await db.from('brand_cases').select('*').eq('brand_id', brandId).eq('external_ref', loanId)).data!

  const draft: BrandDrafter = async ({ borrower: b, caseRef }) => {
    draftCalls.push(caseRef)
    return { ok: true, doc: { title: 'Letter of Demand', body: `Our Ref: {{REF_NUMBER}}\nDear ${b.fullName}, pay ₦${b.amountOutstanding}.` } }
  }

  beforeAll(async () => {
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: env!.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env!.SUPABASE_SERVICE_ROLE_KEY })
    db = (await import('../supabaseAdmin')).supabaseAdmin
    api = await import('../brandApi')
    sync = await import('../brandSync')
    input = await import('../brandApiInput')
    POST = (await import('../../app/api/v1/borrowers/route')).POST
    GET = (await import('../../app/api/v1/borrowers/[id]/route')).GET

    const { data: user, error: userErr } = await db.auth.admin.createUser({ email: `${code.toLowerCase()}@test.local`, email_confirm: true })
    if (userErr) throw userErr
    ownerId = user.user.id

    // An API-only brand: no Google sheet or folders at all.
    const { data: brand, error } = await db
      .from('brands')
      .insert({
        name: 'API Lender',
        code,
        address: '18 Idowu Taylor Street, Victoria Island, Lagos',
        contact_emails: ['ops@apilender.test'],
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
  }, 60_000)

  afterAll(async () => {
    if (!db || !brandId) return
    const { data: docs } = await db.from('brand_case_documents').select('storage_path, brand_cases!inner(brand_id)').eq('brand_cases.brand_id', brandId)
    if (docs?.length) await db.storage.from('case-evidence').remove(docs.map((d) => d.storage_path))
    await db.from('cases').delete().eq('brand_id', brandId)
    await db.from('brand_cases').delete().eq('brand_id', brandId)
    await db.from('brands').delete().eq('id', brandId)
    if (ownerId) await db.auth.admin.deleteUser(ownerId)
  })

  it('refuses a call with no key, or a made-up one', async () => {
    expect((await submit(null, borrower('NOKEY'))).status).toBe(401)
    expect((await submit(input.generateApiKey('live').key, borrower('FAKE'))).status).toBe(401)
  })

  it('accepts a complete borrower: our Case ID straight away, documents stored privately', async () => {
    const { status, json } = await submit(liveKey, borrower('LN-001'))
    expect(status).toBe(200)
    expect(json).toMatchObject({ test: false, results: [{ loan_id: 'LN-001', case_id: `${code}-0001`, status: 'new' }] })

    const [c] = await casesFor('LN-001')
    expect(c).toMatchObject({ source: 'api', is_test: false, status: 'new' })
    expect(c.borrower['Borrower Full Name']).toBe('Borrower LN-001')
    const { data: docs } = await db.from('brand_case_documents').select('*').eq('brand_case_id', c.id)
    expect(docs).toHaveLength(1)
    expect(docs![0]).toMatchObject({ content_type: 'application/pdf', origin: 'inline' })
    const { data: file } = await db.storage.from('case-evidence').download(docs![0].storage_path)
    expect(file).not.toBeNull()
  })

  it('NEVER TWICE: sending the same loan again returns the same case, even at the same moment', async () => {
    const again = await submit(liveKey, borrower('LN-001'))
    expect(again.json.results[0]).toMatchObject({ case_id: `${code}-0001`, duplicate: true })

    const [a, b] = await Promise.all([submit(liveKey, borrower('LN-002')), submit(liveKey, borrower('LN-002'))])
    const ids = [a.json.results[0].case_id, b.json.results[0].case_id]
    expect(ids[0]).toBe(ids[1])
    expect(await casesFor('LN-002')).toHaveLength(1)
  })

  it('a borrower with gaps is kept as Missing Documents, with exactly what’s missing; resending fixes it', async () => {
    const { json } = await submit(liveKey, borrower('LN-003', { email: '', documents: [{ filename: 'notes.txt', content_base64: Buffer.from('just text').toString('base64') }] }))
    expect(json.results[0]).toMatchObject({
      status: 'missing_documents',
      missing: ['Email (needed to send the reminders)', 'Document 1 (notes.txt): must be a PDF, JPG or PNG'],
    })

    const fixed = await submit(liveKey, borrower('LN-003'))
    expect(fixed.json.results[0]).toMatchObject({ case_id: json.results[0].case_id, status: 'new', updated: true })
    expect(await casesFor('LN-003')).toHaveLength(1)
  })

  it('a link to a private address is refused, and documents must be under 1 MB', async () => {
    const priv = await submit(liveKey, borrower('LN-004', { documents: [{ url: 'https://127.0.0.1/loan.pdf' }] }))
    expect(priv.json.results[0].missing).toEqual(['Document 1 (document-1): the link points to a private address'])

    const big = Buffer.alloc(1100 * 1024, 65)
    big.write('%PDF-1.4', 0)
    const huge = await submit(liveKey, borrower('LN-005', { documents: [{ filename: 'big.pdf', content_base64: big.toString('base64') }] }))
    expect(huge.json.results[0].missing).toContain('Documents: more than 1 MB in total for this borrower')
  })

  it('a link that works is fetched once and kept (stand-in fetcher)', async () => {
    const ctx = (await api.authenticate(new Request('http://localhost', { headers: { authorization: `Bearer ${liveKey}` } }))) as ApiModule.ApiContext
    const fetched: string[] = []
    const result = await api.submitBorrower(ctx, borrower('LN-006', { documents: [{ filename: 'stmt.pdf', url: 'https://files.lender.ng/stmt.pdf' }] }), {
      fetcher: async (url) => {
        fetched.push(url)
        return Buffer.from('%PDF-1.4 statement')
      },
    })
    expect(result).toMatchObject({ status: 'new' })
    expect(fetched).toEqual(['https://files.lender.ng/stmt.pdf'])
    const [c] = await casesFor('LN-006')
    const { data: docs } = await db.from('brand_case_documents').select('origin, source_url').eq('brand_case_id', c.id)
    expect(docs).toEqual([{ origin: 'url', source_url: 'https://files.lender.ng/stmt.pdf' }])
  })

  it('a batch: each borrower gets its own answer, a bad one doesn’t stop the others', async () => {
    const { status, json } = await submit(liveKey, { borrowers: [borrower('LN-007'), { loan_id: 'LN-008', phone: 'x' }, borrower('LN-009')] })
    expect(status).toBe(200)
    expect(json.results.map((r: { status?: string; error?: string }) => r.status ?? 'error')).toEqual(['new', 'error', 'new'])
    expect(json.results[1].error).toContain('Unknown field: phone')
    expect(await casesFor('LN-008')).toHaveLength(0)
  })

  it('rejects broken JSON and bodies over 5 MB', async () => {
    expect((await submit(liveKey, null, '{not json')).status).toBe(400)
    expect((await submit(liveKey, null, JSON.stringify({ borrowers: [borrower('X', { notes: 'a'.repeat(5_300_000) })] }))).status).toBe(413)
  })

  it('looks a borrower up by our Case ID or their loan ID; a test key never sees live borrowers', async () => {
    const byCase = await lookup(liveKey, `${code}-0001`)
    expect(byCase.status).toBe(200)
    expect(byCase.json).toMatchObject({ case_id: `${code}-0001`, loan_id: 'LN-001', status: 'new', letter_available: false, test: false })
    expect((await lookup(liveKey, 'LN-001')).json.case_id).toBe(`${code}-0001`)
    expect((await lookup(testKey, 'LN-001')).status).toBe(404)
  })

  it('a test key works the same way but its borrowers are kept apart', async () => {
    const { json } = await submit(testKey, borrower('LN-001'))
    expect(json.test).toBe(true)
    expect(json.results[0]).toMatchObject({ loan_id: 'LN-001', status: 'new' })
    expect(json.results[0].case_id).not.toBe(`${code}-0001`) // same loan ID, separate test case
    expect((await lookup(testKey, 'LN-001')).json).toMatchObject({ test: true })
  })

  it('the sync drafts live API borrowers (no Google needed) and never drafts test ones', async () => {
    draftCalls = []
    const drive = new FakeGoogleDrive()
    const report = await sync.syncBrand(brandId, {
      workspace: drive.workspace(),
      draft,
      now: () => new Date(),
      maxDraftsPerBrand: 5,
      maxApiDraftsPerBrand: 20,
      deadline: Date.now() + 60_000,
      mail: async () => {},
    })
    const liveNew = ['LN-001', 'LN-002', 'LN-003', 'LN-006', 'LN-007', 'LN-009']
    expect(report).toMatchObject({ drafted: liveNew.length, failed: 0 })
    expect(draftCalls).toHaveLength(liveNew.length)

    // LN-001 now exists twice: the live borrower, and the test-key one with the same loan ID.
    const both = await casesFor('LN-001')
    const live = both.find((x) => !x.is_test)!
    expect(live).toMatchObject({ status: 'letter_drafted', letter_url: null })
    expect(both.find((x) => x.is_test)).toMatchObject({ status: 'new' }) // test borrower untouched
    const { data: matter } = await db.from('cases').select('source, status, document_body').eq('id', live.case_id).single()
    expect(matter).toMatchObject({ source: 'brand-api', status: 'document_ready' })
    expect(matter!.document_body).toContain(`(${live.case_ref})`)

    // Once it's being worked on, resending the loan changes nothing.
    const resend = await submit(liveKey, borrower('LN-001', { amount_outstanding: 999999 }))
    expect(resend.json.results[0]).toMatchObject({ duplicate: true, status: 'letter_drafted', note: expect.stringContaining('not applied') })
  })

  it('every call is in the access log', async () => {
    const { count } = await db.from('brand_api_requests').select('id', { count: 'exact', head: true }).eq('brand_id', brandId)
    expect(count).toBeGreaterThan(10)
  })
})
