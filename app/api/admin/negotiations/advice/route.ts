export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { NEGOTIATION_ADVICE_PROMPT } from '@/lib/agents'

const RATE_LIMIT = 15
const RATE_WINDOW_MS = 10 * 60 * 1000

type Round = {
  id: string
  party: 'debtor_counsel' | 'pandas_lp'
  counsel_name: string | null
  proposed_amount: number | null
  summary: string
  occurred_at: string
}

function formatRound(r: Round): string {
  const who = r.party === 'debtor_counsel' ? `Debtor's counsel${r.counsel_name ? ` (${r.counsel_name})` : ''}` : 'Pandas LP'
  const amount = r.proposed_amount != null ? ` — figure named ₦${r.proposed_amount.toLocaleString()}` : ''
  return `${who}${amount}:\n${r.summary}`
}

// Step 2 of the reply workflow in components/NegotiationPanel.tsx: once a response from the
// debtor's lawyer is logged, draft a note advising OUR client on it and asking for
// instructions. Returns the draft only; the lawyer edits it, then saves or emails it
// (PATCH /api/admin/negotiations, POST /api/admin/negotiations/advice/send).
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-negotiation-advice:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { negotiationId?: string; notes?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.negotiationId) {
    return Response.json({ error: 'Missing negotiationId.' }, { status: 400 })
  }

  const { data: target, error: targetErr } = await supabaseAdmin
    .from('case_negotiations')
    .select('id, case_id, party')
    .eq('id', body.negotiationId)
    .single()
  if (targetErr || !target) {
    return Response.json({ error: 'Negotiation entry not found.' }, { status: 404 })
  }
  if (target.party !== 'debtor_counsel') {
    return Response.json({ error: 'Advice notes are for responses received from the debtor’s lawyer.' }, { status: 400 })
  }

  const [{ data: caseData }, { data: thread }] = await Promise.all([
    supabaseAdmin.from('cases').select('document_title, document_body, expected_amount').eq('id', target.case_id).single(),
    supabaseAdmin
      .from('case_negotiations')
      .select('id, party, counsel_name, proposed_amount, summary, occurred_at')
      .eq('case_id', target.case_id)
      .order('occurred_at', { ascending: true }),
  ])
  if (!caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 503 })
  }

  const rounds = (thread || []) as Round[]
  const latest = rounds.find((r) => r.id === target.id)
  const earlier = rounds.filter((r) => r.id !== target.id && new Date(r.occurred_at) <= new Date(latest?.occurred_at ?? 0))

  const userMessage = `ORIGINAL CLAIM (${caseData.document_title || 'Letter of Demand'}${caseData.expected_amount ? `, ₦${caseData.expected_amount.toLocaleString()}` : ''}):
${caseData.document_body || '(no drafted demand letter on file)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EARLIER CORRESPONDENCE:
${earlier.length ? earlier.map(formatRound).join('\n\n') : '(none)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LATEST RESPONSE FROM THE DEBTOR'S LAWYER (advise the client on this):
${latest ? formatRound(latest) : '(missing)'}
${body.notes?.trim() ? `\nLAWYER'S NOTES FOR THIS ADVICE: ${body.notes.trim()}` : ''}

Write the advice note now.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: NEGOTIATION_ADVICE_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!res.ok) {
      console.error('Anthropic API error during advice draft:', res.status, await res.text())
      return Response.json({ error: 'The drafting agent is temporarily unavailable. Please try again shortly.' }, { status: 502 })
    }
    const data = await res.json()
    const advice: string = Array.isArray(data?.content)
      ? data.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim()
      : ''
    if (!advice) {
      return Response.json({ error: 'The agent returned an empty note. Please try again.' }, { status: 502 })
    }
    return Response.json({ advice })
  } catch (err) {
    console.error('Advice draft request failed:', err)
    return Response.json({ error: 'Network error while contacting the drafting agent.' }, { status: 500 })
  }
}
