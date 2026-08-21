import { describe, it, expect, beforeEach, vi } from 'vitest'

// Auth itself is covered by lib/__tests__/requireAdmin.test.ts — mocked here as always-admin
// so these tests exercise only this route's own guards (missing document, no messages,
// unknown agent, ref-number substitution), not the auth boundary a second time.
vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { id: 'admin-1', email: 'staff@pandaslp.com.ng' } }),
}))

const supabaseState: {
  caseRow: Record<string, unknown> | null
  messages: { role: string; content: string }[] | null
  updateSpy: (payload: Record<string, unknown>) => void
} = { caseRow: null, messages: null, updateSpy: vi.fn() }

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'cases') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: supabaseState.caseRow, error: supabaseState.caseRow ? null : { message: 'not found' } }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              supabaseState.updateSpy(payload)
              return { error: null }
            },
          }),
        }
      }
      if (table === 'messages') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: supabaseState.messages, error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  },
}))

import { POST } from '../route'

function req(body: unknown) {
  return new Request('http://localhost/api/admin/regenerate-document', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer admin-token' },
    body: JSON.stringify(body),
  })
}

const BASE_CASE = {
  id: 'case-1',
  agent_id: 'small-claims',
  status: 'paid',
  document_body: null,
  document_title: null,
  expected_amount: null,
  delivery_option: null,
  case_number: 42,
  created_at: '2026-01-15T00:00:00.000Z',
}

describe('POST /api/admin/regenerate-document', () => {
  beforeEach(() => {
    supabaseState.caseRow = null
    supabaseState.messages = null
    supabaseState.updateSpy = vi.fn()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn())
  })

  it('rejects a request with no caseId', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the case does not exist', async () => {
    supabaseState.caseRow = null
    const res = await POST(req({ caseId: 'missing' }))
    expect(res.status).toBe(404)
  })

  it('refuses to overwrite a case that already has a document', async () => {
    supabaseState.caseRow = { ...BASE_CASE, document_body: 'Existing letter text' }
    const res = await POST(req({ caseId: 'case-1' }))
    expect(res.status).toBe(409)
  })

  it('returns 400 when there is no conversation history', async () => {
    supabaseState.caseRow = { ...BASE_CASE }
    supabaseState.messages = []
    const res = await POST(req({ caseId: 'case-1' }))
    expect(res.status).toBe(400)
  })

  it('regenerates and persists the document, substituting the ref number', async () => {
    supabaseState.caseRow = { ...BASE_CASE }
    supabaseState.messages = [
      { role: 'user', content: 'He owes me N50,000 for furniture.' },
      { role: 'assistant', content: 'Understood, drafting your letter.' },
    ]
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: [
              '<<<DOCUMENT>>>',
              'TITLE: Letter of Demand',
              'PRICE: 10000',
              '---',
              'Our Ref: {{REF_NUMBER}}',
              'Body text here.',
              '<<<END_DOCUMENT>>>',
            ].join('\n'),
          },
        ],
      }),
    })

    const res = await POST(req({ caseId: 'case-1' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.document.title).toBe('Letter of Demand')
    expect(data.document.body).toContain('PLP/2026/000042')
    expect(supabaseState.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        document_title: 'Letter of Demand',
        document_body: expect.stringContaining('PLP/2026/000042'),
        expected_amount: 10000,
        delivery_option: 'self-serve',
      }),
    )
  })

  it("returns 502 when the agent doesn't produce a document", async () => {
    supabaseState.caseRow = { ...BASE_CASE }
    supabaseState.messages = [{ role: 'user', content: 'Still explaining my situation.' }]
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Can you tell me more about the amount owed?' }] }),
    })

    const res = await POST(req({ caseId: 'case-1' }))
    expect(res.status).toBe(502)
    expect(supabaseState.updateSpy).not.toHaveBeenCalled()
  })
})
