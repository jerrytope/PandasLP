import { describe, it, expect, beforeEach } from 'vitest'
import { isAdminEmail } from '../adminAuth'

describe('isAdminEmail', () => {
  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.ADMIN_EMAILS
    delete process.env.ADMIN_EMAIL
  })

  it('returns false for null or undefined', () => {
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })

  it('returns false when no env var is set', () => {
    expect(isAdminEmail('admin@example.com')).toBe(false)
  })

  it('matches single email in ADMIN_EMAIL', () => {
    process.env.ADMIN_EMAIL = 'admin@example.com'
    expect(isAdminEmail('admin@example.com')).toBe(true)
    expect(isAdminEmail('other@example.com')).toBe(false)
  })

  it('matches multiple emails in ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'admin1@example.com, admin2@example.com'
    expect(isAdminEmail('admin1@example.com')).toBe(true)
    expect(isAdminEmail('admin2@example.com')).toBe(true)
    expect(isAdminEmail('other@example.com')).toBe(false)
  })

  it('is case-insensitive', () => {
    process.env.ADMIN_EMAILS = 'Admin@Example.com'
    expect(isAdminEmail('admin@example.com')).toBe(true)
    expect(isAdminEmail('ADMIN@EXAMPLE.COM')).toBe(true)
  })

  it('handles whitespace around comma-separated emails', () => {
    process.env.ADMIN_EMAILS = '  admin1@example.com  ,  admin2@example.com '
    expect(isAdminEmail('admin1@example.com')).toBe(true)
    expect(isAdminEmail('admin2@example.com')).toBe(true)
  })

  it('handles empty segments in comma-separated list', () => {
    process.env.ADMIN_EMAILS = 'admin1@example.com,,admin2@example.com,'
    expect(isAdminEmail('admin1@example.com')).toBe(true)
    expect(isAdminEmail('admin2@example.com')).toBe(true)
  })
})
