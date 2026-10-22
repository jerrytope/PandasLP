export const runtime = 'nodejs'

import { getSiteContent } from '@/lib/siteContent'
import { publicSiteContent } from '@/lib/siteContentSchema'

// The public site's editable content, for client components. Only what may be shown: photos
// (a slot with no photo comes back with url null, and the page draws its placeholder panel),
// and numbers, quotes, the founder's note and the announcement only when staff switched them on.
export async function GET() {
  return Response.json(publicSiteContent(await getSiteContent()), {
    headers: { 'cache-control': 'public, max-age=30, stale-while-revalidate=300' },
  })
}
