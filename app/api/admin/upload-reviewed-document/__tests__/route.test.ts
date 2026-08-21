import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { id: 'admin-1', email: 'staff@pandaslp.com.ng' } }),
}))

const state: {
  caseExists: boolean
  uploadSpy: (path: string, buffer: Buffer, opts: unknown) => void
} = { caseExists: true, uploadSpy: vi.fn() }

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => (state.caseExists ? { data: { id: 'case-1' }, error: null } : { data: null, error: { message: 'not found' } }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: async (path: string, buffer: Buffer, opts: unknown) => {
          state.uploadSpy(path, buffer, opts)
          return { error: null }
        },
      }),
    },
  },
}))

import { POST } from '../route'

function req(body: unknown) {
  return new Request('http://localhost/api/admin/upload-reviewed-document', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer admin-token' },
    body: JSON.stringify(body),
  })
}

// Smallest possible valid PDF signature — real content doesn't matter, only the %PDF header
// the route checks for.
const VALID_PDF_BASE64 = Buffer.from('%PDF-1.4\n%%EOF').toString('base64')
const NOT_A_PDF_BASE64 = Buffer.from('not a pdf at all').toString('base64')

describe('POST /api/admin/upload-reviewed-document', () => {
  beforeEach(() => {
    state.caseExists = true
    state.uploadSpy = vi.fn()
  })

  it('rejects a request missing caseId or file', async () => {
    const res = await POST(req({ caseId: 'case-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the case does not exist', async () => {
    state.caseExists = false
    const res = await POST(req({ caseId: 'missing', fileBase64: VALID_PDF_BASE64 }))
    expect(res.status).toBe(404)
  })

  it('rejects a file that is not actually a PDF', async () => {
    const res = await POST(req({ caseId: 'case-1', fileBase64: NOT_A_PDF_BASE64 }))
    expect(res.status).toBe(400)
    expect(state.uploadSpy).not.toHaveBeenCalled()
  })

  it('rejects a file over the 10MB limit', async () => {
    const huge = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(11 * 1024 * 1024, 'a')]).toString('base64')
    const res = await POST(req({ caseId: 'case-1', fileBase64: huge }))
    expect(res.status).toBe(413)
  })

  it('uploads a valid PDF to the deterministic per-case path', async () => {
    const res = await POST(req({ caseId: 'case-1', fileBase64: VALID_PDF_BASE64 }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(state.uploadSpy).toHaveBeenCalledWith(
      'reviewed/case-1.pdf',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/pdf', upsert: true }),
    )
  })
})
