// Runs lib/agentInstructions.ts against the LOCAL Supabase database (npx supabase start), with
// add-agent-instructions.sql applied. Skips itself when the local database isn't running or
// .env.local isn't pointed at it — it never touches the live database.
//
// Versions can never be deleted (that's the point), so each run uses a new made-up target
// ("zz-test-…") that no agent reads. They stay in the local database.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type * as Module from '../agentInstructions'
import type { InstructionTarget } from '../agentInstructionTargets'

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
  ? await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/agent_instruction_versions?limit=1`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }, signal: AbortSignal.timeout(2000) })
      .then((r) => r.ok)
      .catch(() => false)
  : false

function letters(n: number): string {
  return Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
}

describe.skipIf(!reachable)('drafting instructions against the local database', () => {
  let store: typeof Module
  let db: typeof import('../supabaseAdmin').supabaseAdmin
  // A made-up target: the functions don't check it, the API does.
  const target = `zz-test-${letters(10)}` as InstructionTarget

  beforeAll(async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: env!.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env!.SUPABASE_SERVICE_ROLE_KEY,
    })
    db = (await import('../supabaseAdmin')).supabaseAdmin
    store = await import('../agentInstructions')
  }, 30_000)

  it('keeps a draft until it is published, then removes it', async () => {
    await store.saveDraft(target, 'first draft', null, 'a@test.local')
    await store.saveDraft(target, 'second draft', null, 'a@test.local')
    expect((await store.draftsByTarget()).get(target)).toMatchObject({ body: 'second draft' })

    expect(await store.publish(target, 'Rule one.', 'start', 'a@test.local')).toBe(1)
    expect((await store.draftsByTarget()).has(target)).toBe(false)
  })

  it('adds a version on every publish and keeps the old ones', async () => {
    expect(await store.publish(target, 'Rule two.', 'second', 'b@test.local')).toBe(2)
    const versions = await store.versionsOf(target)
    expect(versions.map((v) => [v.version, v.body, v.createdBy])).toEqual([[2, 'Rule two.', 'b@test.local'], [1, 'Rule one.', 'a@test.local']])
    expect((await store.latestVersions()).get(target)?.version).toBe(2)
  })

  it('gives each of two publishes at the same moment its own number', async () => {
    const numbers = await Promise.all([store.publish(target, 'A', 'a', 'a@test.local'), store.publish(target, 'B', 'b', 'b@test.local')])
    expect(numbers.sort()).toEqual([3, 4])
  })

  it('restores an old version as a new one', async () => {
    const v = await store.restore(target, 1, '', 'a@test.local')
    expect(v).toBe(5)
    const [latest] = await store.versionsOf(target)
    expect(latest).toMatchObject({ version: 5, body: 'Rule one.', restoredFrom: 1, note: 'Restored version 1' })
    await expect(store.restore(target, 99, '', 'a@test.local')).rejects.toThrow(RangeError)
  })

  it('serves the live version to the agents, with an override for the test chat', async () => {
    store.clearInstructionCache()
    expect(await store.instructionsFor(target)).toEqual(['Rule one.'])
    expect(await store.instructionsFor(target, { target, body: 'Draft rule.' })).toEqual(['Draft rule.'])
    expect((await store.allLiveInstructions())[target]).toBe('Rule one.')
  })

  it('never lets a version or a sign-off be changed or deleted', async () => {
    const { error: updateErr } = await db.from('agent_instruction_versions').update({ body: 'tampered' }).eq('target', target)
    expect(updateErr?.message).toMatch(/permanent history/)
    const { error: deleteErr } = await db.from('agent_instruction_versions').delete().eq('target', target)
    expect(deleteErr?.message).toMatch(/permanent history/)
    expect(await store.versionsOf(target)).toHaveLength(5)

    expect(await store.signOff(target, 'Test Lawyer', 'looked fine', 'a@test.local')).toBe(5)
    expect(await store.signOffsOf(target)).toMatchObject([{ signedName: 'Test Lawyer', version: 5 }])
    const { error: signErr } = await db.from('agent_signoffs').delete().eq('target', target)
    expect(signErr?.message).toMatch(/permanent history/)
  })
})
