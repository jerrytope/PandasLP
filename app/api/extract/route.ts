export const runtime = 'nodejs'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const DOC_TYPES   = ['application/pdf']

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('placeholder')) {
    return Response.json({ error: 'API not configured.' }, { status: 503 })
  }

  let body: { fileBase64: string; mediaType: string; filename: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { fileBase64, mediaType, filename } = body
  if (!fileBase64 || !mediaType || !filename) {
    return Response.json({ error: 'Missing file data.' }, { status: 400 })
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

  const anthropicBody = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          fileBlock,
          { type: 'text', text: extractPrompt },
        ],
      },
    ],
  }

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify(anthropicBody),
    })

    const data = await res.json()
    if (!res.ok) {
      return Response.json({ error: data.error?.message || 'Extraction failed.' }, { status: 502 })
    }

    const facts: string = data.content?.[0]?.text ?? 'No facts extracted.'
    return Response.json({ facts, filename })
  } catch {
    return Response.json({ error: 'Network error during extraction.' }, { status: 502 })
  }
}
