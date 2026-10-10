'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, Circle, Copy, ExternalLink, RotateCcw, Send } from 'lucide-react'
import { authedFetch } from '@/lib/supabaseClient'

// Admin → Brands → a brand → "API": everything about the brand's API (phases 5A–5C of
// plans/phase-5-api-intake.md). The channel, the test-mode checks a brand passes before it gets
// a live key, the keys, the web addresses we send updates to, the delivery log, and the
// brand's recent calls. All of it goes through /api/admin/brands/api.

type Channel = 'sheet' | 'api' | 'both'

interface KeyRow {
  id: string
  mode: 'test' | 'live'
  key_prefix: string
  label: string | null
  created_by: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
  revoked_by: string | null
  issued_before_test_passed_reason: string | null
}

interface DeliveryRow {
  id: string
  event: string
  is_test: boolean
  status: 'pending' | 'delivered' | 'failed' | 'skipped'
  attempts: number
  next_attempt_at: string
  last_http_status: number | null
  last_error: string | null
  delivered_at: string | null
  created_at: string
  brand_cases: { case_ref: string } | null
}

interface RequestRow {
  id: string
  mode: string | null
  method: string
  path: string
  status: number
  created_at: string
}

interface TestProgress {
  submitted: boolean
  journeyFinished: boolean
  letterPulled: boolean
  webhookDelivered: boolean
  passed: boolean
}

interface ApiState {
  channel: Channel
  keys: KeyRow[]
  requests: RequestRow[]
  webhook: { live_url: string | null; test_url: string | null; secret_hint: string; updated_by: string | null; updated_at: string } | null
  deliveries: DeliveryRow[]
  testProgress: TestProgress
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

const DELIVERY_STATUS: Record<DeliveryRow['status'], { label: string; color: string }> = {
  pending: { label: 'Retrying', color: 'var(--warning)' },
  delivered: { label: 'Delivered', color: '#16a34a' },
  failed: { label: 'Failed', color: 'var(--danger)' },
  skipped: { label: 'Not sent (no address)', color: 'var(--text-3)' },
}

async function post(body: Record<string, unknown>) {
  const res = await authedFetch('/api/admin/brands/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-2)' }}>{title}</div>
        {hint && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{hint}</div>}
      </div>
      {children}
    </section>
  )
}

