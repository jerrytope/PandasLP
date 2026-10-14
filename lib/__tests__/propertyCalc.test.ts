import { describe, expect, it } from 'vitest'
import {
  addMonths,
  advanceRentCheck,
  arrears,
  daysBetween,
  formatDate,
  isNoticeLongEnough,
  jurisdictionOf,
  mesneProfits,
  noticeToQuit,
  parseDate,
  sevenDaysNoticeDate,
  type NoticeToQuitInput,
} from '../property/calc'

describe('dates', () => {
  it('parses and formats calendar dates, and rejects impossible ones', () => {
    expect(formatDate(parseDate('2026-03-01'))).toBe('2026-03-01')
    expect(() => parseDate('2026-02-30')).toThrow(RangeError)
    expect(() => parseDate('1/3/2026')).toThrow(RangeError)
  })

  it('keeps month-end dates in range', () => {
    expect(formatDate(addMonths(parseDate('2026-01-31'), 1))).toBe('2026-02-28')
    expect(formatDate(addMonths(parseDate('2028-01-31'), 1))).toBe('2028-02-29')
  })

  it('counts days between two dates', () => {
    expect(daysBetween('2026-01-01', '2026-04-01')).toBe(90)
  })
})

describe('mesneProfits', () => {
  it('is annual rent ÷ 365 × days, to the kobo', () => {
    expect(mesneProfits({ annualRent: 1_200_000, days: 90 })).toEqual({ amount: 295_890.41, kobo: 29_589_041, dailyRate: 3287.67 })
  })

  it('rejects nonsense inputs', () => {
    expect(() => mesneProfits({ annualRent: 0, days: 10 })).toThrow(RangeError)
    expect(() => mesneProfits({ annualRent: 1000, days: 1.5 })).toThrow(RangeError)
  })
})

describe('arrears', () => {
  it('counts every monthly period that started by the end date, in full', () => {
    expect(arrears({ rent: 150_000, frequency: 'monthly', from: '2026-01-01', to: '2026-02-28' })).toMatchObject({ amount: 300_000, periods: 2 })
    expect(arrears({ rent: 150_000, frequency: 'monthly', from: '2026-01-01', to: '2026-03-01' })).toMatchObject({ amount: 450_000, periods: 3 })
  })

  it('lists each period', () => {
    expect(arrears({ rent: 600_000, frequency: 'half-yearly', from: '2025-07-01', to: '2026-01-01' }).schedule).toEqual([
      { periodStart: '2025-07-01', periodEnd: '2025-12-31', rent: 600_000 },
      { periodStart: '2026-01-01', periodEnd: '2026-06-30', rent: 600_000 },
    ])
  })

  it('handles yearly and weekly rent', () => {
    expect(arrears({ rent: 1_200_000, frequency: 'yearly', from: '2025-03-01', to: '2026-02-28' }).periods).toBe(1)
    expect(arrears({ rent: 1_200_000, frequency: 'yearly', from: '2025-03-01', to: '2026-03-01' }).periods).toBe(2)
    expect(arrears({ rent: 10_000, frequency: 'weekly', from: '2026-03-02', to: '2026-03-15' }).periods).toBe(2)
  })

  it('rejects an end date before the start', () => {
    expect(() => arrears({ rent: 1000, frequency: 'monthly', from: '2026-03-01', to: '2026-02-01' })).toThrow(RangeError)
  })
})

