// Server-only. Phase 5B of plans/phase-5-api-intake.md: we call the brand's system when one of
// their API borrowers moves on (letter drafted, approved, served, Day 7, Day 14, awaiting their
// decision, outcome, or missing documents).
//
// Updates are queued by a database trigger on brand_case_events (add-brand-webhooks.sql), so
// whichever code path moves a borrower on, the brand hears about it. This file sends them:
//   - deliverDueWebhooks: run by the 15-minute scheduled job, and straight after a staff action
//     (approve, serve, outcome) for that borrower, so the brand hears within seconds.
//   - each update is signed (lib/brandWebhookFormat.ts), retried with growing gaps for up to
//     24 hours, then marked failed; staff get one email listing the failures.
//   - "at least once": a brand may occasionally get the same update twice (same `id`), never none.

import { randomBytes } from 'crypto'
import { lookup } from 'dns/promises'
import { supabaseAdmin } from './supabaseAdmin'
import { GMAIL_USER, sendMail, type SendMailOptions } from './mailer'
import { isPrivateAddress } from './brandApiInput'
import { buildWebhookBody, nextAttemptAt, signWebhook, webhookUrlProblem, type WebhookBody, type WebhookEvent } from './brandWebhookFormat'

const POST_TIMEOUT_MS = 10_000
const LOCK_MS = 60_000
const BATCH = 50

export type WebhookPoster = (url: string, body: string, headers: Record<string, string>, timeoutMs: number) => Promise<{ status: number }>

export interface DeliverDeps {
  post?: WebhookPoster
  now?: () => Date
  mail?: (opts: SendMailOptions) => Promise<unknown>
  /** Only this borrower's updates (the quick send after a staff action). */
  brandCaseId?: string
  /** Only this brand's updates (and its failures in the staff alert). */
  brandId?: string
  /** Stop starting new sends after this time (ms since epoch). */
  deadline?: number
  timeoutMs?: number
}

export interface DeliverReport {
  delivered: number
  retrying: number
  failed: number
  skipped: number
  staffAlerted: number
}

interface DeliveryRow {
  id: string
  brand_id: string
  event: WebhookEvent
  is_test: boolean
  occurred_at: string
  payload: WebhookBody | null
  attempts: number
  created_at: string
  brand_cases: { case_ref: string; external_ref: string | null } | null
  brand_case_events: { detail: Record<string, unknown> } | null
}

