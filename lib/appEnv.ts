// Which environment the app is running in, on any host (AWS, a VPS, a laptop).
//
//   APP_ENV=production | staging | development, set by whoever deploys the app.
//
// If APP_ENV is unset (or mistyped), a production build (`next build` + `next start`) counts as
// production, so a forgotten setting fails SAFE: the production-only protections stay on
// (no unverified test payments, no pretend Google Drive). `next dev` and the tests count as
// development. To run a production build locally with test payments, set APP_ENV=development.

export type AppEnv = 'production' | 'staging' | 'development'

export function appEnv(): AppEnv {
  const explicit = process.env.APP_ENV?.trim().toLowerCase()
  if (explicit === 'production' || explicit === 'staging' || explicit === 'development') return explicit
  return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

/** The real, live site: the one with real clients and real money. */
export function isProduction(): boolean {
  return appEnv() === 'production'
}