describe('noticeToQuit', () => {
  const oyo = (extra: Partial<NoticeToQuitInput>): NoticeToQuitInput => ({ tenancyType: 'monthly', state: 'Oyo', receivedOn: '2026-03-01', ...extra })

  it('gives the default period for each tenancy type, counted from the day after receipt', () => {
    const quit = (tenancyType: NoticeToQuitInput['tenancyType']) => {
      const r = noticeToQuit(oyo({ tenancyType }))
      return r.needed ? r.quitDate : null
    }
    expect(quit('at-will')).toBe('2026-03-08')
    expect(quit('weekly')).toBe('2026-03-08')
    expect(quit('monthly')).toBe('2026-04-01')
    expect(quit('quarterly')).toBe('2026-06-01')
    expect(quit('half-yearly')).toBe('2026-06-01')
  })

  it("uses the agreement's own period over the default", () => {
    expect(noticeToQuit(oyo({ agreementPeriod: { count: 2, unit: 'months' } }))).toMatchObject({
      needed: true,
      periodSource: 'agreement',
      period: { count: 2, unit: 'months' },
      quitDate: '2026-05-01',
    })
  })

  describe('yearly tenancy', () => {
    const yearly = (receivedOn: string) => noticeToQuit(oyo({ tenancyType: 'yearly', tenancyStart: '2025-01-01', receivedOn }))

    it('ends on the first tenancy year-end at least six months away', () => {
      expect(yearly('2026-03-01')).toMatchObject({ needed: true, quitDate: '2026-12-31', period: { count: 6, unit: 'months' } })
      expect(yearly('2026-06-30')).toMatchObject({ quitDate: '2026-12-31' })
    })

    it('rolls over to the next year-end when served one day too late', () => {
      expect(yearly('2026-07-01')).toMatchObject({ quitDate: '2027-12-31' })
    })

    it('needs the tenancy start date', () => {
      expect(() => noticeToQuit(oyo({ tenancyType: 'yearly' }))).toThrow(RangeError)
    })
  })

  describe('fixed term', () => {
    const fixed = (extra: Partial<NoticeToQuitInput>) => noticeToQuit(oyo({ tenancyType: 'fixed-term', fixedTermEnd: '2026-01-31', ...extra }))

    it('needs no notice once expired, if no rent was taken after', () => {
      expect(fixed({})).toMatchObject({ needed: false, reason: 'fixed-term-expired', nextStep: 'seven-days-notice' })
    })

    it('needs a notice when rent was taken after expiry, following how that rent was paid', () => {
      expect(fixed({ rentTakenAfterExpiry: true, rentFrequencyAfterExpiry: 'monthly' })).toMatchObject({
        needed: true,
        tenancyType: 'monthly',
        quitDate: '2026-04-01',
      })
    })

    it('is not ended early by a notice while it is still running', () => {
      expect(fixed({ receivedOn: '2026-01-15' })).toMatchObject({ needed: false, reason: 'fixed-term-running', tenancyEnds: '2026-01-31' })
    })
  })

  describe('Lagos arrears rule', () => {
    const lagos = (extra: Partial<NoticeToQuitInput>) => noticeToQuit({ tenancyType: 'monthly', state: 'Lagos', lagosArea: 'Surulere', receivedOn: '2026-03-01', ...extra })

    it('needs no notice for a monthly tenant owing six months', () => {
      expect(lagos({ monthsInArrears: 6 })).toMatchObject({ needed: false, reason: 'lagos-arrears-lapse', nextStep: 'seven-days-notice' })
      expect(lagos({ monthsInArrears: 5 })).toMatchObject({ needed: true })
    })

    it("needs no notice for a quarterly or half-yearly tenant owing a year's rent", () => {
      expect(lagos({ tenancyType: 'quarterly', monthsInArrears: 12 })).toMatchObject({ needed: false })
      expect(lagos({ tenancyType: 'half-yearly', monthsInArrears: 12 })).toMatchObject({ needed: false })
      expect(lagos({ tenancyType: 'quarterly', monthsInArrears: 11 })).toMatchObject({ needed: true })
    })

    it('does not apply to a yearly tenant, outside Lagos, or in the excluded areas', () => {
      expect(lagos({ tenancyType: 'yearly', tenancyStart: '2025-01-01', monthsInArrears: 24 })).toMatchObject({ needed: true })
      expect(noticeToQuit(oyo({ monthsInArrears: 6 }))).toMatchObject({ needed: true })
      const ikoyi = lagos({ lagosArea: 'Ikoyi', monthsInArrears: 6 })
      expect(ikoyi).toMatchObject({ needed: true, jurisdiction: 'lagos-excluded-area', quitDate: '2026-04-01' })
      expect(ikoyi.notes.join(' ')).toMatch(/Rent Control/)
    })
  })

  it('identifies the Lagos excluded areas however they are written', () => {
    expect(jurisdictionOf('Lagos', 'Victoria Island')).toBe('lagos-excluded-area')
    expect(jurisdictionOf('lagos', 'ikeja gra')).toBe('lagos-excluded-area')
    expect(jurisdictionOf('Lagos', 'Ikeja')).toBe('lagos')
    expect(jurisdictionOf('FCT')).toBe('other')
  })
})