/** A secret shown once, with a copy button. */
function Reveal({ label, value, onDone }: { label: string; value: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div role="status" style={{ display: 'grid', gap: 6, padding: '10px 12px', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-1)' }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}: copy it now. It won’t be shown again.</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, overflowWrap: 'anywhere', flex: '1 1 260px' }}>{value}</code>
        <button
          type="button"
          className="btn btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
        >
          <Copy size={12} aria-hidden="true" style={{ marginRight: 5 }} />
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className="btn btn-sm" onClick={onDone}>
          I’ve saved it
        </button>
      </div>
    </div>
  )
}

export default function BrandApiPanel({ brandId }: { brandId: string }) {
  const [state, setState] = useState<ApiState | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    const res = await authedFetch(`/api/admin/brands/api?brandId=${encodeURIComponent(brandId)}`)
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'Could not load the API settings.')
    setState(data)
  }

  useEffect(() => {
    load().catch(() => setError('Network error while loading the API settings.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId])

  if (!state) return error ? <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p> : <p style={{ color: 'var(--text-2)', fontSize: 13, margin: 0 }}>Loading API…</p>

  const run = async (body: Record<string, unknown>, success: string): Promise<Record<string, unknown> | null> => {
    setError('')
    setNotice('')
    try {
      const { ok, data } = await post(body)
      if (!ok) {
        setError(data.error || 'That didn’t work.')
        return null
      }
      if (success) setNotice(success)
      await load()
      return data
    } catch {
      setError('Network error. Please try again.')
      return null
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14, fontSize: 13 }}>
      {notice && <div role="status" style={{ color: '#16a34a' }}>{notice}</div>}
      {error && <div role="alert" style={{ color: 'var(--danger)' }}>{error}</div>}

      <ChannelRow channel={state.channel} onSave={(channel) => run({ action: 'set_channel', brandId, channel }, 'Channel saved.')} />

      {state.channel !== 'sheet' || state.keys.length > 0 ? (
        <>
          <TestChecks progress={state.testProgress} />
          <Keys brandId={brandId} keys={state.keys} passed={state.testProgress.passed} run={run} />
          <Webhooks brandId={brandId} webhook={state.webhook} run={run} />
          <Deliveries deliveries={state.deliveries} run={run} />
          <Requests requests={state.requests} />
        </>
      ) : (
        <p style={{ color: 'var(--text-2)', margin: 0 }}>This brand sends borrowers by sheet only. Switch the channel to API or Sheet and API to issue keys.</p>
      )}
    </div>
  )
}

function ChannelRow({ channel, onSave }: { channel: Channel; onSave: (c: Channel) => Promise<unknown> }) {
  const [value, setValue] = useState<Channel>(channel)
  const [busy, setBusy] = useState(false)
  useEffect(() => setValue(channel), [channel])
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label htmlFor="api-channel" style={{ fontWeight: 600 }}>
        Borrowers arrive by
      </label>
      <select id="api-channel" className="input" value={value} onChange={(e) => setValue(e.target.value as Channel)} style={{ minHeight: 34, fontSize: 13, width: 'auto' }}>
        <option value="sheet">Google Sheet</option>
        <option value="api">API</option>
        <option value="both">Sheet and API</option>
      </select>
      <button
        type="button"
        className="btn btn-sm"
        disabled={busy || value === channel}
        onClick={async () => {
          setBusy(true)
          await onSave(value)
          setBusy(false)
        }}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
        <a href="/developers/api" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          Developer docs <ExternalLink size={12} aria-hidden="true" />
        </a>
        <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          OpenAPI <ExternalLink size={12} aria-hidden="true" />
        </a>
      </span>
    </div>
  )
}

function TestChecks({ progress }: { progress: TestProgress }) {
  const checks: [boolean, string][] = [
    [progress.submitted, 'Sent a borrower with the test key'],
    [progress.journeyFinished, 'Took a test borrower through to Day 14'],
    [progress.letterPulled, 'Downloaded a test letter'],
    [progress.webhookDelivered, 'Received a test update at their test address'],
  ]
  return (
    <Section
      title="Test mode"
      hint={progress.passed ? 'Passed: the brand’s integration works end to end. A live key can be issued.' : 'A live key is issued once all four are done (or with a written reason).'}
    >
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {checks.map(([done, label]) => (
          <li key={label} style={{ display: 'flex', gap: 6, alignItems: 'center', color: done ? 'var(--text-1)' : 'var(--text-2)' }}>
            {done ? <CheckCircle2 size={14} style={{ color: '#16a34a' }} aria-label="Done" /> : <Circle size={14} aria-label="Not yet" />}
            {label}
          </li>
        ))}
      </ul>
    </Section>
  )
}

type Run = (body: Record<string, unknown>, success: string) => Promise<Record<string, unknown> | null>

function Keys({ brandId, keys, passed, run }: { brandId: string; keys: KeyRow[]; passed: boolean; run: Run }) {
  const [creating, setCreating] = useState<'test' | 'live' | null>(null)
  const [label, setLabel] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const needsReason = creating === 'live' && !passed

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!creating) return
    setBusy(true)
    const data = await run({ action: 'create_key', brandId, mode: creating, label, ...(needsReason ? { reason } : {}) }, '')
    setBusy(false)
    if (data?.key) {
      setRevealed(String(data.key))
      setCreating(null)
      setLabel('')
      setReason('')
    }
  }

  return (
    <Section title="Keys" hint="Only a fingerprint of each key is stored. A lost key can’t be recovered: revoke it and issue a new one.">
      {revealed && <Reveal label="The new key" value={revealed} onDone={() => setRevealed(null)} />}
      {keys.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '6px 8px' }}>Key</th>
                <th style={{ padding: '6px 8px' }}>Label</th>
                <th style={{ padding: '6px 8px' }}>Created</th>
                <th style={{ padding: '6px 8px' }}>Last used</th>
                <th style={{ padding: '6px 8px' }} />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: k.revoked_at ? 0.55 : 1, verticalAlign: 'top' }}>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                    <code style={{ fontFamily: 'var(--font-mono)' }}>{k.key_prefix}…</code>{' '}
                    <span className="badge" style={{ fontSize: 11 }}>
                      {k.mode === 'live' ? 'Live' : 'Test'}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {k.label || <span style={{ color: 'var(--text-3)' }}>—</span>}
                    {k.issued_before_test_passed_reason && (
                      <div style={{ fontSize: 12, color: 'var(--warning)' }}>Issued before test mode passed: {k.issued_before_test_passed_reason}</div>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                    {when(k.created_at)}
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{k.created_by}</div>
                  </td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{when(k.last_used_at)}</td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {k.revoked_at ? (
                      <span style={{ fontSize: 12 }}>Revoked {when(k.revoked_at)}</span>
                    ) : revoking === k.id ? (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12 }}>Stops working at once.</span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' }}
                          onClick={async () => {
                            await run({ action: 'revoke_key', keyId: k.id }, `Key ${k.key_prefix}… revoked.`)
                            setRevoking(null)
                          }}
                        >
                          Revoke
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setRevoking(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-sm" onClick={() => setRevoking(k.id)}>
                        Revoke…
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating ? (
        <form onSubmit={create} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
          <div style={{ fontWeight: 600 }}>New {creating} key</div>
          <input className="input" placeholder="Label (optional), e.g. “Ops team staging server”" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} style={{ minHeight: 34, fontSize: 13 }} aria-label="Key label" />
          {needsReason && (
            <>
              <div style={{ color: 'var(--warning)' }}>The brand hasn’t passed the test-mode checks yet. Say why a live key should be issued anyway: it’s kept on the key.</div>
              <textarea className="input" required minLength={10} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (at least 10 characters)" aria-label="Reason for issuing a live key early" style={{ fontSize: 13 }} />
            </>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || (needsReason && reason.trim().length < 10)}>
              {busy ? 'Creating…' : `Create ${creating} key`}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setCreating(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm" onClick={() => setCreating('test')}>
            New test key
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setCreating('live')} title={passed ? undefined : 'Test mode not passed yet: needs a reason'}>
            New live key{passed ? '' : '…'}
          </button>
        </div>
      )}
    </Section>
  )
}

