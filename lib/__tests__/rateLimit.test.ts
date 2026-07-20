import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkRateLimit, getClientIp } from '../rateLimit'

describe('checkRateLimit', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the limit', () => {
    const key = `test-${Math.random()}`
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
  })

  it('blocks once the limit is exceeded within the window', () => {
    const key = `test-${Math.random()}`
    checkRateLimit(key, 2, 60_000)
    checkRateLimit(key, 2, 60_000)
    const third = checkRateLimit(key, 2, 60_000)
    expect(third.allowed).toBe(false)
    expect(third.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets after the window elapses', () => {
    vi.useFakeTimers()
    const key = `test-${Math.random()}`
    checkRateLimit(key, 1, 1_000)
    expect(checkRateLimit(key, 1, 1_000).allowed).toBe(false)

    vi.advanceTimersByTime(1_001)
    expect(checkRateLimit(key, 1, 1_000).allowed).toBe(true)
  })

  it('tracks separate keys independently', () => {
    const keyA = `test-a-${Math.random()}`
    const keyB = `test-b-${Math.random()}`
    checkRateLimit(keyA, 1, 60_000)
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false)
    expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true)
  })
})

describe('getClientIp', () => {
  it('reads the last address from x-forwarded-for (closest hop, hardest for a client to spoof)', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.5, 70.41.3.18' },
    })
    expect(getClientIp(req)).toBe('70.41.3.18')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = new Request('https://example.com', { headers: { 'x-real-ip': '203.0.113.9' } })
    expect(getClientIp(req)).toBe('203.0.113.9')
  })

  it('falls back to "unknown" when neither header is present', () => {
    const req = new Request('https://example.com')
    expect(getClientIp(req)).toBe('unknown')
  })
})
