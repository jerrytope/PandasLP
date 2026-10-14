// Runs lib/property/matterStore.ts against the LOCAL Supabase database (npx supabase start), with
// add-property-matters.sql applied. Skips itself when the local database isn't running or
// .env.local isn't pointed at it — it never touches the live database.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type * as StoreModule from '../property/matterStore'

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

describe.skipIf(!reachable)('property matter store against the local database', () => {
  let store: typeof StoreModule
  let db: typeof import('../supabaseAdmin').supabaseAdmin
  let userId: string
  let caseId: string

  beforeAll(async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: env!.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env!.SUPABASE_SERVICE_ROLE_KEY,
    })
    db = (await import('../supabaseAdmin')).supabaseAdmin
    store = await import('../property/matterStore')

    const { data: user, error: userErr } = await db.auth.admin.createUser({ email: `property-${Date.now()}@test.local`, email_confirm: true })
    if (userErr) throw userErr
    userId = user.user.id
    const { data: c, error } = await db.from('cases').insert({ user_id: userId, agent_id: 'recovery-of-premises' }).select('id').single()
    if (error) throw error
    caseId = c.id
  }, 30_000)

  afterAll(async () => {
    if (!db) return
    if (caseId) await db.from('cases').delete().eq('id', caseId)
    if (userId) await db.auth.admin.deleteUser(userId)
  })

  it('creates the matter once, even when asked for twice at the same moment', async () => {
    const [a, b] = await Promise.all([store.getOrCreateMatter(caseId), store.getOrCreateMatter(caseId)])
    expect(a).toEqual({ caseId, state: null, lagosArea: null, area: null, facts: {}, status: 'routing' })
    expect(b).toEqual(a)
  })

  it('saves the state, area and status', async () => {
    await store.setState(caseId, 'Lagos', 'Ikoyi')
    await store.setArea(caseId, 'recovery')
    expect(await store.getOrCreateMatter(caseId)).toMatchObject({ state: 'Lagos', lagosArea: 'Ikoyi', area: 'recovery', status: 'active' })
    await expect(store.setArea(caseId, 'probate' as never)).rejects.toThrow()
  })

  it('merges facts without losing any, even when two merges overlap', async () => {
    await Promise.all([store.mergeFacts(caseId, { landlordName: 'Mrs Okafor' }), store.mergeFacts(caseId, { rent: 1_200_000 })])
    expect(await store.mergeFacts(caseId, { rent: 1_500_000 })).toEqual({ landlordName: 'Mrs Okafor', rent: 1_500_000 })
  })

  it('logs events and reads them back in order', async () => {
    await store.logEvent(caseId, 'routed', { area: 'recovery' })
    await store.logEvent(caseId, 'fee_accepted', { documentType: 'deed-of-assignment', consideration: 1000, fee: 25 })
    expect((await store.events(caseId)).map((e) => e.kind)).toEqual(['routed', 'fee_accepted'])
    expect(await store.events(caseId, 'fee_accepted')).toMatchObject([{ payload: { fee: 25 } }])
    await expect(store.logEvent(caseId, 'nonsense' as never)).rejects.toThrow()
  })
})
