import { getAgent } from '@/lib/agents'

export const runtime = 'edge'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: Request) {
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
        system: agent.systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
