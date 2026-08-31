import { describe, it, expect } from 'vitest'
import { buildCurrentDateContext } from '../currentDateContext'

describe('buildCurrentDateContext', () => {
  it('states the correct year, not a stale/earlier one', () => {
    const context = buildCurrentDateContext(new Date('2026-08-30T12:00:00Z'))
    expect(context).toContain('2026')
    expect(context).not.toMatch(/\b202[0-5]\b/)
  })

  it('includes the full weekday and month name, not just numbers', () => {
    const context = buildCurrentDateContext(new Date('2026-08-30T12:00:00Z'))
    expect(context).toContain('Sunday')
    expect(context).toContain('August')
  })

  it('instructs the model to use this date for relative references', () => {
    const context = buildCurrentDateContext(new Date('2026-01-01T00:00:00Z'))
    expect(context.toLowerCase()).toContain('last year')
    expect(context.toLowerCase()).toContain('today')
  })

  it('reflects a different date correctly when given one', () => {
    const context = buildCurrentDateContext(new Date('2027-03-15T00:00:00Z'))
    expect(context).toContain('2027')
    expect(context).toContain('March')
    expect(context).not.toContain('2026')
  })
})
