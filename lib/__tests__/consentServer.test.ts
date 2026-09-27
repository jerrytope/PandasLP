import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }))

beforeAll(() => {
  process.env.UNSUBSCRIBE_SECRET = 'test-secret'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://pandaslp.com.ng'
})

describe('unsubscribe links', async () => {
  const { unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } = await import('../consentServer')

  it('verifies its own token and rejects tampering', () => {
    const t = unsubscribeToken('e:a@x.com')
    expect(verifyUnsubscribeToken('e:a@x.com', t)).toBe(true)
    expect(verifyUnsubscribeToken('e:b@x.com', t)).toBe(false)
    expect(verifyUnsubscribeToken('e:a@x.com', t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'))).toBe(false)
    expect(verifyUnsubscribeToken('e:a@x.com', '')).toBe(false)
  })

  it('builds a link from the email (lower-cased), else the phone', () => {
    const url = unsubscribeUrl({ email: ' A@X.com ', phone: '2348031234567' })!
    const u = new URL(url)
    expect(u.pathname).toBe('/unsubscribe')
    expect(u.searchParams.get('id')).toBe('e:a@x.com')
    expect(verifyUnsubscribeToken('e:a@x.com', u.searchParams.get('t')!)).toBe(true)
    expect(new URL(unsubscribeUrl({ phone: '2348031234567' })!).searchParams.get('id')).toBe('p:2348031234567')
    expect(unsubscribeUrl({})).toBeNull()
  })
})
