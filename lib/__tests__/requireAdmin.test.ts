import { describe, it, expect, beforeEach, vi } from 'vitest'

// lib/adminAuth.ts imports the real supabaseAdmin client, which would otherwise make a real
// network call inside auth.getUser(). Mocked here so requireAdmin's own branching (missing
// header / invalid token / non-admin email / admin email) can be tested in isolation — this
// is the exact boundary the admin case-deletion endpoint depends on to keep destructive
// actions restricted to staff.
vi.mock('../supabaseAdmin', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
  },
}))

import { requireAdmin } from '../adminAuth'
import { supabaseAdmin } from '../supabaseAdmin'

const getUserMock = supabaseAdmin.auth.getUser as unknown as ReturnType<typeof vi.fn>

function reqWithAuth(header?: string) {
  const headers = new Headers()
  if (header) headers.set('authorization', header)
  return new Request('http://localhost/api/admin/cases', { headers })
}

describe('requireAdmin', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    delete process.env.ADMIN_EMAILS
    delete process.env.ADMIN_EMAIL
    process.env.ADMIN_EMAILS = 'staff@pandaslp.com.ng'
  })

  it('returns 401 when the Authorization header is missing', async () => {
    const result = await requireAdmin(reqWithAuth())
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('returns 401 when the token is invalid or expired', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })
    const result = await requireAdmin(reqWithAuth('Bearer bad-token'))
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns 403 for a valid session that is not on the admin allowlist', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'client@example.com' } }, error: null })
    const result = await requireAdmin(reqWithAuth('Bearer good-token'))
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('returns the user for a valid session on the admin allowlist', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u2', email: 'staff@pandaslp.com.ng' } }, error: null })
    const result = await requireAdmin(reqWithAuth('Bearer good-token'))
    expect(result).not.toBeInstanceOf(Response)
    expect((result as { user: { id: string } }).user.id).toBe('u2')
  })

  it('is case-insensitive when checking the admin allowlist', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u3', email: 'STAFF@pandaslp.com.ng' } }, error: null })
    const result = await requireAdmin(reqWithAuth('Bearer good-token'))
    expect(result).not.toBeInstanceOf(Response)
  })
})
