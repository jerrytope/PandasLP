import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

// Public, unauthenticated, and deliberately aggregate-only: a total, a matter count, and
// nothing else. No case ids, no client names, no per-matter amounts. This is the figure
// published on the homepage, so the shape of the response is the privacy boundary.
//
// Every number here is a SUM over confirmed recoveries in public.recoveries. There is no
// seed value and no floor. If nothing has been confirmed, this returns zero and the homepage
// renders nothing at all, which is the correct behaviour — a trust figure that was ever
// invented is worse than no trust figure.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('recoveries')
    .select('amount_recovered, case_id')

  // Includes the case where the migration has not been run yet: the table is missing, so the
  // total is zero and the homepage section stays hidden rather than the page erroring.
  if (error) {
    console.error('Failed to load recovery total:', error)
    return Response.json(
      { totalRecovered: 0, matterCount: 0 },
      { headers: { 'cache-control': 'public, s-maxage=60' } },
    )
  }

  const rows = data || []
  const totalRecovered = rows.reduce((sum, r) => sum + (r.amount_recovered || 0), 0)
  // One matter can be recovered in instalments, so count distinct cases, not rows.
  const matterCount = new Set(rows.map((r) => r.case_id)).size

  return Response.json(
    { totalRecovered, matterCount },
    // Cached at the edge for five minutes. This changes a few times a week at most, and it
    // sits on the homepage, so it should not cost a database round trip per visitor.
    { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
  )
}