describe('isNoticeLongEnough', () => {
  it('rejects a notice short by one day', () => {
    const input: NoticeToQuitInput = { tenancyType: 'monthly', state: 'Oyo', receivedOn: '2026-03-01' }
    expect(isNoticeLongEnough({ ...input, quitDate: '2026-03-31' })).toEqual({ valid: false, earliestQuitDate: '2026-04-01' })
    expect(isNoticeLongEnough({ ...input, quitDate: '2026-04-01' }).valid).toBe(true)
  })

  it('requires a yearly notice to end on a tenancy year-end', () => {
    const input: NoticeToQuitInput = { tenancyType: 'yearly', tenancyStart: '2025-01-01', state: 'Oyo', receivedOn: '2026-03-01' }
    expect(isNoticeLongEnough({ ...input, quitDate: '2026-12-30' }).valid).toBe(false)
    expect(isNoticeLongEnough({ ...input, quitDate: '2026-12-31' }).valid).toBe(true)
    expect(isNoticeLongEnough({ ...input, quitDate: '2027-01-15' }).valid).toBe(false)
  })
})

describe('sevenDaysNoticeDate', () => {
  it('runs seven clear days from receipt', () => {
    expect(sevenDaysNoticeDate({ receivedOn: '2026-04-02', tenancyEndedOn: '2026-04-01' })).toEqual({ expiresOn: '2026-04-09', earliestFilingDate: '2026-04-10' })
  })

  it('cannot be served before the tenancy has ended', () => {
    expect(() => sevenDaysNoticeDate({ receivedOn: '2026-04-01', tenancyEndedOn: '2026-04-01' })).toThrow(RangeError)
  })
})

describe('advanceRentCheck', () => {
  const lagos = { state: 'Lagos', lagosArea: 'Surulere' }

  it('allows a new tenant at most a year', () => {
    expect(advanceRentCheck({ ...lagos, tenantType: 'new', rentFrequency: 'monthly', monthsDemanded: 12 })).toMatchObject({ applies: true, limitMonths: 12, withinLimit: true })
    expect(advanceRentCheck({ ...lagos, tenantType: 'new', rentFrequency: 'yearly', monthsDemanded: 24 })).toMatchObject({ withinLimit: false })
  })

  it('allows a sitting monthly tenant at most six months, a sitting yearly tenant a year', () => {
    expect(advanceRentCheck({ ...lagos, tenantType: 'sitting', rentFrequency: 'monthly', monthsDemanded: 6 })).toMatchObject({ limitMonths: 6, withinLimit: true })
    expect(advanceRentCheck({ ...lagos, tenantType: 'sitting', rentFrequency: 'monthly', monthsDemanded: 7 })).toMatchObject({ withinLimit: false })
    expect(advanceRentCheck({ ...lagos, tenantType: 'sitting', rentFrequency: 'yearly', monthsDemanded: 12 })).toMatchObject({ limitMonths: 12, withinLimit: true })
  })

  it('leaves an unsettled case to a lawyer', () => {
    expect(advanceRentCheck({ ...lagos, tenantType: 'sitting', rentFrequency: 'quarterly', monthsDemanded: 9 })).toMatchObject({ applies: true, limitMonths: null, withinLimit: null })
  })

  it('does not apply in the excluded areas or outside Lagos', () => {
    expect(advanceRentCheck({ state: 'Lagos', lagosArea: 'Ikoyi', tenantType: 'new', rentFrequency: 'yearly', monthsDemanded: 24 })).toMatchObject({ applies: false })
    expect(advanceRentCheck({ state: 'Oyo', tenantType: 'new', rentFrequency: 'yearly', monthsDemanded: 24 })).toMatchObject({ applies: false })
  })
})
