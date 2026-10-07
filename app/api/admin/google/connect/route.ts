export const runtime = 'nodejs'

import { requireAdmin } from '@/lib/adminAuth'
import { buildGoogleAuthUrl, googleConfigStatus } from '@/lib/google/oauth'
import { signState } from '@/lib/google/tokenCrypto'

// Step 1 of connecting the firm's Google Drive. A POST (not a link) because admin routes are
// authenticated with the Bearer token, which a plain browser navigation can't carry. Returns
// Google's consent URL with a signed, 10-minute `state`; the admin page then navigates to it.
export async function POST(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const config = googleConfigStatus()
  if (!config.configured) {
    return Response.json({ error: `Google isn't configured. Missing: ${config.missing.join(', ')}.` }, { status: 503 })
  }
  return Response.json({ url: buildGoogleAuthUrl(signState(authResult.user.email ?? 'unknown')) })
}