function Webhooks({ brandId, webhook, run }: { brandId: string; webhook: ApiState['webhook']; run: Run }) {
  const [liveUrl, setLiveUrl] = useState(webhook?.live_url ?? '')
  const [testUrl, setTestUrl] = useState(webhook?.test_url ?? '')
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  useEffect(() => {
    setLiveUrl(webhook?.live_url ?? '')
    setTestUrl(webhook?.test_url ?? '')
  }, [webhook?.live_url, webhook?.test_url])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const data = await run({ action: 'set_webhook', brandId, liveUrl, testUrl }, 'Web addresses saved.')
    setBusy(false)
    if (data?.secret) setSecret(String(data.secret))
  }

  async function sendTest(mode: 'live' | 'test') {
    setTestResult(null)
    const data = await run({ action: 'send_test_event', brandId, mode }, '')
    if (!data) return
    const r = data as { status: string; httpStatus: number | null; error: string | null }
    setTestResult(
      r.status === 'delivered'
        ? `Test event delivered to the ${mode} address (HTTP ${r.httpStatus}).`
        : r.status === 'skipped'
          ? `No ${mode} address saved.`
          : `Not delivered to the ${mode} address: ${r.error ?? 'unknown error'}.`,
    )
  }

  return (
    <Section title="Updates to their system (webhooks)" hint="We POST a signed update to these https addresses each time one of their API borrowers moves on.">
      {secret && <Reveal label="The signing secret (give it to the brand’s developers)" value={secret} onDone={() => setSecret(null)} />}
      <form onSubmit={save} style={{ display: 'grid', gap: 8, maxWidth: 620 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          Live address
          <input className="input" type="url" placeholder="https://their-system.example/pandas-webhooks" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} style={{ minHeight: 34, fontSize: 13 }} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          Test address (for test-key borrowers)
          <input className="input" type="url" placeholder="https://staging.their-system.example/pandas-webhooks" value={testUrl} onChange={(e) => setTestUrl(e.target.value)} style={{ minHeight: 34, fontSize: 13 }} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? 'Saving…' : 'Save addresses'}
          </button>
          {webhook && (
            <>
              <button type="button" className="btn btn-sm" onClick={() => sendTest('test')}>
                <Send size={12} aria-hidden="true" style={{ marginRight: 5 }} />
                Send test event (test)
              </button>
              <button type="button" className="btn btn-sm" onClick={() => sendTest('live')}>
                <Send size={12} aria-hidden="true" style={{ marginRight: 5 }} />
                Send test event (live)
              </button>
            </>
          )}
        </div>
      </form>
      {testResult && <div role="status">{testResult}</div>}
      {webhook && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', color: 'var(--text-2)' }}>
          Signing secret <code style={{ fontFamily: 'var(--font-mono)' }}>{webhook.secret_hint}</code>
          {confirmRotate ? (
            <>
              <span>The old secret stops working at once; their system must switch to the new one.</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={async () => {
                  const data = await run({ action: 'rotate_webhook_secret', brandId }, 'New secret issued.')
                  setConfirmRotate(false)
                  if (data?.secret) setSecret(String(data.secret))
                }}
              >
                Issue new secret
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirmRotate(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-sm" onClick={() => setConfirmRotate(true)}>
              New secret…
            </button>
          )}
        </div>
      )}
    </Section>
  )
}

