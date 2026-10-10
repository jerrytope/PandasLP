// Phase 5B against the LOCAL Supabase database (npx supabase start): updates to an API brand's
// system (queued by the database trigger, signed, retried, given up on with one staff email),
// the letter download, notes, and edits after processing. A stand-in replaces the brand's
// server and the AI. Skips itself when the local database isn't running or .env.local isn't
// pointed at it — it never touches the live database.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { FakeGoogleDrive } from '../google/fakeWorkspace'
import type { BrandDrafter } from '../brandLetter'
import type * as WebhooksModule from '../brandWebhooks'
import type * as FormatModule from '../brandWebhookFormat'
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
const LIVE_URL = 'https://hooks.lender.example/pandas'
const TEST_URL = 'https://sandbox.lender.example/pandas'

describe.skipIf(!reachable)('brand webhooks, letter and notes (phase 5B) against the local database', () => {
  let db: typeof import('../supabaseAdmin').supabaseAdmin
  let hooks: typeof WebhooksModule
  let format: typeof FormatModule
  let input: typeof InputModule
  let POST: (req: Request) => Promise<Response>
  let LETTER: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  let NOTES: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  let brandId: string
  let ownerId: string
  let liveKey: string
  let testKey: string
  let secret: string
  const code = `ZW${Date.now().toString(36).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)}`
  let ip = 0

  // The brand's server: records every call, answers with `answer`.
  let calls: { url: string; body: string; headers: Record<string, string> }[] = []
  let answer = 200
  const post: WebhooksModule.WebhookPoster = async (url, body, headers) => {
    calls.push({ url, body, headers })
    if (answer === 0) throw new Error('connect ECONNREFUSED')
    return { status: answer }
  }
  const mails: { subject: string; text?: string }[] = []
  const mail = async (o: { subject: string; text?: string }) => {
    mails.push(o)
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
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.2.2.${++ip}`, authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      }),
    )
    return (await res.json()).results[0]
  }
  const call = (handler: typeof LETTER, key: string, id: string, init: RequestInit = {}) =>
    handler(new Request(`http://localhost/api/v1/borrowers/${id}`, { ...init, headers: { authorization: `Bearer ${key}`, ...(init.headers ?? {}) } }), {
      params: Promise.resolve({ id }),
    })
  const caseFor = async (loanId: string, isTest = false) =>
    (await db.from('brand_cases').select('*').eq('brand_id', brandId).eq('external_ref', loanId).eq('is_test', isTest).single()).data!
  const deliveriesFor = async (brandCaseId: string) =>
    (await db.from('brand_webhook_deliveries').select('*').eq('brand_case_id', brandCaseId).order('occurred_at', { ascending: true })).data!
  const deliver = (deps: Partial<WebhooksModule.DeliverDeps> = {}) => hooks.deliverDueWebhooks({ post, mail, brandId, ...deps })

  const draft: BrandDrafter = async ({ borrower: b }) => ({
    ok: true,
    doc: { title: 'Letter of Demand', body: `Our Ref: {{REF_NUMBER}}\nDear ${b.fullName}, pay ₦${b.amountOutstanding}.` },
  })
  const runSync = () =>
    import('../brandSync').then((s) =>
      s.syncBrand(brandId, {
        workspace: new FakeGoogleDrive().workspace(),
        draft,
        now: () => new Date(),
        maxDraftsPerBrand: 5,
        maxApiDraftsPerBrand: 20,
        deadline: Date.now() + 60_000,
        mail: async () => {},
      }),
    )

  beforeAll(async () => {
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: env!.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env!.SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL: 'https://pandaslp.com.ng' })
    db = (await import('../supabaseAdmin')).supabaseAdmin
    hooks = await import('../brandWebhooks')
    format = await import('../brandWebhookFormat')
    input = await import('../brandApiInput')
    POST = (await import('../../app/api/v1/borrowers/route')).POST
    LETTER = (await import('../../app/api/v1/borrowers/[id]/letter/route')).GET
    NOTES = (await import('../../app/api/v1/borrowers/[id]/notes/route')).POST

    const { data: user, error: userErr } = await db.auth.admin.createUser({ email: `${code.toLowerCase()}@test.local`, email_confirm: true })
    if (userErr) throw userErr
    ownerId = user.user.id
    const { data: brand, error } = await db
      .from('brands')
      .insert({
        name: 'Webhook Lender',
        code,
        address: '18 Idowu Taylor Street, Victoria Island, Lagos',
        contact_emails: ['ops@webhooklender.test'],
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
    const { data: matters } = await db.from('cases').select('id').eq('brand_id', brandId)
    if (matters?.length) await db.storage.from('case-documents').remove(matters.map((m) => `reviewed/${m.id}.pdf`))
    const { data: docs } = await db.from('brand_case_documents').select('storage_path, brand_cases!inner(brand_id)').eq('brand_cases.brand_id', brandId)
    if (docs?.length) await db.storage.from('case-evidence').remove(docs.map((d) => d.storage_path))
    await db.from('brand_change_flags').delete().eq('brand_id', brandId)
    await db.from('cases').delete().eq('brand_id', brandId)
    await db.from('brand_cases').delete().eq('brand_id', brandId)
    await db.from('brands').delete().eq('id', brandId)
    if (ownerId) await db.auth.admin.deleteUser(ownerId)
  })

  it('staff save the addresses: private or plain-http ones are refused; the secret is shown once', async () => {
    expect(await hooks.saveWebhookSettings(brandId, { liveUrl: 'https://10.0.0.5/hook', testUrl: '' }, 'staff')).toMatchObject({ ok: false, status: 400 })
    expect(await hooks.saveWebhookSettings(brandId, { liveUrl: 'http://hooks.lender.example', testUrl: '' }, 'staff')).toMatchObject({ ok: false, status: 400 })

    const first = await hooks.saveWebhookSettings(brandId, { liveUrl: LIVE_URL, testUrl: TEST_URL }, 'staff')
    expect(first.ok && first.secret).toMatch(/^whsec_/)
    secret = (first as { secret: string }).secret
    expect(await hooks.saveWebhookSettings(brandId, { liveUrl: LIVE_URL, testUrl: TEST_URL }, 'staff')).toEqual({ ok: true, secret: null })
    expect((await hooks.getWebhookSettings(brandId))!.secret_hint).toBe(`${secret.slice(0, 10)}…`)
  })

  it('a borrower with gaps: the update is queued by the database itself, signed and delivered', async () => {
    const r = await submit(liveKey, borrower('LN-1', { email: '' }))
    expect(r.status).toBe('missing_documents')
    const c = await caseFor('LN-1')
    expect((await deliveriesFor(c.id)).map((d) => [d.event, d.status])).toEqual([['borrower.missing_documents', 'pending']])

    calls = []
    expect(await deliver()).toMatchObject({ delivered: 1, failed: 0 })
    expect(calls).toHaveLength(1)
    const sent = calls[0]
    expect(sent.url).toBe(LIVE_URL)
    expect(sent.headers['x-pandaslp-event']).toBe('borrower.missing_documents')
    expect(format.verifyWebhookSignature(secret, sent.body, sent.headers['x-pandaslp-signature'], Math.floor(Date.now() / 1000))).toBe(true)
    const body = JSON.parse(sent.body)
    expect(body).toMatchObject({ event: 'borrower.missing_documents', test: false, data: { case_id: c.case_ref, loan_id: 'LN-1', missing: ['Email (needed to send the reminders)'] } })
    expect(body.id).toBe(sent.headers['x-pandaslp-delivery'])

    calls = []
    await deliver()
    expect(calls).toHaveLength(0) // never sent twice
  })

  it('sheet borrowers are never queued (their brand sees the sheet)', async () => {
    const { data: sheetCase } = await db.from('brand_cases').insert({ brand_id: brandId, case_ref: `${code}-9999`, status: 'new', source: 'sheet' }).select('id, case_ref').single()
    await db.from('brand_case_events').insert({ brand_case_id: sheetCase!.id, case_ref: sheetCase!.case_ref, event_type: 'missing_documents', detail: {}, actor: 'test' })
    expect(await deliveriesFor(sheetCase!.id)).toHaveLength(0)
  })

  it('a note answers Missing Documents: it goes back to New with the note in its details', async () => {
    const res = await call(NOTES, liveKey, 'LN-1', { method: 'POST', body: JSON.stringify({ note: 'Borrower email is not on file; serve by WhatsApp.' }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'new', reopened: true, used_for_letter: true })
    const c = await caseFor('LN-1')
    expect(c.borrower.Notes).toMatch(/^\[\d{4}-\d{2}-\d{2}\] Borrower email is not on file; serve by WhatsApp\.$/)
    expect(c.last_notes).toBe(c.borrower.Notes)
    expect((await call(NOTES, liveKey, 'LN-1', { method: 'POST', body: '{}' })).status).toBe(400)
    expect((await call(NOTES, liveKey, 'NOPE', { method: 'POST', body: JSON.stringify({ note: 'x' }) })).status).toBe(404)

    // Resending the original loan (no notes in it) doesn't wipe the note.
    await submit(liveKey, borrower('LN-1', { email: '' }))
    expect((await caseFor('LN-1')).borrower.Notes).toContain('serve by WhatsApp')
  })

  it('the whole journey: each step reaches the brand once, in order; the letter is pulled once approved', async () => {
    await submit(liveKey, borrower('LN-2'))
    await runSync()
    const c = await caseFor('LN-2')
    expect(c.status).toBe('letter_drafted')

    // Not approved yet: no letter.
    const early = await call(LETTER, liveKey, 'LN-2')
    expect(early.status).toBe(409)
    expect((await early.json()).error.code).toBe('letter_not_available')

    const serving = await import('../brandServing')
    await serving.approveBrandLetter(c.case_id, 'lawyer@pandaslp.test', { workspace: null, now: () => new Date() })
    const approved = await call(LETTER, liveKey, c.case_ref)
    expect(approved.status).toBe(200)
    expect(approved.headers.get('content-type')).toBe('application/pdf')
    expect(approved.headers.get('x-letter-version')).toBe('approved')
    expect(approved.headers.get('x-letter-stamped')).toBe('no')
    expect(Buffer.from(await approved.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF')

    // Staff attach the stamped copy and serve it: that's the copy the brand gets from now on.
    const stamped = Buffer.from('%PDF-1.4 stamped and signed copy')
    await db.storage.from('case-documents').upload(`reviewed/${c.case_id}.pdf`, stamped, { contentType: 'application/pdf', upsert: true })
    await serving.recordBrandServed(c.case_id, 'staff@pandaslp.test', { workspace: null, now: () => new Date() })
    const served = await call(LETTER, liveKey, 'LN-2')
    expect(served.headers.get('x-letter-version')).toBe('served')
    expect(served.headers.get('x-letter-stamped')).toBe('yes')
    expect(Buffer.from(await served.arrayBuffer()).equals(stamped)).toBe(true)

    const { setOutcome } = await import('../brandExceptions')
    expect(await setOutcome(c.id, 'paid', 'Paid in full at the branch.', 'staff@pandaslp.test', null)).toEqual({ ok: true })

    calls = []
    await deliver()
    const events = calls.filter((x) => JSON.parse(x.body).data.case_id === c.case_ref).map((x) => JSON.parse(x.body))
    expect(events.map((e) => e.event)).toEqual(['borrower.letter_drafted', 'borrower.lawyer_approved', 'borrower.served', 'borrower.outcome'])
    expect(events[2].data.letter_url).toBe(`https://pandaslp.com.ng/api/v1/borrowers/${c.case_ref}/letter`)
    expect(events[3].data).toEqual({ case_id: c.case_ref, loan_id: 'LN-2', status: 'paid', outcome: 'paid' })
  })

  it('after we started: changed details are flagged for staff, not applied, and only once', async () => {
    const r = await submit(liveKey, borrower('LN-2', { amount_outstanding: 999999 }))
    expect(r).toMatchObject({ duplicate: true, flagged: ['Amount Outstanding'], note: expect.stringContaining('not applied') })
    const c = await caseFor('LN-2')
    expect(c.borrower['Amount Outstanding']).toBe('380000')
    const { data: flags } = await db.from('brand_change_flags').select('column_name, old_value, new_value').eq('brand_case_id', c.id)
    expect(flags).toEqual([{ column_name: 'Amount Outstanding', old_value: '380000', new_value: '999999' }])

    const again = await submit(liveKey, borrower('LN-2', { amount_outstanding: 999999 }))
    expect(again.flagged).toBeUndefined()
    expect((await db.from('brand_change_flags').select('id').eq('brand_case_id', c.id)).data).toHaveLength(1)
  })

  it('a note after the letter is logged for staff, not used for the letter', async () => {
    const res = await call(NOTES, liveKey, 'LN-2', { method: 'POST', body: JSON.stringify({ note: 'Borrower called to say they will pay Friday.' }) })
    expect(await res.json()).toMatchObject({ reopened: false, used_for_letter: false })
    const c = await caseFor('LN-2')
    expect(c.last_notes).toContain('pay Friday')
    expect(c.borrower.Notes ?? '').not.toContain('pay Friday')
  })

  it('their system down: retried with growing gaps, given up after 24 hours, staff told once', async () => {
    await submit(liveKey, borrower('LN-3', { phone_number: '' }))
    const c = await caseFor('LN-3')
    answer = 503
    const t0 = new Date()
    expect(await deliver({ now: () => t0, brandCaseId: c.id })).toMatchObject({ retrying: 1 })
    let [d] = await deliveriesFor(c.id)
    expect(d).toMatchObject({ status: 'pending', attempts: 1, last_http_status: 503 })
    expect(new Date(d.next_attempt_at).getTime() - t0.getTime()).toBe(60_000)

    calls = []
    await deliver({ now: () => new Date(t0.getTime() + 30_000), brandCaseId: c.id })
    expect(calls).toHaveLength(0) // not due yet

    // A day later, still down.
    answer = 0
    await db.from('brand_webhook_deliveries').update({ created_at: new Date(Date.now() - 25 * 60 * 60_000).toISOString(), next_attempt_at: new Date().toISOString() }).eq('id', d.id)
    mails.length = 0
    await deliver()
    ;[d] = await deliveriesFor(c.id)
    expect(d).toMatchObject({ status: 'failed', attempts: 2, last_error: 'connect ECONNREFUSED' })
    expect(mails).toHaveLength(1)
    expect(mails[0].subject).toMatch(/could not be delivered/)
    expect(mails[0].text).toContain(c.case_ref)
    await deliver()
    expect(mails).toHaveLength(1) // told once

    // Staff fix it and retry.
    answer = 200
    expect(await hooks.retryDelivery(d.id)).toBe(true)
    await deliver({ brandCaseId: c.id })
    ;[d] = await deliveriesFor(c.id)
    expect(d.status).toBe('delivered')
    expect(await hooks.retryDelivery(d.id)).toBe(false) // only failed or skipped ones
  })

  it('test borrowers go to the test address; with none set they are skipped', async () => {
    calls = []
    await submit(testKey, borrower('LN-1', { email: '' }))
    await deliver()
    expect(calls.map((x) => x.url)).toEqual([TEST_URL])
    expect(JSON.parse(calls[0].body).test).toBe(true)

    await hooks.saveWebhookSettings(brandId, { liveUrl: LIVE_URL, testUrl: '' }, 'staff')
    await submit(testKey, borrower('LN-9', { email: '' }))
    calls = []
    expect(await deliver()).toMatchObject({ skipped: 1 })
    expect(calls).toHaveLength(0)
  })

  it('"Send test event": a signed ping now; a failure is reported, never retried', async () => {
    answer = 200
    calls = []
    const ok = await hooks.sendTestEvent(brandId, 'live', { post })
    expect(ok).toMatchObject({ status: 'delivered', httpStatus: 200 })
    expect(JSON.parse(calls[0].body)).toMatchObject({ event: 'ping', test: false })

    answer = 500
    const bad = await hooks.sendTestEvent(brandId, 'live', { post })
    expect(bad).toMatchObject({ status: 'failed', httpStatus: 500 })
    const { data: row } = await db.from('brand_webhook_deliveries').select('status, staff_alerted_at').eq('id', bad.deliveryId).single()
    expect(row!.status).toBe('failed')
    expect(row!.staff_alerted_at).not.toBeNull() // staff are looking at it: no alert email
    answer = 200
  })
})
