import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anon)

// Attaches the current user's session token so API routes can verify who's calling
// (see app/api/send-email/route.ts, which rejects requests without it). Falls back to
// a plain unauthenticated fetch if there's no session — the route itself decides
// whether that's acceptable for a given request.
export async function authedFetch(input: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) {
    headers.set('authorization', `Bearer ${session.access_token}`)
  }
  return fetch(input, { ...init, headers })
}
