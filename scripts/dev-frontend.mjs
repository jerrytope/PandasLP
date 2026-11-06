// npm run dev:frontend: the site without a backend, for looking at the pages.
//
// The server code creates its Supabase client as soon as a page loads (lib/supabaseAdmin.ts),
// and that throws when no Supabase URL is set. This fills in harmless placeholders for whatever
// isn't already set (.env.local and real environment variables still win) and, when there is no
// real Supabase URL, turns on NEXT_PUBLIC_FRONTEND_ONLY (lib/frontendOnly.ts) so every database
// call fails at once and the pages fall back to their defaults (lib/siteContent.ts). Public pages
// render; sign-in, chat, payments and the admin need the real keys.

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const PLACEHOLDERS = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'frontend-only',
  SUPABASE_SERVICE_ROLE_KEY: 'frontend-only',
}

// Next loads .env files itself, after this script starts it, so read them here to know which
// keys are really set and leave those alone.
function keysInEnvFiles() {
  const keys = new Set()
  for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(\S.*)?$/.exec(line)
      if (m && m[2]) keys.add(m[1])
    }
  }
  return keys
}

const set = keysInEnvFiles()
const env = { ...process.env }
for (const [key, value] of Object.entries(PLACEHOLDERS)) {
  if (!env[key] && !set.has(key)) env[key] = value
}
if (env.NEXT_PUBLIC_SUPABASE_URL === PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_URL) env.NEXT_PUBLIC_FRONTEND_ONLY = '1'

const port = process.argv[2] ?? '3000'
console.log(`Frontend only: http://localhost:${port} (no database; sign-in, chat and payments won't work)`)
const child = spawn('npx', ['next', 'dev', '-p', port], { env, stdio: 'inherit', shell: true })
child.on('exit', (code) => process.exit(code ?? 0))
