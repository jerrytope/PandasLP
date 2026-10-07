export const runtime = 'nodejs'
// Drafting a letter is an AI call (~20–40s); a run drafts at most a few per brand and stops
// starting new ones after 240s (lib/brandSync.ts). Hosts with a request time limit must allow
// at least 300s for this route; a plain Node server (next start) has none.
export const maxDuration = 300

import { runBrandSync } from '@/lib/brandSync'

// The scheduler calls this every 15 minutes with `Authorization: Bearer $CRON_SECRET` (see
// scripts/run-scheduled-job.mjs for the schedule and how to call it). It only actually syncs
// once the interval set in Admin → Brands has passed (default 60 minutes), so the schedule can
// change without a redeploy.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured.' }, { status: 500 })
  if ((req.headers.get('authorization') ?? '') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const result = await runBrandSync()
    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('Brand sheet sync failed:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Sync failed.' }, { status: 500 })
  }
}
