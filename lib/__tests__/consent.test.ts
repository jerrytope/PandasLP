import { describe, expect, it } from 'vitest'
import { activeMarketingContacts, csvCell, marketingStatus, type ConsentRecordRow } from '../consent'

let n = 0
function rec(p: Partial<ConsentRecordRow>): ConsentRecordRow {
  n++
  return {
    id: `id-${String(n).padStart(3, '0')}`,
    created_at: `2026-09-${String(n).padStart(2, '0')}T10:00:00Z`,
    email: null,
    phone: null,
    purpose: 'marketing',
    granted: true,
    channels: ['email'],
    wording: 'w',
    wording_version: 'marketing_v1',
    source: 'debt_check',
    source_id: null,
    recorded_by: null,
    note: null,
    ...p,
  }
}

describe('activeMarketingContacts', () => {
  it('lists people whose latest marketing record is a grant', () => {
    n = 0
    const list = activeMarketingContacts([rec({ email: 'a@x.com' }), rec({ phone: '2348031234567', channels: ['whatsapp'] })])
    expect(list).toHaveLength(2)
  })

  it('drops someone who later withdrew', () => {
    n = 0
    const list = activeMarketingContacts([rec({ email: 'a@x.com' }), rec({ email: 'a@x.com', granted: false })])
    expect(list).toHaveLength(0)
  })

  it('a withdrawal by phone removes the same person signed up with email + phone', () => {
    n = 0
    const list = activeMarketingContacts([
      rec({ email: 'a@x.com', phone: '2348031234567', channels: ['email', 'whatsapp'] }),
      rec({ phone: '2348031234567', granted: false, source: 'admin' }),
    ])
    expect(list).toHaveLength(0)
  })

  it('a withdrawal by phone also covers a separate email-only sign-up once they are linked', () => {
    n = 0
    const list = activeMarketingContacts([
      rec({ email: 'a@x.com', source: 'footer_newsletter' }),
      rec({ email: 'a@x.com', phone: '2348031234567', channels: ['whatsapp'] }),
      rec({ phone: '2348031234567', granted: false }),
    ])
    expect(list).toHaveLength(0)
  })

  it('re-subscribing after a withdrawal puts them back, with "since" from the new grant', () => {
    n = 0
    const list = activeMarketingContacts([
      rec({ email: 'a@x.com' }),
      rec({ email: 'a@x.com', granted: false }),
      rec({ email: 'a@x.com', source: 'footer_newsletter' }),
    ])
    expect(list).toHaveLength(1)
    expect(list[0].since).toBe('2026-09-03T10:00:00Z')
    expect(list[0].source).toBe('footer_newsletter')
  })

  it('merges identifiers and channels for one person', () => {
    n = 0
    const list = activeMarketingContacts([
      rec({ email: 'a@x.com', source: 'footer_newsletter' }),
      rec({ email: 'a@x.com', phone: '2348031234567', channels: ['email', 'whatsapp'] }),
    ])
    expect(list).toEqual([
      { email: 'a@x.com', phone: '2348031234567', channels: ['email', 'whatsapp'], since: '2026-09-01T10:00:00Z', source: 'footer_newsletter', wording_version: 'marketing_v1' },
    ])
  })

  it('ignores matter-contact consent entirely', () => {
    n = 0
    expect(activeMarketingContacts([rec({ email: 'a@x.com', purpose: 'matter_contact' })])).toHaveLength(0)
  })
})

describe('marketingStatus', () => {
  it('reports none, granted and withdrawn', () => {
    n = 0
    const records = [rec({ email: 'a@x.com' }), rec({ phone: '2348031234567' }), rec({ phone: '2348031234567', granted: false })]
    expect(marketingStatus(records, { email: 'A@X.com' })).toBe('granted')
    expect(marketingStatus(records, { phone: '2348031234567' })).toBe('withdrawn')
    expect(marketingStatus(records, { email: 'nobody@x.com' })).toBe('none')
    expect(marketingStatus(records, {})).toBe('none')
  })
})

describe('csvCell', () => {
  it('quotes, escapes and defuses formulas', () => {
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell(null)).toBe('""')
  })
})