interface WebhookSettings {
  live_url: string | null
  test_url: string | null
  secret: string
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'

/**
 * POSTs to the brand's address. Refuses private addresses (checked after the name is looked up)
 * and doesn't follow redirects, so a webhook can never be pointed inside our own network.
 */
export const postWebhook: WebhookPoster = async (url, body, headers, timeoutMs) => {
  const problem = webhookUrlProblem(url)
  if (problem) throw new Error(`The web address ${problem}`)
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '')
  const addresses = await lookup(host, { all: true })
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('The web address points to a private address')
  const res = await fetch(url, { method: 'POST', body, headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
  await res.body?.cancel()
  return { status: res.status }
}

// ── Settings ──────────────────────────────────────────────────────────────

export const newWebhookSecret = () => `whsec_${randomBytes(24).toString('base64url')}`

export async function getWebhookSettings(brandId: string) {
  const { data } = await supabaseAdmin.from('brand_webhooks').select('live_url, test_url, secret, updated_by, updated_at').eq('brand_id', brandId).maybeSingle()
  if (!data) return null
  // The secret itself is never shown again; only its first characters, to tell secrets apart.
  return { live_url: data.live_url, test_url: data.test_url, secret_hint: `${data.secret.slice(0, 10)}…`, updated_by: data.updated_by, updated_at: data.updated_at }
}

/** Saves the brand's web addresses. Creates the secret the first time, returning it (the only time it's shown). */
export async function saveWebhookSettings(
  brandId: string,
  urls: { liveUrl: string; testUrl: string },
  actor: string,
): Promise<{ ok: true; secret: string | null } | { ok: false; status: number; error: string }> {
  const live = urls.liveUrl.trim()
  const test = urls.testUrl.trim()
  for (const [label, url] of [['Live address', live], ['Test address', test]] as const) {
    const problem = url ? webhookUrlProblem(url) : null
    if (problem) return { ok: false, status: 400, error: `${label} ${problem}.` }
  }
  const { data: existing } = await supabaseAdmin.from('brand_webhooks').select('brand_id').eq('brand_id', brandId).maybeSingle()
  const row = { live_url: live || null, test_url: test || null, updated_by: actor, updated_at: new Date().toISOString() }
  if (existing) {
    const { error } = await supabaseAdmin.from('brand_webhooks').update(row).eq('brand_id', brandId)
    return error ? { ok: false, status: 500, error: error.message } : { ok: true, secret: null }
  }
  const secret = newWebhookSecret()
  const { error } = await supabaseAdmin.from('brand_webhooks').insert({ brand_id: brandId, secret, ...row })
  return error ? { ok: false, status: 500, error: error.message } : { ok: true, secret }
}

/** A new secret (the old one stops working at once). Returned once. */
export async function rotateWebhookSecret(brandId: string, actor: string): Promise<string | null> {
  const secret = newWebhookSecret()
  const { data } = await supabaseAdmin
    .from('brand_webhooks')
    .update({ secret, updated_by: actor, updated_at: new Date().toISOString() })
    .eq('brand_id', brandId)
    .select('brand_id')
  return data?.length ? secret : null
}

// ── Sending ───────────────────────────────────────────────────────────────

const DELIVERY_FIELDS = 'id, brand_id, event, is_test, occurred_at, payload, attempts, created_at, brand_cases(case_ref, external_ref), brand_case_events(detail)'

/** Sends every update that is due (or just one borrower's), then tells staff about new failures. */
export async function deliverDueWebhooks(deps: DeliverDeps = {}): Promise<DeliverReport> {
  const now = deps.now ?? (() => new Date())
  const report: DeliverReport = { delivered: 0, retrying: 0, failed: 0, skipped: 0, staffAlerted: 0 }
  let q = supabaseAdmin
    .from('brand_webhook_deliveries')
    .select(DELIVERY_FIELDS)
    .eq('status', 'pending')
    // A new update is always due. Its next_attempt_at comes from the database's clock, which may
    // run a little ahead of ours; retry times are set (and compared) by our clock only.
    .or(`attempts.eq.0,next_attempt_at.lte.${now().toISOString()}`)
    .order('next_attempt_at', { ascending: true })
    .limit(BATCH)
  if (deps.brandCaseId) q = q.eq('brand_case_id', deps.brandCaseId)
  if (deps.brandId) q = q.eq('brand_id', deps.brandId)
  const { data: due, error } = await q.returns<DeliveryRow[]>()
  if (error) throw new Error(`Could not read webhook deliveries: ${error.message}`)

  const settings = new Map<string, WebhookSettings | null>()
  for (const d of due ?? []) {
    if (deps.deadline && Date.now() > deps.deadline) break
    if (!(await lock(d.id, now()))) continue // another run is sending it
    if (!settings.has(d.brand_id)) {
      const { data } = await supabaseAdmin.from('brand_webhooks').select('live_url, test_url, secret').eq('brand_id', d.brand_id).maybeSingle<WebhookSettings>()
      settings.set(d.brand_id, data ?? null)
    }
    const outcome = await attempt(d, settings.get(d.brand_id) ?? null, deps, false)
    report[outcome.status === 'pending' ? 'retrying' : outcome.status]++
  }
  if (!deps.brandCaseId) report.staffAlerted = await alertStaffAboutFailures(deps)
  return report
}

async function lock(id: string, now: Date): Promise<boolean> {
  const at = now.toISOString()
  const { data } = await supabaseAdmin
    .from('brand_webhook_deliveries')
    .update({ locked_until: new Date(now.getTime() + LOCK_MS).toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .or(`locked_until.is.null,locked_until.lt.${at}`)
    .select('id')
  return Boolean(data?.length)
}

type AttemptOutcome = { status: 'delivered' | 'pending' | 'failed' | 'skipped'; httpStatus: number | null; error: string | null }

/** One send of one update. `once` = a staff test event: never retried, never alerted. */
async function attempt(d: DeliveryRow, s: WebhookSettings | null, deps: DeliverDeps, once: boolean): Promise<AttemptOutcome> {
  const now = (deps.now ?? (() => new Date()))()
  const url = s ? (d.is_test ? s.test_url : s.live_url) : null
  if (!s || !url) {
    const error = `No ${d.is_test ? 'test' : 'live'} web address is set for this brand.`
    await supabaseAdmin.from('brand_webhook_deliveries').update({ status: 'skipped', last_error: error, locked_until: null }).eq('id', d.id)
    return { status: 'skipped', httpStatus: null, error }
  }

  const payload =
    d.payload ??
    buildWebhookBody({
      deliveryId: d.id,
      event: d.event,
      occurredAt: d.occurred_at,
      isTest: d.is_test,
      caseRef: d.brand_cases?.case_ref ?? null,
      loanId: d.brand_cases?.external_ref ?? null,
      detail: d.brand_case_events?.detail ?? {},
      siteUrl: siteUrl(),
    })
  const body = JSON.stringify(payload)
  const headers = {
    'content-type': 'application/json',
    'user-agent': 'PandasLP-Webhooks/1',
    'x-pandaslp-event': d.event,
    'x-pandaslp-delivery': d.id,
    'x-pandaslp-signature': signWebhook(s.secret, body, Math.floor(now.getTime() / 1000)),
  }

  let httpStatus: number | null = null
  let error: string | null = null
  try {
    httpStatus = (await (deps.post ?? postWebhook)(url, body, headers, deps.timeoutMs ?? POST_TIMEOUT_MS)).status
    if (httpStatus < 200 || httpStatus >= 300) error = `Their system answered HTTP ${httpStatus}`
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  const attempts = d.attempts + 1
  const common = { payload, attempts, last_http_status: httpStatus, last_error: error, locked_until: null }
  if (!error) {
    await supabaseAdmin.from('brand_webhook_deliveries').update({ ...common, status: 'delivered', delivered_at: now.toISOString() }).eq('id', d.id)
    return { status: 'delivered', httpStatus, error: null }
  }
  const next = once ? null : nextAttemptAt(attempts, new Date(d.created_at), now)
  if (next) {
    await supabaseAdmin.from('brand_webhook_deliveries').update({ ...common, next_attempt_at: next.toISOString() }).eq('id', d.id)
    return { status: 'pending', httpStatus, error }
  }
  await supabaseAdmin
    .from('brand_webhook_deliveries')
    .update({ ...common, status: 'failed', failed_at: now.toISOString(), ...(once ? { staff_alerted_at: now.toISOString() } : {}) })
    .eq('id', d.id)
  return { status: 'failed', httpStatus, error }
}

/** One email to the firm listing updates that gave up since the last alert. */
async function alertStaffAboutFailures(deps: DeliverDeps): Promise<number> {
  let q = supabaseAdmin
    .from('brand_webhook_deliveries')
    .select('id, event, last_error, created_at, brands(code, name), brand_cases(case_ref)')
    .eq('status', 'failed')
    .is('staff_alerted_at', null)
    .limit(100)
  if (deps.brandId) q = q.eq('brand_id', deps.brandId)
  const { data: failed } = await q
  if (!failed?.length) return 0
  const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)
  const lines = failed.map((f) => {
    const brand = one(f.brands as { code: string } | { code: string }[] | null)
    const c = one(f.brand_cases as { case_ref: string } | { case_ref: string }[] | null)
    return `${brand?.code ?? '?'} · ${c?.case_ref ?? 'test event'} · ${f.event} · ${f.last_error ?? 'unknown error'}`
  })
  const text = [
    `These updates to brands' systems could not be delivered for 24 hours and have been given up on:`,
    '',
    ...lines,
    '',
    `The brand can still see each borrower's status through the API. Check the address in Admin → Brands, then use "Retry" on the delivery, or tell the brand their system was unreachable.`,
  ].join('\n')
  try {
    await (deps.mail ?? sendMail)({ to: GMAIL_USER, subject: `Brand API: ${failed.length} update${failed.length === 1 ? '' : 's'} could not be delivered`, text, html: `<pre style="font-family:inherit">${escapeHtml(text)}</pre>` })
  } catch (err) {
    console.error('Could not email staff about failed webhooks:', err)
    return 0 // try again on the next run
  }
  await supabaseAdmin.from('brand_webhook_deliveries').update({ staff_alerted_at: new Date().toISOString() }).in('id', failed.map((f) => f.id))
  return failed.length
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The quick send after a staff action. Never throws: the scheduled job catches up anyway. */
export async function deliverForBorrower(brandCaseId: string, deps: DeliverDeps = {}): Promise<void> {
  try {
    await deliverDueWebhooks({ timeoutMs: 5_000, ...deps, brandCaseId })
  } catch (err) {
    console.error('Quick webhook send failed (the scheduled job will retry):', err)
  }
}

/** The same, from a matter's id (approve and serve work on the matter). Only API borrowers have updates. */
export async function deliverForMatter(caseId: string, deps: DeliverDeps = {}): Promise<void> {
  const { data } = await supabaseAdmin.from('brand_cases').select('id').eq('case_id', caseId).eq('source', 'api').maybeSingle()
  if (data) await deliverForBorrower(data.id, deps)
}

/** "Send test event" in the admin: a ping, sent now, never retried. Returns what happened. */
export async function sendTestEvent(brandId: string, mode: 'live' | 'test', deps: DeliverDeps = {}): Promise<AttemptOutcome & { deliveryId: string }> {
  const { data: d, error } = await supabaseAdmin
    .from('brand_webhook_deliveries')
    .insert({ brand_id: brandId, event: 'ping', is_test: mode === 'test', locked_until: new Date(Date.now() + LOCK_MS).toISOString() })
    .select(DELIVERY_FIELDS)
    .single<DeliveryRow>()
  if (error || !d) throw new Error(`Could not create the test event: ${error?.message}`)
  const { data: s } = await supabaseAdmin.from('brand_webhooks').select('live_url, test_url, secret').eq('brand_id', brandId).maybeSingle<WebhookSettings>()
  return { deliveryId: d.id, ...(await attempt(d, s ?? null, deps, true)) }
}

/** Staff "Retry" on a failed or skipped update: back in the queue, sent on the next run, with a fresh 24 hours of retries. */
export async function retryDelivery(id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('brand_webhook_deliveries')
    .update({ status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString(), created_at: new Date().toISOString(), failed_at: null, staff_alerted_at: null, locked_until: null })
    .eq('id', id)
    .in('status', ['failed', 'skipped'])
    .neq('event', 'ping')
    .select('id')
  return Boolean(data?.length)
}
