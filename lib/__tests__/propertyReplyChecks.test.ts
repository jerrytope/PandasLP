import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))

import type { ModelCaller } from '../agentRuntime/types'
import { extractOptions } from '../agentChatParsing'
import type { ClaudeCallOptions, ClaudeContentBlock } from '../claude'
import { SqliteMatterRepo } from '../dev/sqliteMatterRepo'
import { promisesLawyer, repairMarkers, replyProblem, runPropertyOrchestrator } from '../property/orchestrator'

const text = (t: string): ClaudeContentBlock => ({ type: 'text', text: t })

function model(...replies: ClaudeContentBlock[][]) {
  const calls: ClaudeCallOptions[] = []
  const call: ModelCaller = async (opts) => {
    calls.push(opts)
    const content = replies[calls.length - 1]
    if (!content) throw new Error(`Unexpected model call #${calls.length}`)
    return {
      ok: true,
      text: content.map((b) => (b as { text: string }).text).join('\n'),
      content,
      stopReason: 'end_turn',
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 },
      costUsd: 0,
      model: 'test',
    }
  }
  return { call, calls }
}

/** A matter already in Other instruments, in Lagos. */
async function readyMatter() {
  const repo = new SqliteMatterRepo()
  const caseId = repo.createCase()
  await repo.getOrCreateMatter(caseId)
  await repo.setArea(caseId, 'other-instruments')
  await repo.setState(caseId, 'Lagos', 'elsewhere')
  return { repo, caseId }
}

async function say(repo: SqliteMatterRepo, caseId: string, call: ModelCaller, message: string) {
  const result = await runPropertyOrchestrator({ caseId, messages: [{ role: 'user', content: message }], now: new Date('2026-10-14T09:00:00Z'), repo, call })
  if (result.ok === false) throw new Error(result.error)
  return result.response
}

describe('checks on what the model wrote', () => {
  it('spot a document or a tool call written into the reply', () => {
    expect(replyProblem('Here it is.\n\n**POWER OF ATTORNEY**\n\nBY THIS POWER OF ATTORNEY made this day')).toBe('inline-document')
    expect(replyProblem('We will hand it over.\nhandoff_to({"area":"wills-probate"})')).toBe('tool-as-text')
    expect(replyProblem('The deed must include a consent clause. Shall I draft it?')).toBeNull()
  })

  it('retry once, with a correction, when the model writes a document inline', async () => {
    const { repo, caseId } = await readyMatter()
    const { call, calls } = model(
      [text('Here you go:\n\nBY THIS POWER OF ATTORNEY made this 14 October 2026 I appoint...')],
      [text('Which acts should your brother be able to do: let it, collect rent, sell it?')],
    )
    const reply = await say(repo, caseId, call, 'just draft it')
    expect(calls).toHaveLength(2)
    expect((calls[1].system as { text: string }[])[3].text).toMatch(/CORRECTION/)
    expect(reply).toMatch(/Which acts/)
  })

  it('withhold a document written inline twice', async () => {
    const { repo, caseId } = await readyMatter()
    const inline = [text('IN WITNESS WHEREOF the parties have signed.')]
    expect(await say(repo, caseId, model(inline, inline).call, 'draft it')).not.toMatch(/IN WITNESS WHEREOF/)
  })

  it('escalate for real when the reply promises a lawyer without escalating', async () => {
    const { repo, caseId } = await readyMatter()
    await say(repo, caseId, model([text('That is not permitted. A lawyer will contact you shortly.')]).call, 'make it irrevocable for 5 years')
    expect(await repo.getOrCreateMatter(caseId)).toMatchObject({ status: 'escalated' })
    expect((await repo.events(caseId)).at(-1)).toMatchObject({ kind: 'escalated' })
    expect(promisesLawyer('Would you like a lawyer to review it?')).toBe(false)
  })

  it('escalate when the model twice writes an escalation or hand-off as text (scenario 26)', async () => {
    const { repo, caseId } = await readyMatter()
    const asText = [text('A gift on death needs a will.\nhandoff_to({"area":"wills-probate","reason":"gift on death"})')]
    const { call, calls } = model(asText, [text('That needs a will.\nescalate_to_lawyer({"reason":"wills not live"})')])
    const reply = await say(repo, caseId, call, 'I want my house to go to my son when I die')
    expect(calls).toHaveLength(2)
    expect(reply).toMatch(/A Pandas LP lawyer is now handling this matter/)
    expect(reply).not.toMatch(/handoff_to|escalate_to_lawyer/)
    expect(await repo.getOrCreateMatter(caseId)).toMatchObject({ status: 'escalated' })
  })

  it('repair broken OPTIONS markers so the buttons render', () => {
    const fixed = repairMarkers('Pick one:\n<<<OPTIONS>>>\nYes\nNo\n<<<END_OPTIONS>>')
    expect(extractOptions(fixed)).toEqual({ visible: 'Pick one:', options: ['Yes', 'No'] })
  })
})
