import { getAgent, SMALL_CLAIMS_LAWYER_INTAKE_PROMPT } from '@/lib/agents'
import { capHistory } from '@/lib/chatHistory'
import { resolveStoredTurn } from '@/lib/chatPersistence'
import { LAWYER_INTAKE_STARTER_MESSAGE } from '@/lib/agentChatParsing'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buildCurrentDateContext } from '@/lib/currentDateContext'
import { isAdminEmail } from '@/lib/adminAuth'
import { callClaude } from '@/lib/claude'
import { propertyAgentV2Enabled } from '@/lib/property/starter'
import { runPropertyOrchestrator } from '@/lib/property/orchestrator'
import { matterStore } from '@/lib/property/matterStore'
import { supabaseLawLibrary } from '@/lib/property/lawLibrary'
import { configuredWebSearcher } from '@/lib/property/webSearch'
import { emailLawyerAlert } from '@/lib/property/lawyerAlerts'
import { allLiveInstructions, instructionsFor } from '@/lib/agentInstructions'
import { withDraftingInstructions } from '@/lib/agentInstructionTargets'
import { conversationKey, parseHandoverBlock, saveLawyerHandover } from '@/lib/lawyerHandover'

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

  let body: { agentId?: string; lawyerIntake?: boolean; caseId?: string; userMessageId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { agentId, lawyerIntake, caseId, userMessageId } = body

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

  if (!caseId || typeof caseId !== 'string' || !userMessageId || typeof userMessageId !== 'string') {
    return Response.json({ error: 'Missing case or message reference.' }, { status: 400 })
  }

  const { data: caseData, error: caseError } = await supabaseAdmin
    .from('cases')
    .select('id, user_id, agent_id')
    .eq('id', caseId)
    .maybeSingle()
  if (caseError) {
    console.error('Could not load chat case:', caseError)
    return Response.json({ error: 'Could not load this conversation.' }, { status: 500 })
  }
  if (!caseData) return Response.json({ error: 'Case not found.' }, { status: 404 })
  if (caseData.user_id !== callerData.user.id && !isAdminEmail(callerData.user.email)) {
    return Response.json({ error: 'You do not have access to this conversation.' }, { status: 403 })
  }
  if (caseData.agent_id !== agent.id) {
    return Response.json({ error: 'This case belongs to a different agent.' }, { status: 409 })
  }

  const { data: storedMessages, error: messagesError } = await supabaseAdmin
    .from('messages')
    .select('id, role, content, reply_to_message_id')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (messagesError) {
    console.error('Could not load saved chat history:', messagesError)
    return Response.json({ error: 'Could not load this conversation.' }, { status: 500 })
  }
  const savedMessages = storedMessages ?? []

  const turn = resolveStoredTurn(
    savedMessages,
    userMessageId,
    lawyerIntake ? LAWYER_INTAKE_STARTER_MESSAGE : agent.starterMessage,
  )
  if (turn.kind === 'not_found') {
    return Response.json({ error: 'The saved user message was not found.' }, { status: 404 })
  }
  if (turn.kind === 'replay') {
    return Response.json({ response: turn.response, messageId: turn.messageId, replayed: true })
  }
  if (turn.kind === 'conflict') {
    return Response.json({ error: 'A later turn already exists in this conversation.' }, { status: 409 })
  }

  const messages = turn.messages
  if (messages.some((message) => message.content.length > 8000)) {
    return Response.json({ error: 'A message in this conversation is too long.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return Response.json(
      { error: 'This agent is not configured yet. Add a real ANTHROPIC_API_KEY to .env.local to enable chat.' },
      { status: 503 },
    )
  }

  // Attribute this turn's AI cost to the matter, but only a matter the caller owns (or staff).
  const usageCaseId = caseData.id

  // The rebuilt Property Law Agent (docs/property_agent_plans/): a router and sub-agents with
  // tools and a saved matter record, which is keyed by the case, so the case must be given
  // (AgentChat creates it before the first message).
  if (agent.id === 'recovery-of-premises' && !lawyerIntake && propertyAgentV2Enabled()) {
    if (!usageCaseId) {
      return Response.json({ error: 'Missing or invalid case for this conversation. Please refresh and try again.' }, { status: 400 })
    }
    try {
      const result = await runPropertyOrchestrator({ caseId: usageCaseId, messages: capHistory(messages), now: new Date(), repo: matterStore, library: supabaseLawLibrary, webSearch: configuredWebSearcher(), notify: emailLawyerAlert, draftingInstructions: await allLiveInstructions() })
      if (result.ok === false) return Response.json({ error: result.error }, { status: result.status })
      const { data: savedReply, error: saveReplyError } = await supabaseAdmin
        .from('messages')
        .insert({ case_id: usageCaseId, role: 'assistant', content: result.response, reply_to_message_id: userMessageId })
        .select('id')
        .single()
      if (saveReplyError) {
        if (saveReplyError.code === '23505') {
          const { data: existing } = await supabaseAdmin.from('messages').select('id, content').eq('reply_to_message_id', userMessageId).maybeSingle()
          if (existing) return Response.json({ response: existing.content, messageId: existing.id, replayed: true })
        }
        console.error('Could not save property-agent reply:', saveReplyError)
        return Response.json({ error: 'Could not save the agent response. Please retry.' }, { status: 500 })
      }
      return Response.json({ response: result.response, messageId: savedReply.id })
    } catch (err) {
      console.error('Property agent error:', err)
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }
  }

  try {
    // Prompt caching (see lib/claude.ts): the agent's instructions are identical for every
    // client, so they are one cached block with a 1-hour lifetime; the conversation itself is
    // cached turn by turn. Today's date changes, so it comes after the cached block — placed
    // inside it, it would invalidate the cache every day and cost full price on every turn.
    // The lead lawyer's drafting instructions (/manageai) go at the end of the cached block:
    // they change only when he publishes, so the cache refreshes then and not otherwise.
    // Lawyer intake drafts small-claims letters, so it follows the small-claims instructions.
    const currentDateContext = buildCurrentDateContext(new Date())
    const instructions = await instructionsFor(agent.id)
    const result = await callClaude({
      route: `chat.${lawyerIntake ? 'lawyer-intake' : agent.id}`,
      system: [
        { text: withDraftingInstructions(`${lawyerIntake ? SMALL_CLAIMS_LAWYER_INTAKE_PROMPT : agent.systemPrompt}

${DOCUMENT_CONTEXT_RULE}
${agent.id === 'small-claims' && !lawyerIntake ? `
LAWYER HANDOVER: When the client explicitly asks to speak with a person/lawyer, asks a legal question outside this agent's debt-recovery scope, or the matter requires a lawyer to review before drafting, append exactly one hidden block at the very end of your response:
<<<HANDOVER>>>
{"kind":"client_request"|"legal_question"|"lawyer_review","summary":"A concise factual summary for the legal team","contactPreference":"email, phone, WhatsApp, or omitted","contactDetail":"client-provided contact detail or omitted"}
<<<END_HANDOVER>>>
Choose one literal kind value, not the alternatives notation. Do not invent a contact detail. Continue to respond to the client naturally before the block. Do not emit this block for ordinary in-scope intake.
` : ''}`, instructions), cache: '1h' },
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
    const parsed = agent.id === 'small-claims' && !lawyerIntake
      ? parseHandoverBlock(result.text)
      : { response: result.text, handover: null }
    if (parsed.handover) {
      try {
        const caseDetails = usageCaseId
          ? await supabaseAdmin.from('cases').select('client_email, client_phone').eq('id', usageCaseId).maybeSingle()
          : { data: null, error: null }
        if (caseDetails.error) throw caseDetails.error
        const firstUserMessage = messages.find((message) => message.role === 'user')?.content ?? ''
        await saveLawyerHandover({
          handover: parsed.handover,
          caseId: usageCaseId,
          agentId: agent.id,
          conversationKey: conversationKey(usageCaseId, agent.id, firstUserMessage),
          clientEmail: caseDetails.data?.client_email ?? callerData.user.email ?? null,
          clientPhone: caseDetails.data?.client_phone ?? null,
        })
      } catch (err) {
        console.error('Could not record or notify staff about lawyer handover:', err)
      }
    }

    const { data: savedReply, error: saveReplyError } = await supabaseAdmin
      .from('messages')
      .insert({ case_id: usageCaseId, role: 'assistant', content: parsed.response, reply_to_message_id: userMessageId })
      .select('id')
      .single()
    if (saveReplyError) {
      if (saveReplyError.code === '23505') {
        const { data: existing } = await supabaseAdmin.from('messages').select('id, content').eq('reply_to_message_id', userMessageId).maybeSingle()
        if (existing) return Response.json({ response: existing.content, messageId: existing.id, replayed: true })
      }
      console.error('Could not save assistant reply:', saveReplyError)
      return Response.json({ error: 'Could not save the agent response. Please retry.' }, { status: 500 })
    }
    return Response.json({ response: parsed.response, messageId: savedReply.id })
  } catch (err) {
    console.error('Chat route error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
