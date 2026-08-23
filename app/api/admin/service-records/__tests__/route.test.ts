import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { id: 'admin-1', email: 'staff@pandaslp.com.ng' } }),
}))

const state: {
  caseRow: Record<string, unknown> | null
  records: Record<string, unknown>[]
  insertSpy: (payload: Record<string, unknown>) => void
  updateSpy: (payload: Record<string, unknown>) => void
} = { caseRow: null, records: [], insertSpy: vi.fn(), updateSpy: vi.fn() }

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'cases') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: state.caseRow, error: state.caseRow ? null : { message: 'not found' } }),
            }),
          }),
        }
      }
      if (table === 'service_records') {
        return {
          insert: (payload: Record<string, unknown>) => {
            state.insertSpy(payload)
            return Promise.resolve({ error: null })
          },
          select: () => ({
            eq: () => ({
              order: async () => ({ data: state.records, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              state.updateSpy(payload)
              return { error: null }
            },
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  },
}))

import { POST, GET, PATCH } from '../route'

function req(method: string, body?: unknown, qs?: string) {
  return new Request(`http://localhost/api/admin/service-records${qs ?? ''}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer admin-token' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('POST /api/admin/service-records', () => {
  beforeEach(() => {
    state.caseRow = null
    state.records = []
    state.insertSpy = vi.fn()
    state.updateSpy = vi.fn()
    process.env.NEXT_PUBLIC_SITE_URL = 'https://pandaslp.com.ng'
  })

  it('rejects a request missing caseId or phone', async () => {
    const res = await POST(req('POST', { caseId: 'case-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the case does not exist', async () => {
    const res = await POST(req('POST', { caseId: 'missing', phone: '08012345678' }))
    expect(res.status).toBe(404)
  })

  it('refuses to serve a case with no document', async () => {
    state.caseRow = { id: 'case-1', case_number: 1, created_at: '2026-01-01T00:00:00Z', document_title: null }
    const res = await POST(req('POST', { caseId: 'case-1', phone: '08012345678' }))
    expect(res.status).toBe(400)
  })

  it('dispatches, records the attempt, and returns a wa.me link', async () => {
    state.caseRow = { id: 'case-1', case_number: 42, created_at: '2026-01-15T00:00:00Z', document_title: 'Letter of Demand' }
    const res = await POST(req('POST', { caseId: 'case-1', phone: '08012345678' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.whatsappLink).toContain('https://wa.me/2348012345678')
    expect(data.serveUrl).toContain('https://pandaslp.com.ng/serve/')
    expect(state.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ case_id: 'case-1', channel: 'whatsapp', status: 'dispatched' }),
    )
  })
})

describe('GET /api/admin/service-records', () => {
  beforeEach(() => {
    state.records = [{ id: 'rec-1', status: 'dispatched' }]
  })

  it('rejects a request missing caseId', async () => {
    const res = await GET(req('GET', undefined))
    expect(res.status).toBe(400)
  })

  it('returns the records for a case', async () => {
    const res = await GET(req('GET', undefined, '?caseId=case-1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.records).toEqual(state.records)
  })
})

describe('PATCH /api/admin/service-records', () => {
  it('rejects a request missing recordId', async () => {
    const res = await PATCH(req('PATCH', {}))
    expect(res.status).toBe(400)
  })

  it('marks a record acknowledged with the admin email attributed', async () => {
    const res = await PATCH(req('PATCH', { recordId: 'rec-1' }))
    expect(res.status).toBe(200)
    expect(state.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'acknowledged', acknowledged_by: 'staff@pandaslp.com.ng' }),
    )
  })
})
