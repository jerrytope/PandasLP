// Runs before every test file. lib/supabaseAdmin.ts calls createClient() at module import
// time, so any test that transitively imports it (e.g. lib/adminAuth.ts) throws before a
// single test runs unless these are set. Real values come from .env.local in dev, but that
// file is gitignored (see .gitignore) and Next's own env loader deliberately skips it when
// NODE_ENV=test — so tests can't depend on it existing. These are dummy, syntactically-valid
// placeholders only: none of the current tests make a real Supabase network call, they only
// need createClient() to construct without throwing. Only filled in when unset, so a real
// .env.test.local (if one is ever added) still takes precedence.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://placeholder.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
