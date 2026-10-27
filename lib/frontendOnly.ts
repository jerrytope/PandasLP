// `npm run dev:frontend` (scripts/dev-frontend.mjs): the site with no database, for looking at the
// pages. Both Supabase clients then use offlineFetch, which fails every call at once instead of
// letting Supabase retry a dead address for seconds per request. Never on in a production build.

export const FRONTEND_ONLY = process.env.NEXT_PUBLIC_FRONTEND_ONLY === '1' && process.env.NODE_ENV !== 'production'

// 502 because Supabase retries 503 and 520, and this should fail fast.
export async function offlineFetch(): Promise<Response> {
  return new Response(JSON.stringify({ message: 'No database: the site is running with npm run dev:frontend' }), {
    status: 502,
    headers: { 'content-type': 'application/json' },
  })
}