function Deliveries({ deliveries, run }: { deliveries: DeliveryRow[]; run: Run }) {
  return (
    <Section title="Delivery log" hint="The last 50 updates. Failed ones were retried for 24 hours; staff were emailed.">
      {deliveries.length === 0 ? (
        <p style={{ color: 'var(--text-2)', margin: 0 }}>Nothing sent yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '6px 8px' }}>When</th>
                <th style={{ padding: '6px 8px' }}>Borrower</th>
                <th style={{ padding: '6px 8px' }}>Update</th>
                <th style={{ padding: '6px 8px' }}>Result</th>
                <th style={{ padding: '6px 8px' }} />
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{when(d.created_at)}</td>
                  <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{d.brand_cases?.case_ref ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{d.event}</code>
                    {d.is_test && (
                      <span className="badge" style={{ fontSize: 11, marginLeft: 6 }}>
                        test
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={{ color: DELIVERY_STATUS[d.status].color, fontWeight: 600 }}>{DELIVERY_STATUS[d.status].label}</span>
                    <span style={{ color: 'var(--text-3)' }}>
                      {' '}
                      · {d.attempts} attempt{d.attempts === 1 ? '' : 's'}
                      {d.last_http_status ? ` · HTTP ${d.last_http_status}` : ''}
                    </span>
                    {d.status === 'pending' && d.attempts > 0 && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Next try {when(d.next_attempt_at)}</div>}
                    {d.last_error && d.status !== 'delivered' && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{d.last_error}</div>}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                    {(d.status === 'failed' || d.status === 'skipped') && d.event !== 'ping' && (
                      <button type="button" className="btn btn-sm" onClick={() => run({ action: 'retry_delivery', deliveryId: d.id }, 'Queued again: it goes out on the next run (within 15 minutes).')}>
                        <RotateCcw size={12} aria-hidden="true" style={{ marginRight: 5 }} />
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function Requests({ requests }: { requests: RequestRow[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? requests : requests.slice(0, 10)
  return (
    <Section title="Their recent calls" hint="Every call to the API is logged (the last 50 here).">
      {requests.length === 0 ? (
        <p style={{ color: 'var(--text-2)', margin: 0 }}>No calls yet.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                    <td style={{ padding: '5px 8px' }}>{r.mode && <span className="badge" style={{ fontSize: 11 }}>{r.mode}</span>}</td>
                    <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', fontSize: 12, overflowWrap: 'anywhere' }}>
                      {r.method} {r.path}
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: r.status >= 400 ? 'var(--danger)' : 'var(--text-2)' }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {requests.length > 10 && (
            <button type="button" className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => setAll((v) => !v)}>
              {all ? 'Show fewer' : `Show all ${requests.length}`}
            </button>
          )}
        </>
      )}
    </Section>
  )
}
