import { describe, it, expect } from 'vitest'
import { resolveCasePrice, judgmentEnforcementFee } from '../casePricing'
import { getFee, PROPERTY_DOCUMENTS, PROPERTY_PRICING, propertyOnlineFees } from '../propertyPricing'

describe('resolveCasePrice', () => {
  describe('small-claims', () => {
    it('accepts the two tiers and derives the delivery option', () => {
      expect(resolveCasePrice('small-claims', 10000, null)).toEqual({ ok: true, amount: 10000, deliveryOption: 'self-serve' })
      expect(resolveCasePrice('small-claims', 25000, null)).toEqual({ ok: true, amount: 25000, deliveryOption: 'pandas-serves' })
    })

    it('falls back to self-serve when the AI emitted no PRICE', () => {
      expect(resolveCasePrice('small-claims', undefined, null)).toEqual({ ok: true, amount: 10000, deliveryOption: 'self-serve' })
    })

    it('rejects any other amount, including a cheaper one', () => {
      expect(resolveCasePrice('small-claims', 100, null).ok).toBe(false)
      expect(resolveCasePrice('small-claims', 24999, null).ok).toBe(false)
      expect(resolveCasePrice('small-claims', 0, null).ok).toBe(false)
    })
  })

  describe('recovery-of-premises', () => {
    it('accepts every listed property fee, and 0 for an invoiced transfer', () => {
      for (const amount of [PROPERTY_PRICING.tenancy, PROPERTY_PRICING.standardSearch, PROPERTY_PRICING.flatDocument, 0]) {
        expect(resolveCasePrice('recovery-of-premises', amount, null)).toEqual({ ok: true, amount, deliveryOption: null })
      }
    })

    it('rejects an unlisted fee', () => {
      expect(resolveCasePrice('recovery-of-premises', 5000, null).ok).toBe(false)
    })

    it('allows exactly the online fees in the property document list, plus 0', () => {
      expect(propertyOnlineFees()).toEqual([25_000, 30_000, 50_000])
      // The comprehensive search floor is a lawyer's quote, never paid online.
      expect(resolveCasePrice('recovery-of-premises', 100_000, null).ok).toBe(false)
    })
  })

  describe('flat-fee agents', () => {
    it('always charge their standard fee, whatever the AI wrote', () => {
      expect(resolveCasePrice('contracts', 1, null)).toEqual({ ok: true, amount: 5000, deliveryOption: null })
      expect(resolveCasePrice('cac-registration', undefined, null)).toEqual({ ok: true, amount: 15000, deliveryOption: null })
      expect(resolveCasePrice('lawyer-consultation', 50, null)).toEqual({ ok: true, amount: 15000, deliveryOption: null })
    })
  })

  describe('judgment-enforcement', () => {
    it('computes base fee + 5% from the judgment on record, ignoring the AI figure', () => {
      expect(resolveCasePrice('judgment-enforcement', 10, 1_000_000)).toEqual({ ok: true, amount: 60000, deliveryOption: null })
    })

    it('without a judgment on record, accepts the AI figure only at or above the base fee', () => {
      expect(resolveCasePrice('judgment-enforcement', 35000, null)).toEqual({ ok: true, amount: 35000, deliveryOption: null })
      expect(resolveCasePrice('judgment-enforcement', 9999, null).ok).toBe(false)
      expect(resolveCasePrice('judgment-enforcement', undefined, null)).toEqual({ ok: true, amount: 10000, deliveryOption: null })
    })
  })

  it('rejects negative and fractional prices for every agent', () => {
    expect(resolveCasePrice('small-claims', -10000, null).ok).toBe(false)
    expect(resolveCasePrice('contracts', 5000.5, null).ok).toBe(false)
  })
})

describe('judgmentEnforcementFee', () => {
  it('rounds the 5% to whole naira', () => {
    expect(judgmentEnforcementFee(123_457)).toBe(10000 + 6173)
  })
})

describe('getFee', () => {
  it('prices every property document type', () => {
    for (const type of Object.keys(PROPERTY_DOCUMENTS)) expect(getFee(type)).not.toBeNull()
  })

  it('charges the tenancy fee for tenancy documents and short subleases, the flat fee for instruments', () => {
    expect(getFee('notice-to-quit')).toMatchObject({ kind: 'flat', amount: 25_000 })
    expect(getFee('sublease-agreement')).toMatchObject({ kind: 'flat', amount: 25_000 })
    expect(getFee('deed-of-release')).toMatchObject({ kind: 'flat', amount: 30_000 })
    expect(getFee('search-instruction-standard')).toMatchObject({ kind: 'flat', amount: 50_000 })
  })

  it('has no price for fees the firm has not set, or that a lawyer quotes', () => {
    for (const type of ['deed-of-sublease', 'will', 'codicil', 'probate-papers', 'assent', 'dispute-brief', 'search-instruction-comprehensive']) {
      expect(getFee(type)).toMatchObject({ kind: 'lawyer-confirms', amount: null })
    }
  })

  it('returns null for an unknown document', () => {
    expect(getFee('deed-of-everything')).toBeNull()
    expect(getFee('toString')).toBeNull()
  })
})
