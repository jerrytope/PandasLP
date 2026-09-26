import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { callClaude } from '@/lib/claude'

export const runtime = 'nodejs'


const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const DOC_TYPES   = ['application/pdf']

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 10 * 60 * 1000
const MAX_FILE_BYTES = 10 * 1024 * 1024

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`extract:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many uploads — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return Response.json({ error: 'Missing Authorization header.' }, { status: 401 })
  }
  const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token)
  if (callerErr || !callerData?.user) {
    return Response.json({ error: 'Invalid or expired session.' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('placeholder')) {
    return Response.json({ error: 'API not configured.' }, { status: 503 })
  }

  let body: { fileBase64: string; mediaType: string; filename: string; caseId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { fileBase64, mediaType, filename, caseId } = body
  if (!fileBase64 || !mediaType || !filename) {
    return Response.json({ error: 'Missing file data.' }, { status: 400 })
  }
  if (typeof filename !== 'string' || filename.length > 255) {
    return Response.json({ error: 'Invalid filename.' }, { status: 400 })
  }

  // Optional — AgentChat.tsx calls ensureCase() before uploading and passes the result, but a
  // case can genuinely not exist yet (ensureCase needs userId, which this same auth check just
  // established, so in practice this is only ever missing if the client-side insert itself
  // failed). Ownership is checked the same way every other case-scoped route checks it — a
  // caller can only attach evidence to their OWN case, never someone else's by guessing an id.
  let ownedCaseId: string | null = null
  if (caseId) {
    const { data: caseRow } = await supabaseAdmin.from('cases').select('user_id').eq('id', caseId).single()
    if (caseRow?.user_id === callerData.user.id) ownedCaseId = caseId
  }

  // Base64 inflates size by ~4/3 — this is only an estimate, but it's enough to reject the
  // pathological "send something huge directly to the API" case the client-side check
  // (AgentChat.tsx) can't enforce on its own.
  const approxBytes = (fileBase64.length * 3) / 4
  if (approxBytes > MAX_FILE_BYTES) {
    return Response.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 413 })
  }

  const isImage = IMAGE_TYPES.includes(mediaType)
  const isPdf   = DOC_TYPES.includes(mediaType)

  if (!isImage && !isPdf) {
    return Response.json({ error: 'Unsupported file type. Please upload a PDF or image.' }, { status: 400 })
  }

  // Build the content block for Claude
  const fileBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: fileBase64 } }

  const extractPrompt = `You are a Nigerian legal assistant reviewing an uploaded document.

Extract ALL relevant facts that would help with a legal matter in Nigeria. Look for:
- Names of all parties (full names, company names, addresses)
- Amounts of money owed (in Naira or any currency)
- Dates (invoice date, due date, contract date, transaction dates)
- What goods or services were involved
- What the dispute or debt is about
- Any deadlines or payment terms
- Any prior communications, promises, or agreements mentioned
- Relevant reference numbers (invoice numbers, contract numbers, case numbers)
- Bank details if present
- Contact information

Return a concise, factual summary in plain English. Do NOT add legal opinions. Just extract the facts. Format as clear bullet points.

If this document is not relevant to a legal matter (e.g., it's a random image), say "No relevant legal facts found."

Document filename: ${filename}`

  try {
    // One-off per upload, so uncached (see lib/claude.ts). PDF input is generally available,
    // so the old pdfs beta header is no longer needed.
    const result = await callClaude({
      route: 'evidence.extract',
      system: '',
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: extractPrompt }] }],
      maxTokens: 1024,
      caseId: ownedCaseId,
    })
    if (!result.ok) {
      return Response.json({ error: 'Extraction failed. Please try again.' }, { status: 502 })
    }

    const facts: string = result.text || 'No facts extracted.'

    // Persist the actual file, not just Claude's summary of it — see case_evidence's own
    // comment in supabase-schema.sql for why this exists at all. Best-effort and after the
    // extraction has already succeeded: a client is mid-interview waiting on `facts` to keep
    // the conversation moving, and a storage hiccup here must never be the reason that stalls
    // or errors for them. If ownedCaseId is null (no case yet, or ownership didn't check out)
    // this simply doesn't persist — the extraction result still returns normally either way.
    if (ownedCaseId) {
      try {
        const buffer = Buffer.from(fileBase64, 'base64')
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${ownedCaseId}/${Date.now()}-${safeName}`
        const { error: uploadErr } = await supabaseAdmin.storage
          .from('case-evidence')
          .upload(storagePath, buffer, { contentType: mediaType, upsert: false })
        if (uploadErr) {
          console.error('Failed to store evidence file:', uploadErr)
        } else {
          const { error: insertErr } = await supabaseAdmin.from('case_evidence').insert({
            case_id: ownedCaseId,
            filename,
            storage_path: storagePath,
            media_type: mediaType,
            size_bytes: buffer.length,
            extracted_facts: facts,
          })
          if (insertErr) console.error('Failed to record evidence row:', insertErr)
        }
      } catch (err) {
        console.error('Unexpected error persisting evidence:', err)
      }
    }

    return Response.json({ facts, filename })
  } catch {
    return Response.json({ error: 'Network error during extraction.' }, { status: 502 })
  }
}
