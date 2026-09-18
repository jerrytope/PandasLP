export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { NEGOTIATION_REPLY_PROMPT } from '@/lib/agents'
import { buildCurrentDateContext } from '@/lib/currentDateContext'

const RATE_LIMIT = 15
const RATE_WINDOW_MS = 10 * 60 * 1000

interface NegotiationRound {
  party: 'debtor_counsel' | 'pandas_lp'
  counsel_name: string | null
  proposed_amount: number | null
  summary: string
  occurred_at: string
}

function formatRound(r: NegotiationRound): string {
  const who = r.party === 'debtor_counsel' ? `Debtor's counsel${r.counsel_name ? ` (${r.counsel_name})` : ''}` : 'Pandas LP'
  const amount = r.proposed_amount != null ? ` — proposed ₦${r.proposed_amount.toLocaleString()}` : ''
  const date = new Date(r.occurred_at).toISOString().slice(0, 10)
  return `[${date}] ${who}${amount}:\n${r.summary}`
}

// Drafts a reply to opposing counsel from the case's own facts and the negotiation thread so
// far — never saves anything itself. Staff review, edit, and explicitly log the result via
// POST /api/admin/negotiations (party: 'pandas_lp', aiDrafted: true) — same "AI drafts, a
// human commits it" shape as every other document this app produces, just for correspondence
// instead of a client-facing instrument this time.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-negotiation-draft:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { caseId?: string; stance?: string; authorizedAmount?: string; instructions?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { caseId } = body
  const stance = (body.stance || '').trim()
  if (!caseId) {
    return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  }
  if (!stance) {
    return Response.json(
      { error: 'Say how to respond first — accept, reject, or counter, and at what figure or range if any. The prompt refuses to guess a settlement position on its own.' },
      { status: 400 },
    )
  }

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('id, document_title, document_body, expected_amount')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }
  if (!caseData.document_body) {
    return Response.json({ error: 'This case has no drafted demand letter yet to negotiate from.' }, { status: 409 })
  }

  const { data: thread, error: threadErr } = await supabaseAdmin
    .from('case_negotiations')
    .select('party, counsel_name, proposed_amount, summary, occurred_at')
    .eq('case_id', caseId)
    .order('occurred_at', { ascending: true })
  if (threadErr) {
    return Response.json({ error: 'Failed to load the negotiation thread.' }, { status: 500 })
  }
  if (!thread || thread.length === 0) {
    return Response.json({ error: 'No counter has been logged for this case yet — log what the debtor’s counsel said first.' }, { status: 409 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 503 })
  }

  const threadText = thread.map(formatRound).join('\n\n')
  const userMessage = `ORIGINAL CLAIM (${caseData.document_title || 'Letter of Demand'}${caseData.expected_amount ? `, ₦${caseData.expected_amount.toLocaleString()}` : ''}):
${caseData.document_body}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEGOTIATION THREAD SO FAR:

${threadText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STAFF INSTRUCTION FOR THIS REPLY: ${stance}${body.authorizedAmount ? `\nAuthorized figure/range: ₦${body.authorizedAmount}` : ''}${body.instructions ? `\nAdditional instructions: ${body.instructions.trim()}` : ''}

Draft the reply now.`

  try {
    const currentDateContext = buildCurrentDateContext(new Date())
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: `${NEGOTIATION_REPLY_PROMPT}\n\n${currentDateContext}`,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      console.error('Anthropic API error during negotiation draft:', anthropicRes.status, errBody)
      return Response.json({ error: 'The drafting agent is temporarily unavailable. Please try again shortly.' }, { status: 502 })
    }

    const data = await anthropicRes.json()
    const draft: string = Array.isArray(data?.content)
      ? data.content
          .filter((block: { type: string }) => block.type === 'text')
          .map((block: { text: string }) => block.text)
          .join('\n')
      : ''

    if (!draft.trim()) {
      return Response.json({ error: 'The agent returned an empty draft. Please try again.' }, { status: 502 })
    }

    return Response.json({ draft })
  } catch (err) {
    console.error('Negotiation draft request failed:', err)
    return Response.json({ error: 'Network error while contacting the drafting agent.' }, { status: 500 })
  }
}
