export const runtime = 'nodejs'

import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { extractCounterFacts } from '@/lib/agentChatParsing'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const DOC_TYPES   = ['application/pdf']

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 10 * 60 * 1000
const MAX_FILE_BYTES = 10 * 1024 * 1024

// Staff no longer have to retype what a scanned counter letter already says — attach the file
// (a CamScanner PDF, a phone photo, whatever staff actually have) and this reads it the same
// way app/api/extract/route.ts reads client-uploaded evidence, just pulled into the three
// specific fields NegotiationPanel.tsx's form needs instead of a general facts summary.
// Extraction only — nothing is saved here. Staff review the pre-filled form and can edit
// anything before POSTing to /api/admin/negotiations to actually log the round.
const COUNTER_EXTRACT_PROMPT = `You are reading a letter from a debtor's lawyer, responding on their client's behalf to a Pandas LP demand letter.

Extract exactly these three things and return them in this exact format, nothing before or after it:

<<<COUNTER_EXTRACT>>>
COUNSEL_NAME: [the lawyer's name and firm/chambers, as written in the letter — write "unknown" if the letter does not clearly state one]
PROPOSED_AMOUNT: [the settlement figure they propose, or the amount they say is actually owed, as a plain number with no currency symbol or commas — write "none" if the letter does not name any figure at all]
SUMMARY:
[2-4 plain-English sentences: what they're disputing or admitting, what they're offering, and any deadline or condition they set. Report what the letter says — do not add legal opinion or editorialize.]
<<<END_COUNTER_EXTRACT>>>

"unknown" and "none" are correct, honest answers when the letter genuinely does not provide a name or a figure — never invent one to fill the field.`

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-negotiation-extract:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many uploads — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here') || apiKey.includes('placeholder')) {
    return Response.json({ error: 'Extraction is not configured.' }, { status: 503 })
  }

  let body: { fileBase64?: string; mediaType?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { fileBase64, mediaType } = body
  if (!fileBase64 || !mediaType) {
    return Response.json({ error: 'Missing file data.' }, { status: 400 })
  }

  const approxBytes = (fileBase64.length * 3) / 4
  if (approxBytes > MAX_FILE_BYTES) {
    return Response.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 413 })
  }

  const isImage = IMAGE_TYPES.includes(mediaType)
  const isPdf = DOC_TYPES.includes(mediaType)
  if (!isImage && !isPdf) {
    return Response.json({ error: 'Unsupported file type. Please upload a PDF or image.' }, { status: 400 })
  }

  const fileBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: [fileBlock, { type: 'text', text: COUNTER_EXTRACT_PROMPT }] },
        ],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Anthropic extraction API error:', res.status, data.error?.message)
      return Response.json({ error: 'Extraction failed. Please try again, or fill the fields in by hand.' }, { status: 502 })
    }

    const raw: string = data.content?.[0]?.text ?? ''
    const facts = extractCounterFacts(raw)
    if (!facts) {
      return Response.json({ error: 'Could not make sense of this file. Please fill the fields in by hand.' }, { status: 422 })
    }

    return Response.json(facts)
  } catch {
    return Response.json({ error: 'Network error during extraction.' }, { status: 502 })
  }
}
