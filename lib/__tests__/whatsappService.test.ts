import { describe, it, expect } from 'vitest'
import {
  buildServiceMessage,
  normalizePhoneForWhatsApp,
  buildWhatsAppLink,
  hashMessage,
  generateAccessToken,
} from '../whatsappService'

describe('normalizePhoneForWhatsApp', () => {
  it('converts a Nigerian local number to international format', () => {
    expect(normalizePhoneForWhatsApp('08012345678')).toBe('2348012345678')
  })
  it('leaves an already-international number untouched (digits only)', () => {
    expect(normalizePhoneForWhatsApp('+234 801 234 5678')).toBe('2348012345678')
  })
  it('strips spaces, dashes, and parentheses', () => {
    expect(normalizePhoneForWhatsApp('(0801) 234-5678')).toBe('2348012345678')
  })
})

describe('buildServiceMessage', () => {
  it('includes the case ref, document title, and serve URL', () => {
    const msg = buildServiceMessage({ caseRef: 'PLP/2026/000042', documentTitle: 'Letter of Demand', serveUrl: 'https://pandaslp.com.ng/serve/abc123' })
    expect(msg).toContain('PLP/2026/000042')
    expect(msg).toContain('Letter of Demand')
    expect(msg).toContain('https://pandaslp.com.ng/serve/abc123')
  })
})

describe('buildWhatsAppLink', () => {
  it('produces a wa.me link with the normalized phone and encoded message', () => {
    const link = buildWhatsAppLink('08012345678', 'Hello world')
    expect(link).toBe('https://wa.me/2348012345678?text=Hello%20world')
  })
})

describe('hashMessage', () => {
  it('is deterministic for the same input', () => {
    expect(hashMessage('same text')).toBe(hashMessage('same text'))
  })
  it('differs for different input', () => {
    expect(hashMessage('text a')).not.toBe(hashMessage('text b'))
  })
  it('produces a 64-character hex sha256 digest', () => {
    expect(hashMessage('x')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('generateAccessToken', () => {
  it('produces a 64-character hex token (32 random bytes)', () => {
    expect(generateAccessToken()).toMatch(/^[0-9a-f]{64}$/)
  })
  it('is different on every call', () => {
    expect(generateAccessToken()).not.toBe(generateAccessToken())
  })
})
