// LOCAL TESTING ONLY: talk to the rebuilt Property Law Agent in the terminal.
// The orchestrator (lib/property/orchestrator.ts) runs exactly as /api/chat runs it, but with
// the matter saved in SQLite (lib/dev/sqliteMatterRepo.ts) and the AI calls sent to Groq
// (lib/dev/groqCaller.ts). No Supabase, no Anthropic key, no login.
//
//   npm run property:chat                  resume the last test chat (or start one)
//   npm run property:chat -- --new         start a new matter
//   npm run property:chat -- --case <id>   resume a particular matter
//   npm run property:chat -- --memory      throwaway in-memory database
//   npm run property:chat -- --quiet       hide the per-call log
//
// Needs GROQ_API_KEY in .env.local (optional: GROQ_MODEL, GROQ_ROUTER_MODEL).
// Type a number to press a button. Commands: /matter /events /doc /new /quit
//
// Lines can be piped in too, for a scripted run:  cat scenario.txt | npm run property:chat -- --new --memory

import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

// ----- Environment: .env.local and .env, plus placeholders so lib/supabaseAdmin.ts can be imported -----

function loadEnvFiles() {
  for (const file of ['.env.local', '.env']) {
    try {
      const text = readFileSync(path.resolve(file), 'utf8')
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    } catch {
      // file missing: GROQ_API_KEY may be in the other one, or come from the shell
    }
  }
}
loadEnvFiles()
// lib/claude.ts imports lib/supabaseAdmin.ts, which builds a client at import time. Nothing here
// calls Supabase; these only let it construct.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://placeholder.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'local-test-placeholder'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const option = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const apiKey = process.env.GROQ_API_KEY
if (!apiKey) {
  console.error('GROQ_API_KEY is not set. Add it to .env.local or .env (get one at https://console.groq.com/keys).')
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

const dbPath = flag('--memory') ? ':memory:' : path.resolve('.local', 'property-agent.sqlite')
if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), { recursive: true })
const repo = new SqliteMatterRepo(dbPath)
const quiet = flag('--quiet')
const call = createGroqCaller({
  apiKey,
  onCall: (c) => {
    if (!quiet) console.log(dim(`  [${c.route}] ${c.model} ${c.ms}ms in=${c.inputTokens} out=${c.outputTokens}${c.toolCalls.length ? ` tools=${c.toolCalls.join(',')}` : ''}`))
  },
})

function dim(s: string) {
  return process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s
}
function bold(s: string) {
  return process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s
}

// ----- The matter -----

function startCase(): string {
  const id = repo.createCase()
  repo.addMessage(id, 'assistant', PROPERTY_V2_STARTER)
  return id
}

let caseId: string
const wanted = option('--case')
if (wanted) {
  if (!repo.caseExists(wanted)) {
    console.error(`No test matter ${wanted} in ${dbPath}.`)
    process.exit(1)
  }
  caseId = wanted
} else {
  caseId = (!flag('--new') && repo.latestCase()) || startCase()
}

let buttons: string[] = []
let lastDocument: ReturnType<typeof extractDocument>['doc'] = null

/** Shows an assistant message the way AgentChat would: text, then buttons, then the document panel. */
function show(content: string) {
  const { visible: withoutDoc, doc } = extractDocument(content)
  const { visible, options } = extractOptions(withoutDoc)
  console.log(`\n${bold('Agent:')} ${visible}`)
  buttons = options
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`))
  if (doc) {
    lastDocument = doc
    const price = doc.price === 0 ? 'nothing paid online' : doc.price !== undefined ? `₦${doc.price.toLocaleString('en-NG')}` : 'no price'
    console.log(`\n  ${bold(`[DOCUMENT] ${doc.title}`)} — ${price}${doc.priceLabel ? ` (${doc.priceLabel})` : ''}`)
    console.log(dim('  /doc to print it'))
  }
}

async function showMatter() {
  const m = await repo.getOrCreateMatter(caseId)
  console.log(dim(`  matter ${caseId}: area=${m.area ?? '-'} state=${m.state ?? '-'}${m.lagosArea ? `/${m.lagosArea}` : ''} status=${m.status}`))
  console.log(dim(`  facts ${JSON.stringify(m.facts)}`))
}

console.log(dim(`Property Law Agent (local test) — database ${dbPath === ':memory:' ? 'in memory' : dbPath}, model ${groqModelFor(undefined)}, router ${groqModelFor('claude-haiku-4-5')}`))
console.log(dim(`Matter ${caseId}. Type a number to press a button; /matter /events /doc /new /quit`))
const history = repo.messages(caseId)
for (const m of history) {
  if (m.role === 'assistant') show(m.content)
  else console.log(`\n${bold('You:')} ${m.content}`)
}

// ----- The loop -----

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
const prompt = () => process.stdin.isTTY && rl.prompt()
rl.setPrompt('\nYou: ')
prompt()

for await (const raw of rl) {
  const line = raw.trim()
  if (!line) { prompt(); continue }
  if (!process.stdin.isTTY) console.log(`\n${bold('You:')} ${line}`)

  if (line === '/quit' || line === '/exit') break
  if (line === '/matter') { await showMatter(); prompt(); continue }
  if (line === '/events') {
    for (const e of await repo.events(caseId)) console.log(dim(`  ${e.createdAt} ${e.kind} ${JSON.stringify(e.payload)}`))
    prompt(); continue
  }
  if (line === '/doc') { console.log(lastDocument ? `\n${lastDocument.body}\n` : dim('  No document yet.')); prompt(); continue }
  if (line === '/new') {
    caseId = startCase()
    console.log(dim(`  New matter ${caseId}`))
    show(PROPERTY_V2_STARTER)
    prompt(); continue
  }

  // A number presses the matching button, as clicking one does in the app.
  const n = Number(line)
  const text = Number.isInteger(n) && n >= 1 && n <= buttons.length ? buttons[n - 1] : line
  if (text !== line) console.log(dim(`  → ${text}`))

  const messages = [...repo.messages(caseId), { role: 'user' as const, content: text }]
  const result = await runPropertyOrchestrator({ caseId, messages, now: new Date(), repo, call, library })
  if (result.ok === false) {
    console.log(`\n  ERROR (${result.status}): ${result.error}`)
    prompt(); continue
  }

  // Saved the way AgentChat saves it: the document block is kept apart, {{REF_NUMBER}} filled in.
  const response = result.response.split('{{REF_NUMBER}}').join(`PLP/${new Date().getFullYear()}/TEST`)
  repo.addMessage(caseId, 'user', text)
  repo.addMessage(caseId, 'assistant', extractDocument(response).visible)
  show(response)
  if (!quiet) await showMatter()
  prompt()
}

rl.close()
repo.close()
