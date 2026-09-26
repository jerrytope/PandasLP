import { getAgent, SMALL_CLAIMS_LAWYER_INTAKE_PROMPT } from '@/lib/agents'
import { capHistory, type ChatMessage } from '@/lib/chatHistory'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buildCurrentDateContext } from '@/lib/currentDateContext'
import { isAdminEmail } from '@/lib/adminAuth'
import { callClaude } from '@/lib/claude'

// Stable for every conversation with a given agent, so it sits inside the cached system block.
const DOCUMENT_CONTEXT_RULE = `DOCUMENT CONTEXT RULE: If any user message begins with "DOCUMENT CONTEXT —", it contains facts automatically extracted from a file the user uploaded. Treat all facts in that block as confirmed by the user. Do NOT re-ask questions that are already answered by those facts. Acknowledge what you found briefly, then ask only for information that is still missing.`

// Node runtime (not edge) — this route now needs supabaseAdmin for the auth check below,
// and CLAUDE.md documents that Supabase admin calls require Node's runtime. This route
// never streamed anyway (single await'd JSON response), so there's no latency tradeoff.
export const runtime = 'nodejs'

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 5 * 60 * 1000

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`chat:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  let body: { messages?: ChatMessage[]; agentId?: string; lawyerIntake?: boolean; caseId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { messages, agentId, lawyerIntake, caseId } = body

  if (!agentId || typeof agentId !== 'string') {
    return Response.json({ error: 'Missing agentId.' }, { status: 400 })
  }

  const agent = getAgent(agentId)
  if (!agent) {
    return Response.json({ error: `Unknown agent: ${agentId}` }, { status: 400 })
  }

  // Lawyer intake (Custom Claims tab, see app/admin/page.tsx) swaps in the admin-only prompt
  // below instead of agent.systemPrompt. Only small-claims has one so far — see
  // lib/agents.ts's SMALL_CLAIMS_LAWYER_INTAKE_PROMPT for why it deliberately isn't just
  // another entry in AGENTS.
  if (lawyerIntake && agentId !== 'small-claims') {
    return Response.json({ error: 'Lawyer intake mode is not available for this agent.' }, { status: 400 })
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
  // The one place this route cares about WHO the caller is, not just THAT they're signed
  // in — lawyer intake hands back a prompt written for Pandas LP's own staff, so it must
  // never be reachable by an ordinary client who happens to know the request shape.
  if (lawyerIntake && !isAdminEmail(callerData.user.email)) {
    return Response.json({ error: 'Only a member of staff can use lawyer intake mode.' }, { status: 403 })
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'Missing messages.' }, { status: 400 })
  }
  // Generous cap — real messages are never anywhere near this; only rejects
  // pathological/abuse payloads, not legitimate use.
  const MAX_MESSAGE_LENGTH = 8000
  const hasInvalidMessage = messages.some(
    (m) =>
      typeof m.content !== 'string' ||
      m.content.length > MAX_MESSAGE_LENGTH ||
      (m.role !== 'user' && m.role !== 'assistant'),
  )
  if (hasInvalidMessage) {
    return Response.json({ error: 'Invalid message in conversation.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return Response.json(
      { error: 'This agent is not configured yet. Add a real ANTHROPIC_API_KEY to .env.local to enable chat.' },
      { status: 503 },
    )
  }

  // Attribute this turn's AI cost to the matter, but only a matter the caller owns (or staff).
  let usageCaseId: string | null = null
  if (typeof caseId === 'string' && caseId) {
    const { data: owned } = await supabaseAdmin.from('cases').select('id, user_id').eq('id', caseId).maybeSingle()
    if (owned && (owned.user_id === callerData.user.id || isAdminEmail(callerData.user.email))) usageCaseId = owned.id
  }

  try {
    // Prompt caching (see lib/claude.ts): the agent's instructions are identical for every
    // client, so they are one cached block with a 1-hour lifetime; the conversation itself is
    // cached turn by turn. Today's date changes, so it comes after the cached block — placed
    // inside it, it would invalidate the cache every day and cost full price on every turn.
    const currentDateContext = buildCurrentDateContext(new Date())
    const result = await callClaude({
      route: `chat.${lawyerIntake ? 'lawyer-intake' : agent.id}`,
      system: [
        { text: `${lawyerIntake ? SMALL_CLAIMS_LAWYER_INTAKE_PROMPT : agent.systemPrompt}

${DOCUMENT_CONTEXT_RULE}`, cache: '1h' },
        { text: currentDateContext },
      ],
      messages: capHistory(messages).map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 4096,
      cacheConversation: true,
      caseId: usageCaseId,
    })

    if (!result.ok) {
      return Response.json(
        { error: 'The legal agent is temporarily unavailable. Please try again shortly.' },
        { status: 502 },
      )
    }
    const text = result.text

    return Response.json({ response: text })
  } catch (err) {
    console.error('Chat route error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
