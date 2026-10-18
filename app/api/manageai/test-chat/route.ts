export const runtime = 'nodejs'

import { requireAiManager } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { AGENTS } from '@/lib/agents'
import { callClaude } from '@/lib/claude'
import { capHistory, type ChatMessage } from '@/lib/chatHistory'
import { buildCurrentDateContext } from '@/lib/currentDateContext'
import { allLiveInstructions, instructionsFor } from '@/lib/agentInstructions'
import { MAX_INSTRUCTIONS_LENGTH, areaOfTarget, isInstructionTarget, withDraftingInstructions } from '@/lib/agentInstructionTargets'
import { propertyAgentV2Enabled } from '@/lib/property/starter'
import { runPropertyOrchestrator } from '@/lib/property/orchestrator'
import { readSnapshot, snapshotRepo } from '@/lib/property/snapshotRepo'
import { supabaseLawLibrary } from '@/lib/property/lawLibrary'
import { configuredWebSearcher } from '@/lib/property/webSearch'

// The test chat on /manageai: the real agent, with the draft instructions in place of the live
// ones for the target being tested. Nothing is saved: no case, no messages, no property matter,
// no lawyer alert. The cost is still logged in ai_usage (route "manageai.test.*", no case).

const RATE_LIMIT = 40
const RATE_WINDOW_MS = 5 * 60 * 1000
const MAX_MESSAGE_LENGTH = 8000
// The property agent's matter record has no case behind it.
const TEST_CASE_ID = 'manageai-test'

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`manageai-test:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json({ error: 'Too many test messages. Please wait a moment.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  }
  const auth = await requireAiManager(req)
  if (auth instanceof Response) return auth

  let body: { target?: string; draft?: string; messages?: ChatMessage[]; snapshot?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const { target, draft, messages } = body
  if (!isInstructionTarget(target)) return Response.json({ error: 'Unknown agent.' }, { status: 400 })
  if (typeof draft !== 'string' || draft.length > MAX_INSTRUCTIONS_LENGTH) return Response.json({ error: 'Missing or too-long instructions.' }, { status: 400 })
  if (!Array.isArray(messages) || messages.length === 0) return Response.json({ error: 'Missing messages.' }, { status: 400 })
  if (messages.some((m) => typeof m.content !== 'string' || m.content.length > MAX_MESSAGE_LENGTH || (m.role !== 'user' && m.role !== 'assistant'))) {
    return Response.json({ error: 'Invalid message in conversation.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 503 })
  }

  const override = { target, body: draft }
  try {
    // The rebuilt property agent: the whole agent, or one of its areas.
    if ((areaOfTarget(target) || target === 'recovery-of-premises') && propertyAgentV2Enabled()) {
      const snapshot = readSnapshot(body.snapshot, TEST_CASE_ID)
      const result = await runPropertyOrchestrator({
        caseId: TEST_CASE_ID,
        messages: capHistory(messages),
        now: new Date(),
        repo: snapshotRepo(snapshot),
        library: supabaseLawLibrary,
        webSearch: configuredWebSearcher(),
        draftingInstructions: await allLiveInstructions(override),
        // No case to charge the cost to.
        call: (opts) => callClaude({ ...opts, route: `manageai.test.${opts.route}`, caseId: null }),
      })
      if (result.ok === false) return Response.json({ error: result.error }, { status: result.status })
      return Response.json({ response: result.response, snapshot })
    }

    const agent = AGENTS[(areaOfTarget(target) ? 'recovery-of-premises' : target) as keyof typeof AGENTS]
    const result = await callClaude({
      route: `manageai.test.${agent.id}`,
      system: [
        { text: withDraftingInstructions(agent.systemPrompt, await instructionsFor(target, override)), cache: '1h' },
        { text: buildCurrentDateContext(new Date()) },
      ],
      messages: capHistory(messages).map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 4096,
      cacheConversation: true,
      caseId: null,
    })
    if (!result.ok) return Response.json({ error: 'The agent is temporarily unavailable. Please try again shortly.' }, { status: 502 })
    return Response.json({ response: result.text })
  } catch (err) {
    console.error('manageai test chat failed:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
