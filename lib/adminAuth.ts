import { supabaseAdmin } from './supabaseAdmin'
import type { User } from '@supabase/supabase-js'

// Staff allowlist, not a roles table — deliberately simple for a small team. Add more
// addresses by updating ADMIN_EMAILS (comma-separated) in the environment — a change to
// this env var needs a redeploy to take effect, Vercel doesn't apply it retroactively to
// an already-running deployment. Server-side only; never trust a client-reported "is
// admin" flag for anything. Reads ADMIN_EMAILS or ADMIN_EMAIL (singular) — the project's
// Vercel env var ended up named the singular form, so both are accepted rather than
// requiring an exact name match that's easy to get wrong when setting this up by hand.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? ''
  const allowlist = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}

// Shared Bearer-token + admin-allowlist check for every /api/admin/* route. Returns the
// caller's user object on success, or a Response to return immediately on failure —
// callers do `const result = await requireAdmin(req); if (result instanceof Response) return result`.
export async function requireAdmin(req: Request): Promise<{ user: User } | Response> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return Response.json({ error: 'Missing Authorization header.' }, { status: 401 })
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    return Response.json({ error: 'Invalid or expired session.' }, { status: 401 })
  }
  if (!isAdminEmail(data.user.email)) {
    return Response.json({ error: 'Forbidden.' }, { status: 403 })
  }
  return { user: data.user }
}
