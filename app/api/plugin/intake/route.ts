export const runtime = 'nodejs'

import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { classifyLegalProblem } from '@/lib/legalIntakeClassifier'
import { getAgentPayment } from '@/lib/agentServiceMap'
import { formatNaira } from '@/lib/formatNaira'

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 10 * 60 * 1000
const MAX_QUERY_LENGTH = 2000

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'

// Public endpoint — ChatGPT has no user session to forward, so there's no auth pattern to
// reuse from the rest of this codebase. PLUGIN_API_KEY is the substitute: a fixed key pasted
// into the OpenAI Action's own auth config, checked here so a request has to actually come
// from that configured Action, not just anyone who finds this URL. Each hit costs a real
// Claude API call, unlike every other public route in this app.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`plugin-intake:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const pluginKey = process.env.PLUGIN_API_KEY
  if (!pluginKey) {
    return Response.json({ error: 'This endpoint is not configured yet.' }, { status: 503 })
  }
  if (req.headers.get('x-plugin-key') !== pluginKey) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: { user_query?: string; user_id?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const query = body.user_query?.trim()
  if (!query) {
    return Response.json({ error: 'Missing user_query.' }, { status: 400 })
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json({ error: `user_query must be ${MAX_QUERY_LENGTH} characters or fewer.` }, { status: 400 })
  }

  const classification = await classifyLegalProblem(query)

  if (!classification.recognized || !classification.agent) {
    return Response.json({
      recognized: false,
      message:
        "This sounds like a legal question, but it's outside Pandas LP's current services. We specialize in Nigerian debt recovery, tenant disputes, contracts, and business registration.",
    })
  }

  // Price always comes from the real pricing table, never from the classifier — the same
  // "never trust an untrusted source for money" rule /api/verify-payment already follows
  // for delivery_option.
  const { amount } = getAgentPayment(classification.agent)
  const caseLink = `${SITE_URL}/agent/${classification.agent}?ref=chatgpt&auto=${encodeURIComponent(classification.summary || query)}`

  return Response.json({
    recognized: true,
    problem_type: classification.problemType,
    agent: classification.agent,
    summary: classification.summary,
    explanation: classification.explanation,
    cta: 'Draft your document',
    case_link: caseLink,
    price_info: `Starts from ${formatNaira(amount)}`,
  })
}
