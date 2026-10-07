#!/usr/bin/env node
// Runs one of the app's scheduled jobs by calling its URL, the way any scheduler would.
// The app doesn't depend on a particular host: whatever runs the schedule (a crontab on an
// AWS server, EventBridge Scheduler, a CI cron) just calls these URLs with the CRON_SECRET.
//
//   node scripts/run-scheduled-job.mjs follow-ups
//   node scripts/run-scheduled-job.mjs brand-sheets
//
// Needs SITE_URL (e.g. https://pandaslp.com.ng, or http://localhost:3000) and CRON_SECRET in
// the environment. Exits non-zero if the job fails, so the scheduler can alert on it.
//
// THE SCHEDULE (Lagos is UTC+1; cron times below are UTC):
//   follow-ups    daily at 07:00 UTC (08:00 Lagos)   cron: 0 7 * * *
//                 Day 7 / Day 14 client follow-ups, and the staff morning digest.
//   brand-sheets  every 15 minutes                   cron: */15 * * * *
//                 The brand sheet sync. It only does work once the interval set in
//                 Admin → Brands has passed (default hourly), so calling it more often is safe.

export const JOBS = {
  'follow-ups': { path: '/api/cron/follow-ups', schedule: '0 7 * * *' },
  'brand-sheets': { path: '/api/cron/brand-sheets', schedule: '*/15 * * * *' },
}

const name = process.argv[2]
const job = JOBS[name]
if (!job) {
  console.error(`Usage: node scripts/run-scheduled-job.mjs <${Object.keys(JOBS).join('|')}>`)
  process.exit(2)
}
const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL
const secret = process.env.CRON_SECRET
if (!siteUrl || !secret) {
  console.error('Set SITE_URL (or NEXT_PUBLIC_SITE_URL) and CRON_SECRET.')
  process.exit(2)
}

const started = Date.now()
try {
  const res = await fetch(new URL(job.path, siteUrl), {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(10 * 60 * 1000),
  })
  const body = await res.text()
  console.log(`${name}: HTTP ${res.status} in ${Math.round((Date.now() - started) / 1000)}s\n${body.slice(0, 4000)}`)
  process.exit(res.ok ? 0 : 1)
} catch (err) {
  console.error(`${name} failed:`, err instanceof Error ? err.message : err)
  process.exit(1)
}
