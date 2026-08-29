import { describe, it, expect } from 'vitest'
import { getReviewChecklist, isHighRiskDocument } from '../reviewChecklists'

describe('getReviewChecklist', () => {
  it('never returns an empty checklist, even for an unrecognised title', () => {
    expect(getReviewChecklist('Some Unrelated Document').length).toBeGreaterThan(0)
  })

  it('never returns an empty checklist for null/undefined', () => {
    expect(getReviewChecklist(null).length).toBeGreaterThan(0)
    expect(getReviewChecklist(undefined).length).toBeGreaterThan(0)
  })

  it("includes a Governor's Consent item for Deed of Assignment", () => {
    const items = getReviewChecklist('Deed of Assignment')
    expect(items.some((i) => i.id === 'consent-clause')).toBe(true)
  })

  it("includes a Governor's Consent item for Deed of Gift", () => {
    const items = getReviewChecklist('Deed of Gift')
    expect(items.some((i) => i.id === 'consent-clause')).toBe(true)
  })

  it("includes a Governor's Consent item for Deed of Legal Mortgage", () => {
    const items = getReviewChecklist('Deed of Legal Mortgage')
    expect(items.some((i) => i.id === 'consent-clause')).toBe(true)
  })

  it('is tolerant of minor title phrasing differences', () => {
    expect(getReviewChecklist('DEED OF GIFT').some((i) => i.id === 'consent-clause')).toBe(true)
    expect(getReviewChecklist('A Deed of Gift for the property').some((i) => i.id === 'consent-clause')).toBe(true)
  })

  it('generic documents (Notice to Quit) do not require a consent clause', () => {
    const items = getReviewChecklist('Notice to Quit')
    expect(items.some((i) => i.id === 'consent-clause')).toBe(false)
  })
})

describe('isHighRiskDocument', () => {
  it('flags conveyancing instruments as high-risk', () => {
    expect(isHighRiskDocument('Deed of Assignment')).toBe(true)
    expect(isHighRiskDocument('Deed of Gift')).toBe(true)
    expect(isHighRiskDocument('Power of Attorney')).toBe(true)
    expect(isHighRiskDocument('Deed of Legal Mortgage')).toBe(true)
    expect(isHighRiskDocument('Agreement for Sale of Land')).toBe(true)
  })

  it('does not flag notices, tenancy agreements, or search reports as high-risk', () => {
    expect(isHighRiskDocument('Notice to Quit')).toBe(false)
    expect(isHighRiskDocument('Tenancy Agreement')).toBe(false)
    expect(isHighRiskDocument('Property Search Report')).toBe(false)
  })

  it('is false for an unrecognised title (never a false positive)', () => {
    expect(isHighRiskDocument('Some Unrelated Document')).toBe(false)
  })
})
