export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { generateApiKey, type ApiKeyMode } from '@/lib/brandApiInput'
import { getWebhookSettings, retryDelivery, rotateWebhookSecret, saveWebhookSettings, sendTestEvent } from '@/lib/brandWebhooks'
import { testModeProgress } from '@/lib/brandTestMode'

// Staff controls for a brand's API (phases 5A and 5B of plans/phase-5-api-intake.md). The admin
// screens for these come in phase 5C.
//
// GET  ?brandId=…                                     the channel, the keys (never the keys themselves), recent
//                                                     calls, the webhook addresses, recent deliveries, and how far
//                                                     the brand's test-mode integration has got
// POST { action: 'set_channel', brandId, channel }    'sheet' | 'api' | 'both'
// POST { action: 'create_key', brandId, mode, label, reason? }
//                                                     returns the key ONCE: only its hash is stored. A live key
//                                                     needs the test-mode checks passed, or a written reason
// POST { action: 'revoke_key', keyId }
// POST { action: 'set_webhook', brandId, liveUrl, testUrl }  the first save returns the signing secret ONCE
// POST { action: 'rotate_webhook_secret', brandId }   a new secret, returned ONCE; the old one stops working
// POST { action: 'send_test_event', brandId, mode }   sends a signed "ping" now and says what happened
// POST { action: 'retry_delivery', deliveryId }       a failed or skipped update goes back in the queue
export async function GET(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const brandId = new URL(req.url).searchParams.get('brandId')
  if (!brandId) return Response.json({ error: 'Missing brandId.' }, { status: 400 })

  const [{ data: brand }, { data: keys }, { data: requests }, webhook, { data: deliveries }, testProgress] = await Promise.all([
    supabaseAdmin.from('brands').select('id, code, intake_channel').eq('id', brandId).maybeSingle(),
    supabaseAdmin
      .from('brand_api_keys')
      .select('id, mode, key_prefix, label, created_by, created_at, last_used_at, revoked_at, revoked_by, issued_before_test_passed_reason')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('brand_api_requests')
      .select('id, mode, method, path, status, detail, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(50),
    getWebhookSettings(brandId),
    supabaseAdmin
      .from('brand_webhook_deliveries')
      .select('id, event, is_test, status, attempts, next_attempt_at, last_http_status, last_error, delivered_at, failed_at, created_at, brand_cases(case_ref)')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(50),
    testModeProgress(brandId),
  ])
  if (!brand) return Response.json({ error: 'Brand not found.' }, { status: 404 })
  return Response.json({ channel: brand.intake_channel, keys: keys ?? [], requests: requests ?? [], webhook, deliveries: deliveries ?? [], testProgress })
}

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-brand-api:${getClientIp(req)}`, 30, 5 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const actor = authResult.user.email ?? 'staff'

  const body = (await req.json().catch(() => ({}))) as {
    action?: string
    brandId?: string
    channel?: string
    mode?: string
    label?: string
    keyId?: string
    liveUrl?: string
    testUrl?: string
    deliveryId?: string
    reason?: string
  }

  if (body.action === 'set_channel') {
    if (!body.brandId || !['sheet', 'api', 'both'].includes(body.channel ?? '')) return Response.json({ error: 'Missing brandId, or channel is not sheet, api or both.' }, { status: 400 })
    const { data, error } = await supabaseAdmin.from('brands').update({ intake_channel: body.channel }).eq('id', body.brandId).select('id')
    if (error) return Response.json({ error: `Could not save. (${error.message})` }, { status: 500 })
    if (!data?.length) return Response.json({ error: 'Brand not found.' }, { status: 404 })
    return Response.json({ ok: true, channel: body.channel })
  }

  if (body.action === 'create_key') {
    const mode = body.mode as ApiKeyMode
    if (!body.brandId || (mode !== 'test' && mode !== 'live')) return Response.json({ error: 'Missing brandId, or mode is not test or live.' }, { status: 400 })
    const { data: brand } = await supabaseAdmin.from('brands').select('id').eq('id', body.brandId).maybeSingle()
    if (!brand) return Response.json({ error: 'Brand not found.' }, { status: 404 })
    // A live key only once the brand's integration works with the test key (plans/phase-5-api-intake.md, 5C).
    const reason = body.reason?.trim() ?? ''
    const early = mode === 'live' && !(await testModeProgress(body.brandId)).passed
    if (early && reason.length < 10) {
      return Response.json(
        { error: 'The brand hasn’t passed the test-mode checks yet. Give a reason (at least 10 characters) to issue a live key anyway.' },
        { status: 409 },
      )
    }
    const { key, prefix, hash } = generateApiKey(mode)
    const { data, error } = await supabaseAdmin
      .from('brand_api_keys')
      .insert({
        brand_id: body.brandId,
        mode,
        key_prefix: prefix,
        key_hash: hash,
        label: body.label?.trim().slice(0, 80) || null,
        created_by: actor,
        issued_before_test_passed_reason: early ? reason.slice(0, 500) : null,
      })
      .select('id, mode, key_prefix, label, created_at')
      .single()
    if (error || !data) return Response.json({ error: `Could not create the key. (${error?.message})` }, { status: 500 })
    // The only time the key itself is ever shown. Lost keys are revoked and replaced, never recovered.
    return Response.json({ ok: true, key, ...data })
  }

  if (body.action === 'revoke_key') {
    if (!body.keyId) return Response.json({ error: 'Missing keyId.' }, { status: 400 })
    const { data, error } = await supabaseAdmin
      .from('brand_api_keys')
      .update({ revoked_at: new Date().toISOString(), revoked_by: actor })
      .eq('id', body.keyId)
      .is('revoked_at', null)
      .select('id')
    if (error) return Response.json({ error: `Could not revoke. (${error.message})` }, { status: 500 })
    if (!data?.length) return Response.json({ error: 'Key not found, or already revoked.' }, { status: 409 })
    return Response.json({ ok: true })
  }

  if (body.action === 'set_webhook') {
    if (!body.brandId) return Response.json({ error: 'Missing brandId.' }, { status: 400 })
    const { data: brand } = await supabaseAdmin.from('brands').select('id').eq('id', body.brandId).maybeSingle()
    if (!brand) return Response.json({ error: 'Brand not found.' }, { status: 404 })
    const result = await saveWebhookSettings(body.brandId, { liveUrl: body.liveUrl ?? '', testUrl: body.testUrl ?? '' }, actor)
    if (result.ok === false) return Response.json({ error: result.error }, { status: result.status })
    // The secret is returned only the first time (pass it to the brand); otherwise null.
    return Response.json({ ok: true, secret: result.secret })
  }

  if (body.action === 'rotate_webhook_secret') {
    if (!body.brandId) return Response.json({ error: 'Missing brandId.' }, { status: 400 })
    const secret = await rotateWebhookSecret(body.brandId, actor)
    if (!secret) return Response.json({ error: 'Save the brand’s web address first.' }, { status: 409 })
    return Response.json({ ok: true, secret })
  }

  if (body.action === 'send_test_event') {
    if (!body.brandId || (body.mode !== 'test' && body.mode !== 'live')) return Response.json({ error: 'Missing brandId, or mode is not test or live.' }, { status: 400 })
    const result = await sendTestEvent(body.brandId, body.mode)
    return Response.json({ ok: result.status === 'delivered', ...result })
  }

  if (body.action === 'retry_delivery') {
    if (!body.deliveryId) return Response.json({ error: 'Missing deliveryId.' }, { status: 400 })
    if (!(await retryDelivery(body.deliveryId))) return Response.json({ error: 'Only a failed or skipped update can be retried.' }, { status: 409 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 })
}
