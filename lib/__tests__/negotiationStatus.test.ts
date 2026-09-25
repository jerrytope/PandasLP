import { describe, expect, it } from 'vitest'
import { defaultStatusFor, isDueDate, isNegotiationStatus, lagosToday } from '../negotiationStatus'

describe('negotiationStatus', () => {
  it('defaults the status from whose round it is', () => {
    expect(defaultStatusFor('debtor_counsel')).toBe('awaiting_our_reply')
    expect(defaultStatusFor('pandas_lp')).toBe('awaiting_their_reply')
  })

  it('accepts only known statuses', () => {
    expect(isNegotiationStatus('agreed')).toBe(true)
    expect(isNegotiationStatus('awaiting_their_reply')).toBe(true)
    expect(isNegotiationStatus('settled')).toBe(false)
    expect(isNegotiationStatus(undefined)).toBe(false)
  })

  it('accepts real calendar dates only', () => {
    expect(isDueDate('2026-09-30')).toBe(true)
    expect(isDueDate('2026-02-30')).toBe(false)
    expect(isDueDate('30/09/2026')).toBe(false)
    expect(isDueDate('2026-9-30')).toBe(false)
    expect(isDueDate('')).toBe(false)
  })

  it('measures today in Lagos time, not UTC', () => {
    // 23:30 UTC on 29 Sept is already 00:30 on 30 Sept in Lagos (UTC+1).
    expect(lagosToday(new Date('2026-09-29T23:30:00Z'))).toBe('2026-09-30')
    expect(lagosToday(new Date('2026-09-29T12:00:00Z'))).toBe('2026-09-29')
  })
})
