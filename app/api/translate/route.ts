export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { callClaude } from '@/lib/claude'

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 5 * 60 * 1000

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ig', label: 'Igbo' },
  { code: 'ha', label: 'Hausa' },
  { code: 'pcm', label: 'Nigerian Pidgin' },
] as const

// Same Claude call pattern as app/api/chat/route.ts — reuses the one AI vendor this project
// is already built on rather than adding a dedicated translation API/vendor.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`translate:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
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

  let body: { text?: string; targetLanguage?: string; detectOnly?: boolean }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const { text, targetLanguage, detectOnly } = body
  if (!text || typeof text !== 'string') {
    return Response.json({ error: 'Missing text.' }, { status: 400 })
  }
  const MAX_LENGTH = 20000
  if (text.length > MAX_LENGTH) {
    return Response.json({ error: 'Text too long to translate at once.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('your_anthropic_api_key_here')) {
    return Response.json({ error: 'Translation is not configured yet.' }, { status: 503 })
  }

  const languageNames = SUPPORTED_LANGUAGES.map((l) => `${l.code} (${l.label})`).join(', ')

  const prompt = detectOnly
    ? `Identify which language this text is written in. Respond with ONLY the two/three-letter code from this list: ${languageNames}. If it's not clearly one of these, respond with "en". Text:\n\n${text}`
    : `Translate the following legal document text into ${SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.label ?? targetLanguage}. Preserve the structure, numbering, and any **bold** markers exactly as they appear — do not add commentary, only output the translated text. Text:\n\n${text}`

  try {
    const result = await callClaude({
      route: detectOnly ? 'translate.detect' : 'translate.text',
      system: '',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
    })
    if (!result.ok) {
      return Response.json({ error: 'Translation is temporarily unavailable. Please try again shortly.' }, { status: 502 })
    }
    const resultText = result.text.trim()

    if (detectOnly) {
      const code = SUPPORTED_LANGUAGES.some((l) => l.code === resultText) ? resultText : 'en'
      return Response.json({ detectedLanguage: code })
    }
    return Response.json({ translatedText: resultText })
  } catch (err) {
    console.error('Translate route error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
