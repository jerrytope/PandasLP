// LOCAL TESTING ONLY: runs the test-plan scenarios (scripts/property-scenarios.ts) through the
// rebuilt Property Law Agent, with SQLite and Groq like scripts/property-agent-chat.ts, and
// writes one transcript per scenario to .local/scenarios/ for grading: every message, every
// tool call with its input and result, the documents, and the saved matter and events.
//
//   npm run property:scenarios               all scenarios
//   npm run property:scenarios -- 01 06 18   only these

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(path.resolve(file), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // missing file
  }
}
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://placeholder.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'local-test-placeholder'
if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY is not set (.env.local or .env).')
  process.exit(1)
}

const { SqliteMatterRepo } = await import('../lib/dev/sqliteMatterRepo')
const { createGroqCaller, groqModelFor } = await import('../lib/dev/groqCaller')
const { runPropertyOrchestrator } = await import('../lib/property/orchestrator')
const { SqliteLawLibrary } = await import('../lib/dev/sqliteLawLibrary')
// The law library from the legal team's seed file, if it is in the repo.
const seedPath = path.resolve('docs', 'pandaslp-law-library-seed.sql')
const library = existsSync(seedPath) ? SqliteLawLibrary.fromFile(seedPath) : undefined
if (!library) console.warn('No law library seed at docs/pandaslp-law-library-seed.sql: get_section and lookup_law will say it is unavailable.')
const { PROPERTY_V2_STARTER } = await import('../lib/property/starter')
const { extractDocument, extractOptions } = await import('../lib/agentChatParsing')
const { SCENARIOS } = await import('./property-scenarios')
type ModelCaller = import('../lib/agentRuntime/types').ModelCaller

const NUDGE = 'I have given you everything I have. Please go ahead.'
const outDir = path.resolve('.local', 'scenarios')
mkdirSync(outDir, { recursive: true })

const only = process.argv.slice(2)
const scenarios = only.length ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS
const summary: string[] = [`# Scenario run ${new Date().toISOString()}`, '', `Model ${groqModelFor(undefined)}, router ${groqModelFor('claude-haiku-4-5')}`, '', '| # | Scenario | Turns | Calls | Tokens in/out | Documents | Area / state / status | Errors |', '|---|---|---|---|---|---|---|---|']

for (const scenario of scenarios) {
  const repo = new SqliteMatterRepo(':memory:')
  const caseId = repo.createCase()
  const out: string[] = [`# ${scenario.id}. ${scenario.title}`, '', `**Must include:** ${scenario.mustInclude}`, '']
  let calls = 0
  let tokensIn = 0
  let tokensOut = 0
  const errors: string[] = []
  const documents: string[] = []

  const groq = createGroqCaller({ apiKey: process.env.GROQ_API_KEY!, onCall: (c) => { calls++; tokensIn += c.inputTokens; tokensOut += c.outputTokens } })
  // Records each tool call with its input, and each tool result, into the transcript.
  const call: ModelCaller = async (req) => {
    const last = req.messages[req.messages.length - 1]
    if (last && Array.isArray(last.content)) {
      for (const b of last.content as { type: string; content?: string; is_error?: boolean }[]) {
        if (b.type === 'tool_result') out.push(`> ${b.is_error ? '**tool error**' : 'tool result'}: \`${String(b.content).slice(0, 600)}\``)
      }
    }
    const result = await groq(req)
    if (result.ok === true) {
      for (const b of result.content) {
        if (b.type === 'tool_use') {
          const input = JSON.stringify((b as { input: unknown }).input)
          out.push(`> **${req.route}** calls \`${(b as { name: string }).name}\` ${input.length > 600 ? `${input.slice(0, 600)}…` : input}`)
        }
      }
    }
    return result
  }

  const messages: { role: 'user' | 'assistant'; content: string }[] = [{ role: 'assistant', content: PROPERTY_V2_STARTER }]
  let buttons = extractOptions(PROPERTY_V2_STARTER).options
  const queue = [...scenario.turns]
  let nudges = scenario.nudges ?? 0
  let turns = 0

  console.log(`\n=== ${scenario.id}. ${scenario.title}`)
  while (queue.length || nudges > 0) {
    const matter = await repo.getOrCreateMatter(caseId)
    if (matter.status === 'escalated' && turns > 0) break
    let next = queue.shift()
    if (next === undefined) {
      if (documents.length) break
      nudges--
      next = NUDGE
    }
    let text: string
    if (typeof next === 'string') {
      text = next
    } else {
      const hit = buttons.find((b) => b.toLowerCase().includes(next.press.toLowerCase()))
      if (!hit) {
        // The expected button isn't offered: the agent has asked something else. Answer with the
        // button's words anyway, and keep it in the queue only once.
        out.push(`> _(expected a "${next.press}" button; offered: ${buttons.length ? buttons.join(' | ') : 'none'})_`)
      }
      text = hit ?? next.press
    }
    turns++
    out.push('', `**Client:** ${text}`, '')
    messages.push({ role: 'user', content: text })

    const result = await runPropertyOrchestrator({ caseId, messages, now: new Date('2026-10-14T09:00:00Z'), repo, call, library })
    if (result.ok === false) {
      errors.push(result.error)
      out.push(`**ERROR (${result.status}):** ${result.error}`)
      console.log(`  turn ${turns}: ERROR ${result.error}`)
      break
    }
    const response = result.response.split('{{REF_NUMBER}}').join('PLP/2026/TEST')
    const { visible: withoutDoc, doc } = extractDocument(response)
    const { visible, options } = extractOptions(withoutDoc)
    buttons = options
    messages.push({ role: 'assistant', content: withoutDoc })
    out.push(`**Agent:** ${visible}`)
    if (options.length) out.push('', `Buttons: ${options.map((o) => `[${o}]`).join(' ')}`)
    if (doc) {
      documents.push(`${doc.title} (PRICE ${doc.price ?? '-'})`)
      out.push('', `### DOCUMENT: ${doc.title}`, `PRICE: ${doc.price ?? '(none)'} · PRICE_LABEL: ${doc.priceLabel ?? '(none)'}`, '', '```', doc.body, '```')
    }
    console.log(`  turn ${turns}: ${visible.slice(0, 110).replace(/\n/g, ' ')}${doc ? `  [DOC: ${doc.title}]` : ''}`)
  }

  const matter = await repo.getOrCreateMatter(caseId)
  const events = await repo.events(caseId)
  out.push('', '---', `**Matter:** area=${matter.area} state=${matter.state}${matter.lagosArea ? `/${matter.lagosArea}` : ''} status=${matter.status}`, '', '```json', JSON.stringify(matter.facts, null, 2), '```', '', '**Events:**', ...events.map((e) => `- ${e.kind} ${JSON.stringify(e.payload)}`))
  out.push('', `Calls ${calls}, tokens in ${tokensIn} / out ${tokensOut}`)
  const file = path.join(outDir, `${scenario.id}.md`)
  writeFileSync(file, out.join('\n'))
  summary.push(`| ${scenario.id} | ${scenario.title} | ${turns} | ${calls} | ${tokensIn}/${tokensOut} | ${documents.join('; ') || '-'} | ${matter.area ?? '-'} / ${matter.state ?? '-'} / ${matter.status} | ${errors.join('; ') || '-'} |`)
  writeFileSync(path.join(outDir, 'SUMMARY.md'), summary.join('\n'))
  repo.close()
}

console.log(`\nTranscripts in ${outDir}`)
