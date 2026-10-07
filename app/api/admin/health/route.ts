export const runtime = 'nodejs'

import { appEnv, isProduction } from '@/lib/appEnv'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { getGoogleConnectionStatus, googleConfigStatus } from '@/lib/google/oauth'

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 5 * 60 * 1000

function isPlaceholder(value: string | undefined): boolean {
  return !value || value.includes('placeholder')
}

// Presence/placeholder checks only — never returns the actual secret values.
// This exists because "go check Vercel" was a real gap: nobody in this project
// has a fast way to confirm production config without digging through the
// dashboard by hand. See council report SHA bbaa023d.
export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-health:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const paystackConfigured = !isPlaceholder(process.env.PAYSTACK_SECRET_KEY) && !isPlaceholder(process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY)
  const googleConfig = googleConfigStatus()
  const googleConn = googleConfig.configured ? await getGoogleConnectionStatus() : null

  const checks = [
    {
      key: 'analytics',
      label: 'Google Analytics (GA4)',
      ok: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
      detail: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
        ? 'Measurement ID is set — GA4 script renders and trackEvent() calls fire.'
        : 'Unset — GA4 script does not render at all; every trackEvent() call is a silent no-op.',
    },
    {
      key: 'paystack',
      label: 'Paystack (live payments)',
      ok: paystackConfigured,
      detail: paystackConfigured
        ? 'Real keys detected — checkout uses live Paystack, verified server-side.'
        : 'Placeholder or missing key — checkout is running in stub mode. Real money is not moving.',
    },
    {
      key: 'supabase',
      label: 'Supabase service role',
      ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      detail: process.env.SUPABASE_SERVICE_ROLE_KEY
        ? 'Service role key present.'
        : 'Missing — every admin/server route using supabaseAdmin will fail outright (you would not be reading this if this were false).',
    },
    {
      key: 'anthropic',
      label: 'Anthropic API (chat agents)',
      ok: Boolean(process.env.ANTHROPIC_API_KEY),
      detail: process.env.ANTHROPIC_API_KEY ? 'Key present.' : 'Missing — the 6 AI agents cannot respond at all.',
    },
    {
      key: 'gmail',
      label: 'Gmail SMTP (case emails)',
      ok: Boolean(process.env.GMAIL_APP_PASSWORD),
      detail: process.env.GMAIL_APP_PASSWORD ? 'App password present.' : 'Missing — Day 0/7/14 follow-up emails and confirmations will fail to send.',
    },
    {
      key: 'cron',
      label: 'Cron secret (Day 7/14 follow-ups)',
      ok: Boolean(process.env.CRON_SECRET),
      detail: process.env.CRON_SECRET ? 'Set.' : 'Missing — Vercel Cron cannot authenticate to /api/cron/follow-ups; escalating follow-ups silently stop.',
    },
    {
      key: 'admin_emails',
      label: 'Admin allowlist',
      ok: Boolean(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL),
      detail: process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL ? 'Set.' : 'Missing — this endpoint would 403 for everyone, including you.',
    },
    {
      key: 'calendly',
      label: 'Calendly (lawyer consultation)',
      ok: Boolean(process.env.NEXT_PUBLIC_CALENDLY_URL),
      detail: process.env.NEXT_PUBLIC_CALENDLY_URL ? 'Set.' : 'Unset — lawyer-consultation booking shows a stub message instead of a real calendar.',
    },
    {
      key: 'plugin',
      label: 'ChatGPT plugin key',
      ok: Boolean(process.env.PLUGIN_API_KEY),
      detail: process.env.PLUGIN_API_KEY ? 'Set.' : 'Unset — /api/plugin/intake 503s; the ChatGPT Actions integration is dark.',
    },
    {
      key: 'google_drive',
      label: 'Google Drive (brand sheets)',
      ok: Boolean(googleConn?.connected && !googleConn.lastError),
      detail: !googleConfig.configured
        ? `Not set up — brands can't get sheets. Missing: ${googleConfig.missing.join(', ')}.`
        : !googleConn?.connected
          ? 'Env vars set, but no Google account connected yet — Admin → Brands → Connect Google Drive.'
          : googleConn.lastError
            ? `Connected as ${googleConn.accountEmail}, but the last call failed: ${googleConn.lastError}`
            : `Connected as ${googleConn.accountEmail}.`,
    },
    {
      key: 'allow_stub_payments',
      label: 'ALLOW_STUB_PAYMENTS (should be unset in production)',
      ok: !isProduction() || process.env.ALLOW_STUB_PAYMENTS !== 'true',
      detail:
        isProduction() && process.env.ALLOW_STUB_PAYMENTS === 'true'
          ? 'DANGER: set to true in production — /api/verify-payment is trusting client-reported amounts instead of checking with Paystack.'
          : 'Not active in production — normal.',
    },
  ]

  return Response.json({
    env: appEnv(),
    checked_at: new Date().toISOString(),
    all_ok: checks.every((c) => c.ok),
    checks,
  })
}
