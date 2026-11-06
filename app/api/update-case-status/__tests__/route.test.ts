import { beforeEach, describe, expect, it, vi } from 'vitest'

const state: {
  caseRow: Record<string, unknown>
  user: { id: string; email: string }
  updateSpy: (payload: Record<string, unknown>) => void
  statusHistorySpy: (payload: Record<string, unknown>) => void
  updateMatches: boolean
} = {
  caseRow: {},
  user: { id: 'admin-1', email: 'admin@pandaslp.com.ng' },
  updateSpy: vi.fn(),
  statusHistorySpy: vi.fn(),
  updateMatches: true,
}

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
    from: (table: string) => {
      if (table === 'cases') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: state.caseRow, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            state.updateSpy(payload)
            return {
              eq: () => ({
                eq: () => ({
                  select: async () => ({
                    data: state.updateMatches ? [{ id: state.caseRow.id }] : [],
                    error: null,
                  }),
                }),
              }),
            }
          },
        }
      }
      if (table === 'case_status_history') {
        return {
          insert: (payload: Record<string, unknown>) => {
            state.statusHistorySpy(payload)
            return Promise.resolve({ error: null })
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  },
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  getClientIp: () => '127.0.0.1',
}))
vi.mock('@/lib/adminAuth', () => ({
  isAdminEmail: (email: string | undefined) => email === 'admin@pandaslp.com.ng',
}))
vi.mock('@/lib/sendCaseEmail', () => ({
  sendCaseEmail: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('@/lib/reviewChecklists', () => ({ getReviewChecklist: () => null }))
vi.mock('@/lib/brandServing', () => ({
  approveBrandLetter: vi.fn(),
  brandWorkspaceOrNull: vi.fn(),
  recordBrandServed: vi.fn(),
}))
vi.mock('@/lib/brandWebhooks', () => ({ deliverForMatter: vi.fn() }))
vi.mock('@/lib/brandExceptions', () => ({ courtFilingAllowed: vi.fn() }))

import { POST } from '../route'

function request(action: string) {
  return new Request('http://localhost/api/update-case-status', {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ caseId: 'case-1', action }),
  })
}

describe('POST /api/update-case-status early resolutions', () => {
  beforeEach(() => {
    state.caseRow = {
      id: 'case-1',
      user_id: 'client-1',
      agent_id: 'small-claims',
      brand_id: null,
      status: 'letter_served',
      resolution_email_sent: true,
    }
    state.user = { id: 'admin-1', email: 'admin@pandaslp.com.ng' }
    state.updateSpy = vi.fn()
    state.statusHistorySpy = vi.fn()
    state.updateMatches = true
  })

  it.each([
    ['markRecovered', 'recovered'],
    ['markSettled', 'settled'],
  ])('records %s as a distinct, audited closure', async (action, resolutionType) => {
    const response = await POST(request(action))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, status: 'closed' })
    expect(state.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'closed',
      resolution_type: resolutionType,
      resolved_at: expect.any(String),
      resolved_by: 'admin@pandaslp.com.ng',
    }))
    expect(state.statusHistorySpy).toHaveBeenCalledWith(expect.objectContaining({
      case_id: 'case-1',
      from_status: 'letter_served',
      to_status: 'closed',
    }))
  })

  it('requires an administrator', async () => {
    state.user = { id: 'client-1', email: 'client@example.com' }

    const response = await POST(request('markRecovered'))

    expect(response.status).toBe(403)
    expect(state.updateSpy).not.toHaveBeenCalled()
  })

  it('rejects closure from an ineligible status', async () => {
    state.caseRow.status = 'paid'

    const response = await POST(request('markSettled'))

    expect(response.status).toBe(409)
    expect(state.updateSpy).not.toHaveBeenCalled()
  })

  it('rejects a stale status update rather than reporting false success', async () => {
    state.updateMatches = false

    const response = await POST(request('markRecovered'))

    expect(response.status).toBe(409)
    expect(state.statusHistorySpy).not.toHaveBeenCalled()
  })
})
