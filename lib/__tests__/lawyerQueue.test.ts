import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))

import type { ModelCaller } from '../agentRuntime/types'
import type { ClaudeContentBlock } from '../claude'
import { SqliteMatterRepo } from '../dev/sqliteMatterRepo'
import { getLawyerAlertEmail } from '../property/lawyerAlerts'
import { lawyerReasons, runPropertyOrchestrator, type LawyerAlert } from '../property/orchestrator'
import { CLOSED_REPLY } from '../property/starter'

const text = (t: string): ClaudeContentBlock => ({ type: 'text', text: t })
const use = (name: string, input: Record<string, unknown>): ClaudeContentBlock => ({ type: 'tool_use', id: name, name, input })

function model(...replies: ClaudeContentBlock[][]): ModelCaller {
  let n = 0
  return async () => {
    const content = replies[n++]
    if (!content) throw new Error('Unexpected model call')
    return {
      ok: true,
      text: content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n'),
      content,
      stopReason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 },
      costUsd: 0,
      model: 'test',
    }
  }
}

async function matterIn(area: 'recovery' | 'wills-probate' | 'other-instruments') {
  const repo = new SqliteMatterRepo()
  const caseId = repo.createCase()
  await repo.getOrCreateMatter(caseId)
  await repo.setArea(caseId, area)
  await repo.setState(caseId, 'Oyo')
  const alerts: LawyerAlert[] = []
  const say = (call: ModelCaller, message = 'hello', notify: (a: LawyerAlert) => Promise<void> = async (a) => { alerts.push(a) }) =>
    runPropertyOrchestrator({ caseId, messages: [{ role: 'user', content: message }], now: new Date('2026-10-14T09:00:00Z'), repo, call, notify })
  return { repo, caseId, alerts, say }
}

describe('lawyerReasons', () => {
  it('flags an escalation and a document nothing is paid for online, not a paid one', () => {
    expect(lawyerReasons([
      { kind: 'escalated', payload: { reason: 'Tenant claims ownership.' }, createdAt: '' },
      { kind: 'document_emitted', payload: { title: 'Will', price: 0 }, createdAt: '' },
      { kind: 'document_emitted', payload: { title: 'Notice to Quit', price: 25000 }, createdAt: '' },
      { kind: 'law_lookup', payload: {}, createdAt: '' },
    ])).toEqual(['Escalated: Tenant claims ownership.', 'Document needs the firm (nothing paid online): Will'])
  })
})

describe('the lawyer queue', () => {
  it('an escalation puts the matter in the queue and alerts staff once', async () => {
    const { repo, caseId, alerts, say } = await matterIn('recovery')
    await say(model([use('escalate_to_lawyer', { reason: 'The tenant claims to own the house.' })], [text('A Pandas LP lawyer will take this over.')]))
    expect(alerts).toEqual([{ caseId, area: 'recovery', state: 'Oyo', reason: 'Escalated: The tenant claims to own the house.' }])
    expect(repo.lawyerQueue()).toEqual([{ caseId, reason: 'Escalated: The tenant claims to own the house.', area: 'recovery', status: 'escalated' }])
    // The next turn gets the fixed reply and alerts nobody again.
    await say(model())
    expect(alerts).toHaveLength(1)
  })

  it('a document nothing is paid for online is flagged; a paid one is not', async () => {
    const wills = await matterIn('wills-probate')
    await wills.say(model([text('Here is your will.'), use('emit_document', { documentType: 'will', title: 'Will', body: 'THIS IS THE LAST WILL AND TESTAMENT of me, Ade Bello.' })], [text('Please read it carefully.')]))
    expect(wills.repo.lawyerQueue().map((r) => r.reason)).toEqual(['Document needs the firm (nothing paid online): Will'])
    expect(wills.alerts).toHaveLength(1)

    const gift = await matterIn('other-instruments')
    await gift.say(model([text('Here it is.'), use('emit_document', { documentType: 'deed-of-gift', title: 'Deed of Gift', body: 'THIS DEED OF GIFT is made this ____ day of ________ 20____.' })], [text('Please check it.')]))
    expect(gift.repo.lawyerQueue()).toEqual([])
    expect(gift.alerts).toEqual([])
  })

  it('a plain turn flags nothing', async () => {
    const { repo, alerts, say } = await matterIn('recovery')
    await say(model([text('How is the rent paid?')]))
    expect(repo.lawyerQueue()).toEqual([])
    expect(alerts).toEqual([])
  })

  it("a failed alert never fails the client's turn", async () => {
    const { repo, say } = await matterIn('recovery')
    const result = await say(model([use('escalate_to_lawyer', { reason: 'x' })], [text('A lawyer will take over.')]), 'hi', async () => { throw new Error('SMTP down') })
    expect(result).toMatchObject({ ok: true })
    expect(repo.lawyerQueue()).toHaveLength(1)
  })

  it('a closed matter gets the closed reply', async () => {
    const { repo, caseId, say } = await matterIn('recovery')
    await repo.setStatus(caseId, 'closed')
    expect(await say(model())).toEqual({ ok: true, response: CLOSED_REPLY })
  })
})

describe('the staff alert email', () => {
  it('links to the matter, names the area and escapes what the client wrote', () => {
    const email = getLawyerAlertEmail({ caseId: 'c-1', area: 'land-dispute', state: 'Lagos', reason: 'Escalated: <script>alert(1)</script> demolition now', clientEmail: 'ade@example.com', siteUrl: 'https://pandaslp.com.ng' })
    expect(email.subject).toBe('A property matter needs a lawyer | land title dispute, Lagos')
    expect(email.html).toContain('https://pandaslp.com.ng/admin?caseId=c-1')
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
    expect(email.text).toContain('ade@example.com')
  })

  it('words a document flag differently from an escalation', () => {
    expect(getLawyerAlertEmail({ caseId: 'c', area: 'wills-probate', state: 'Oyo', reason: 'Document needs the firm (nothing paid online): Will', clientEmail: null, siteUrl: 'x' }).subject)
      .toBe('A property document needs the firm | wills and probate, Oyo')
  })
})
