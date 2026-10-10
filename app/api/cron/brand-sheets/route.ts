export const runtime = 'nodejs'
// Drafting a letter is an AI call (~20–40s); a run drafts at most a few per brand and stops
// starting new ones after 240s (lib/brandSync.ts). Hosts with a request time limit must allow
// at least 300s for this route; a plain Node server (next start) has none.
export const maxDuration = 300

import { runBrandSync } from '@/lib/brandSync'
import { deliverDueWebhooks } from '@/lib/brandWebhooks'
import { advanceTestBorrowers } from '@/lib/brandTestMode'

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

  let syncError: string | null = null
  let result: Awaited<ReturnType<typeof runBrandSync>> | null = null
  try {
    result = await runBrandSync()
  } catch (err) {
    console.error('Brand sheet sync failed:', err)
    syncError = err instanceof Error ? err.message : 'Sync failed.'
  }
  // Test-key borrowers take their next step (lib/brandTestMode.ts): no AI, nothing real.
  let testMode: { advanced: number } | { error: string }
  try {
    testMode = await advanceTestBorrowers()
  } catch (err) {
    console.error('Test-mode step failed:', err)
    testMode = { error: err instanceof Error ? err.message : 'Test-mode step failed.' }
  }
  // Updates to API brands' systems go out on every run (every 15 minutes), whether or not the
  // sync itself was due, and even if it failed: it may have moved borrowers on before failing.
  let webhooks: Awaited<ReturnType<typeof deliverDueWebhooks>> | { error: string }
  try {
    webhooks = await deliverDueWebhooks({ deadline: Date.now() + 50_000 })
  } catch (err) {
    console.error('Webhook delivery failed:', err)
    webhooks = { error: err instanceof Error ? err.message : 'Webhook delivery failed.' }
  }
  if (syncError) return Response.json({ error: syncError, testMode, webhooks }, { status: 500 })
  return Response.json({ ok: true, ...result, testMode, webhooks })
}
