export const runtime = 'nodejs'

import { isAdminEmail } from '@/lib/adminAuth'
import { exchangeCodeForConnection, saveGoogleConnection } from '@/lib/google/oauth'
import { verifyState } from '@/lib/google/tokenCrypto'

// Step 2: Google redirects the browser here after the owner clicks Allow. There's no Bearer
// token on a redirect, so the signed `state` from /api/admin/google/connect is what proves an
// admin started this (and when — it expires after 10 minutes). Always ends by sending the
// browser back to the Brands screen with the outcome in the URL.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, '')
  const back = (outcome: string, message?: string) => {
    const params = new URLSearchParams({ section: 'brands', google: outcome, ...(message ? { message } : {}) })
    return Response.redirect(`${site}/admin?${params.toString()}`, 302)
  }

  if (url.searchParams.get('error')) return back('cancelled', 'Google sign-in was cancelled.')

  const staffEmail = verifyState(url.searchParams.get('state') ?? '')
  if (!staffEmail || !isAdminEmail(staffEmail)) return back('error', 'That sign-in link has expired or is invalid. Start again from the Brands screen.')

  const code = url.searchParams.get('code')
  if (!code) return back('error', 'Google did not return a sign-in code.')

  try {
    const connection = await exchangeCodeForConnection(code)
    await saveGoogleConnection(connection, staffEmail)
    return back('connected')
  } catch (err) {
    console.error('Google connection failed:', err)
    return back('error', err instanceof Error ? err.message : 'Could not connect Google Drive.')
  }
}
