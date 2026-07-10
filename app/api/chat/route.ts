import { getAgent } from '@/lib/agents'
import { capHistory, type ChatMessage } from '@/lib/chatHistory'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export const runtime = 'edge'

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

  let body: { messages?: ChatMessage[]; agentId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { messages, agentId } = body

  if (!agentId || typeof agentId !== 'string') {
    return Response.json({ error: 'Missing agentId.' }, { status: 400 })
  }

  const agent = getAgent(agentId)
  if (!agent) {
    return Response.json({ error: `Unknown agent: ${agentId}` }, { status: 400 })
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'Missing messages.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return Response.json(
      { error: 'This agent is not configured yet. Add a real ANTHROPIC_API_KEY to .env.local to enable chat.' },
      { status: 503 },
    )
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
        max_tokens: 4096,
        system: `${agent.systemPrompt}

DOCUMENT CONTEXT RULE: If any user message begins with "DOCUMENT CONTEXT —", it contains facts automatically extracted from a file the user uploaded. Treat all facts in that block as confirmed by the user. Do NOT re-ask questions that are already answered by those facts. Acknowledge what you found briefly, then ask only for information that is still missing.`,
        messages: capHistory(messages).map((m) => ({ role: m.role, content: m.content })),
      }),
    })

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      console.error('Anthropic API error:', anthropicRes.status, errBody)
      return Response.json(
        { error: 'The legal agent is temporarily unavailable. Please try again shortly.' },
        { status: 502 },
      )
    }

    const data = await anthropicRes.json()
    const text = Array.isArray(data?.content)
      ? data.content
          .filter((block: { type: string }) => block.type === 'text')
          .map((block: { text: string }) => block.text)
          .join('\n')
      : ''

    return Response.json({ response: text })
  } catch (err) {
    console.error('Chat route error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
