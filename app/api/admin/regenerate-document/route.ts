export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { getAgent, type AgentId } from '@/lib/agents'
import { getAgentPayment } from '@/lib/agentServiceMap'
import { capHistory, type ChatMessage } from '@/lib/chatHistory'
import { extractDocument } from '@/lib/agentChatParsing'

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 5 * 60 * 1000

// Recovery path for cases whose document never persisted (see the `cases` table missing
// client_phone/expected_amount/reviewed_at/reviewed_by/reviewed_document_sent_at columns —
// every document save silently failed until that schema drift was fixed). The interview
// itself DID save correctly to `messages` (that insert never touched the missing columns),
// so the letter can be regenerated from the saved conversation without the client redoing
// anything: replay their messages back through the same agent, ask for the final document,
// and persist it exactly like a normal saveTurn would have.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-regenerate-doc:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { caseId?: string; force?: boolean }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { caseId, force } = body
  if (!caseId) {
    return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  }

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }

  // Refuse to clobber a document that's actually there — this endpoint exists for cases
  // where saveTurn's write silently failed, not as a general "redraft this" button. Pass
  // force:true (not exposed in the UI) if a real re-draft is ever genuinely needed.
  if (caseData.document_body && !force) {
    return Response.json(
      { error: 'This case already has a document. Refusing to overwrite it without force.' },
      { status: 409 },
    )
  }

  const agent = getAgent(caseData.agent_id)
  if (!agent) {
    return Response.json({ error: `Unknown agent: ${caseData.agent_id}` }, { status: 400 })
  }

  const { data: messageRows, error: msgErr } = await supabaseAdmin
    .from('messages')
    .select('role, content')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
  if (msgErr) {
    return Response.json({ error: 'Failed to load conversation history.' }, { status: 500 })
  }
  if (!messageRows || messageRows.length === 0) {
    return Response.json({ error: 'No conversation history to regenerate a document from.' }, { status: 400 })
  }

  const history: ChatMessage[] = messageRows.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  // Nudges the model to emit a fresh <<<DOCUMENT>>> block now — the stored history never
  // contains one (it's stripped from the visible text before saving, see AgentChat.tsx's
  // sendToAgent), so without this the model has no signal that a document is wanted here
  // rather than another interview question.
  history.push({
    role: 'user',
    content:
      'Please provide the complete final document now, based on everything discussed above. Do not ask any further questions — everything needed has already been provided.',
  })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 503 })
  }

  let responseText: string
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
        max_tokens: 4096,
        system: agent.systemPrompt,
        messages: capHistory(history).map((m) => ({ role: m.role, content: m.content })),
      }),
    })
    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      console.error('Anthropic API error during regeneration:', anthropicRes.status, errBody)
      return Response.json({ error: 'The legal agent is temporarily unavailable. Please try again shortly.' }, { status: 502 })
    }
    const data = await anthropicRes.json()
    responseText = Array.isArray(data?.content)
      ? data.content
          .filter((block: { type: string }) => block.type === 'text')
          .map((block: { text: string }) => block.text)
          .join('\n')
      : ''
  } catch (err) {
    console.error('Regenerate-document request failed:', err)
    return Response.json({ error: 'Network error while contacting the legal agent.' }, { status: 500 })
  }

  const { doc } = extractDocument(responseText)
  if (!doc) {
    return Response.json(
      { error: "The agent didn't produce a document from this conversation. It may need a human to draft this one manually." },
      { status: 502 },
    )
  }

  // Same {{REF_NUMBER}} substitution AgentChat.tsx's finalizeDocument does — the template
  // leaves this token for the AI to copy verbatim, filled in from the case's own DB-assigned
  // reference now that we have it (case_number/created_at were never affected by the missing
  // columns, so these are trustworthy).
  let finalBody = doc.body
  if (finalBody.includes('{{REF_NUMBER}}')) {
    const year = new Date(caseData.created_at).getFullYear()
    const ref = caseData.case_number != null ? `PLP/${year}/${String(caseData.case_number).padStart(6, '0')}` : `PLP/${year}/PENDING`
    finalBody = finalBody.split('{{REF_NUMBER}}').join(ref)
  }

  const amount = getAgentPayment(caseData.agent_id as AgentId).amount
  const update: Record<string, unknown> = {
    document_title: doc.title,
    document_body: finalBody,
  }
  // Only fill these in if genuinely unset — verify-payment's own update already set
  // delivery_option correctly at payment time (that write never touched the broken
  // columns), and expected_amount should reflect what was actually quoted/paid wherever
  // that's still known, not be silently reset on every regeneration.
  if (caseData.expected_amount == null) update.expected_amount = doc.price ?? amount
  if (caseData.agent_id === 'small-claims' && !caseData.delivery_option) {
    update.delivery_option = (doc.price ?? amount) >= 25000 ? 'pandas-serves' : 'self-serve'
  }

  const { error: updateErr } = await supabaseAdmin.from('cases').update(update).eq('id', caseId)
  if (updateErr) {
    console.error('Failed to persist regenerated document:', updateErr)
    return Response.json({ error: 'Regenerated the document but failed to save it. Please try again.' }, { status: 500 })
  }

  return Response.json({ ok: true, document: { title: doc.title, body: finalBody } })
}
