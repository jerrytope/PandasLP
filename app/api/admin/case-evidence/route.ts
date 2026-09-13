export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 5 * 60 * 1000

// The bucket is private (see supabase-schema.sql) — a signed URL is the only way anyone,
// including staff, ever reads a file back out of it. One hour is generous enough for a
// reviewer to actually open the file, short enough that a copied/leaked link doesn't stay
// live indefinitely.
const SIGNED_URL_TTL_SECONDS = 60 * 60

// Lets staff see and open the actual evidence a client uploaded during the chat — screenshots,
// invoices, PDFs — instead of only Claude's text summary of it (see case_evidence's own
// comment in supabase-schema.sql for why that used to be the only thing that survived).
export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-case-evidence:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const url = new URL(req.url)
  const caseId = url.searchParams.get('caseId')
  if (!caseId) {
    return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('case_evidence')
    .select('id, filename, storage_path, media_type, size_bytes, extracted_facts, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: 'Failed to load evidence.' }, { status: 500 })
  }

  const evidence = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await supabaseAdmin.storage
        .from('case-evidence')
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS)
      return {
        id: row.id,
        filename: row.filename,
        mediaType: row.media_type,
        sizeBytes: row.size_bytes,
        extractedFacts: row.extracted_facts,
        createdAt: row.created_at,
        // null (not omitted) when signing fails, so the client can show "unavailable" for
        // that one file instead of the whole list quietly losing an entry.
        url: signed?.signedUrl ?? null,
      }
    }),
  )

  return Response.json({ evidence })
}
