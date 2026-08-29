import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

// Public, unauthenticated by design — this is the homepage's interactive contract-risk demo,
// meant to be tried before anyone signs up. That's real exposure to a paid API with no login
// wall, so the rate limit here is intentionally tighter than the authenticated /api/chat.
export const runtime = 'edge'

const RATE_LIMIT = 6
const RATE_WINDOW_MS = 15 * 60 * 1000
const MAX_CONTRACT_CHARS = 6000

const SYSTEM_PROMPT = `You are a contract risk-flagging assistant for Pandas LP, a Nigerian law firm. You are shown pasted contract or clause text from a member of the public trying a free demo — not a paying client, and this is not the firm's actual document-drafting service.

Your only job: read the pasted text and flag clauses that are risky, one-sided, unusual, or missing standard protections under Nigerian contract law practice.

Respond with ONLY a single JSON object, no markdown fences, no commentary outside the JSON, in exactly this shape:
{
  "clauses": [
    { "text": "<a short exact quote from the input, at most ~200 characters>", "risk": "red" | "yellow", "reason": "<one plain-English sentence explaining the risk>" }
  ],
  "summary": "<2-3 sentence overall read of the contract>"
}

Rules:
- Every "text" value must be an exact substring copied from the input — never paraphrase or invent clause text that isn't actually there.
- "red" = a clause that could cause real financial or legal harm if left as-is (e.g. unlimited liability, one-sided indemnity, no termination right, unfair penalty). "yellow" = worth a second look but not alarming (e.g. vague deadline, undefined term, missing notice period).
- If the pasted text isn't actually a contract or clause, return an empty "clauses" array and say so plainly in "summary".
- Never fabricate a specific statute section or case citation. General principles only.
- Keep the whole response tight — at most 8 flagged clauses, prioritising the most material ones.`

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`contract-redline:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a few minutes before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('placeholder') || apiKey.includes('your_anthropic_api_key_here')) {
    return Response.json({ error: 'This demo is not configured yet.' }, { status: 503 })
  }

  let body: { contractText?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const contractText = (body.contractText ?? '').trim()
  if (!contractText) {
    return Response.json({ error: 'Paste some contract text first.' }, { status: 400 })
  }
  if (contractText.length > MAX_CONTRACT_CHARS) {
    return Response.json({ error: `Please paste ${MAX_CONTRACT_CHARS.toLocaleString()} characters or fewer for this demo.` }, { status: 413 })
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contractText }],
      }),
    })

    if (!anthropicRes.ok) {
      console.error('Contract redline API error:', anthropicRes.status, await anthropicRes.text())
      return Response.json({ error: 'The analyzer is temporarily unavailable. Please try again shortly.' }, { status: 502 })
    }

    const data = await anthropicRes.json()
    const raw: string = Array.isArray(data?.content)
      ? data.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n')
      : ''

    // Strip a markdown fence if the model wrapped the JSON in one despite instructions not to.
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')

    let parsed: { clauses?: Array<{ text: string; risk: string; reason: string }>; summary?: string }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Contract redline: failed to parse model output as JSON:', raw)
      return Response.json({ error: 'Could not analyze that text. Please try again.' }, { status: 502 })
    }

    const clauses = Array.isArray(parsed.clauses)
      ? parsed.clauses
          .filter((c) => c && typeof c.text === 'string' && (c.risk === 'red' || c.risk === 'yellow'))
          .slice(0, 8)
      : []

    return Response.json({ clauses, summary: parsed.summary ?? '' })
  } catch (err) {
    console.error('Contract redline route error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
