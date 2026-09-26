export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { NEGOTIATION_REPLY_PROMPT } from '@/lib/agents'
import { parseReplyDraft } from '@/lib/replyLetter.js'

const RATE_LIMIT = 15
const RATE_WINDOW_MS = 10 * 60 * 1000

interface NegotiationRound {
  id: string
  party: 'debtor_counsel' | 'pandas_lp'
  counsel_name: string | null
  proposed_amount: number | null
  summary: string
  occurred_at: string
  client_instructions: string | null
}

function formatRound(r: NegotiationRound): string {
  const who = r.party === 'debtor_counsel' ? `Debtor's counsel${r.counsel_name ? ` (${r.counsel_name})` : ''}` : 'Pandas LP'
  const amount = r.proposed_amount != null ? ` — proposed ₦${r.proposed_amount.toLocaleString()}` : ''
  return `${who}${amount}:\n${r.summary}`
}

// Step 4 of the reply workflow in components/NegotiationPanel.tsx: drafts the BODY of a reply
// to opposing counsel, in the house style (NEGOTIATION_HOUSE_STYLE in lib/agents.ts), from the
// case facts, the thread, and the client's recorded instructions. Never saves anything: the
// lawyer edits the draft, adds the date and any deadline dates, previews it on letterhead with
// the stamp, and logs it via POST /api/admin/negotiations.
//
// The letter date is deliberately not passed to the model. Dates are the lawyer's to write.
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

  let body: { caseId?: string; negotiationId?: string; stance?: string; authorizedAmount?: string; instructions?: string }
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

  const { data: threadData, error: threadErr } = await supabaseAdmin
    .from('case_negotiations')
    .select('id, party, counsel_name, proposed_amount, summary, occurred_at, client_instructions')
    .eq('case_id', caseId)
    .order('occurred_at', { ascending: true })
  if (threadErr) {
    return Response.json({ error: 'Failed to load the negotiation thread.' }, { status: 500 })
  }
  const thread = (threadData || []) as NegotiationRound[]
  if (thread.length === 0) {
    return Response.json({ error: 'No response has been logged for this case yet — log what the debtor’s lawyer said first.' }, { status: 409 })
  }

  // The client's recorded instructions on the response being answered are the authority for
  // the reply; anything typed in the draft form is added to them.
  const answering =
    (body.negotiationId ? thread.find((r) => r.id === body.negotiationId) : undefined) ||
    [...thread].reverse().find((r) => r.party === 'debtor_counsel')
  const savedInstructions = answering?.client_instructions?.trim() || ''
  if (!savedInstructions && !stance) {
    return Response.json(
      { error: 'Record the client’s instructions first. The agent will not guess the firm’s settlement position.' },
      { status: 400 },
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 503 })
  }

  const instructionLines = [
    savedInstructions && `Client's instructions (recorded by the lawyer): ${savedInstructions}`,
    stance && `Position to take: ${stance}`,
    body.authorizedAmount && `Authorised figure/range: ₦${body.authorizedAmount}`,
    body.instructions?.trim() && `Lawyer's additional instructions: ${body.instructions.trim()}`,
  ].filter(Boolean)

  const userMessage = `ORIGINAL CLAIM (${caseData.document_title || 'Letter of Demand'}${caseData.expected_amount ? `, ₦${caseData.expected_amount.toLocaleString()}` : ''}):
${caseData.document_body}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEGOTIATION THREAD SO FAR (oldest first):

${thread.map(formatRound).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENT'S INSTRUCTIONS FOR THIS REPLY:
${instructionLines.join('\n')}

Draft the reply now, in the house style and the three-part output format.`

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
        max_tokens: 3000,
        system: NEGOTIATION_REPLY_PROMPT,
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

    const parsed = parseReplyDraft(draft)
    return Response.json({ draft: parsed.body, re: parsed.re, staffNote: parsed.staffNote, answeringId: answering?.id ?? null })
  } catch (err) {
    console.error('Negotiation draft request failed:', err)
    return Response.json({ error: 'Network error while contacting the drafting agent.' }, { status: 500 })
  }
}
