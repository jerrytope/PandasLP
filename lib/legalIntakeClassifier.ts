export type ClassifiedAgent = 'small-claims' | 'recovery-of-premises' | 'cac-registration' | 'contracts'

export interface Classification {
  recognized: boolean
  problemType?: 'debt_recovery' | 'premises_recovery' | 'cac_registration' | 'contracts'
  agent?: ClassifiedAgent
  summary?: string
  explanation?: string
}

const SYSTEM_PROMPT = `You are a legal triage system for Pandas LP, a Nigerian law firm. A user has typed a legal problem into ChatGPT. Classify it into exactly one of these categories:

- debt_recovery — someone owes the user money and won't pay
- premises_recovery — the user needs to recover a rented property from a tenant, or is facing eviction
- cac_registration — the user wants to register a business with Nigeria's CAC
- contracts — the user needs a contract/agreement drafted or reviewed (NDA, employment, SLA, etc.)
- not_applicable — anything else, including non-Nigerian legal questions or topics outside these four areas

Respond with ONLY a JSON object, no markdown fences, no other text:
{
  "recognized": boolean,
  "problem_type": "debt_recovery" | "premises_recovery" | "cac_registration" | "contracts" | null,
  "summary": string | null,
  "explanation": string | null
}

"summary" must be a short, natural first-person restatement of the problem in the user's own voice (e.g. "I'm owed ₦200,000 by a client who has ignored 5 requests for payment, in Lagos.") — this gets sent as the user's opening message to a legal intake chat, so it must read like something a person would actually type, not a case-file summary.

"explanation" is one or two plain-language sentences on what the user's options are and why a demand letter/formal process helps — no legal jargon.

If not_applicable, set recognized to false and both problem_type and summary/explanation to null.`

const AGENT_BY_PROBLEM_TYPE: Record<string, ClassifiedAgent> = {
  debt_recovery: 'small-claims',
  premises_recovery: 'recovery-of-premises',
  cac_registration: 'cac-registration',
  contracts: 'contracts',
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fenced ? fenced[1] : trimmed
}

export async function classifyLegalProblem(query: string): Promise<Classification> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return { recognized: false }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: query }],
    }),
  })

  if (!res.ok) {
    console.error('Classifier Anthropic API error:', res.status, await res.text())
    return { recognized: false }
  }

  const data = await res.json()
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((block: { type: string }) => block.type === 'text')
        .map((block: { text: string }) => block.text)
        .join('\n')
    : ''

  try {
    const parsed = JSON.parse(stripCodeFences(text))
    const problemType = parsed.problem_type as string | null
    if (!parsed.recognized || !problemType || !(problemType in AGENT_BY_PROBLEM_TYPE)) {
      return { recognized: false }
    }
    return {
      recognized: true,
      problemType: problemType as Classification['problemType'],
      agent: AGENT_BY_PROBLEM_TYPE[problemType],
      summary: String(parsed.summary ?? ''),
      explanation: String(parsed.explanation ?? ''),
    }
  } catch (err) {
    console.error('Classifier failed to parse Claude response as JSON:', err, text)
    return { recognized: false }
  }
}
