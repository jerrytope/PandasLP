import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'client@example.com' } }, error: null }),
    },
  },
}))

import { POST } from '../route'

function req(body: unknown) {
  return new Request('http://localhost/api/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer session-token' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/translate', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn())
  })

  it('rejects a request missing text', async () => {
    const res = await POST(req({ targetLanguage: 'yo' }))
    expect(res.status).toBe(400)
  })

  it('rejects text over the length cap', async () => {
    const res = await POST(req({ text: 'a'.repeat(20001), targetLanguage: 'yo' }))
    expect(res.status).toBe(400)
  })

  it('returns a translation for a normal request', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'O jẹ́ ọ̀rọ̀ ìtumọ̀' }] }),
    })
    const res = await POST(req({ text: 'This is a demand letter.', targetLanguage: 'yo' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.translatedText).toBe('O jẹ́ ọ̀rọ̀ ìtumọ̀')
  })

  it('falls back to "en" when detection returns something unsupported', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'french' }] }),
    })
    const res = await POST(req({ text: 'Bonjour', detectOnly: true }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.detectedLanguage).toBe('en')
  })

  it('returns the detected language when it is a supported code', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'yo' }] }),
    })
    const res = await POST(req({ text: 'Bawo ni', detectOnly: true }))
    const data = await res.json()
    expect(data.detectedLanguage).toBe('yo')
  })

  it('returns 502 when the Anthropic API call fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    const res = await POST(req({ text: 'hello', targetLanguage: 'yo' }))
    expect(res.status).toBe(502)
  })
})
