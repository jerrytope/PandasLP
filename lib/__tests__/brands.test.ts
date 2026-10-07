import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))
import { parseBrandInput, parseBrandUpdate } from '../brands'

const valid = {
  name: ' LAPO Microfinance Bank ',
  code: 'lapo',
  address: ' 18 Idowu Taylor Street,\n Victoria Island, Lagos ',
  contactEmails: 'Ops@Lapo.ng, ceo@lapo.ng; ops@lapo.ng',
  perLetterFeeNaira: '5000',
}

describe('parseBrandInput', () => {
  it('normalises the form: trims, upper-cases the code, de-duplicates and lower-cases emails, naira → kobo', () => {
    expect(parseBrandInput(valid)).toEqual({
      ok: true,
      value: {
        name: 'LAPO Microfinance Bank',
        code: 'LAPO',
        address: '18 Idowu Taylor Street, Victoria Island, Lagos',
        contactEmails: ['ops@lapo.ng', 'ceo@lapo.ng'],
        perLetterFeeKobo: 500000,
      },
    })
  })

  it('rejects a bad code, no emails, an invalid email, or a missing fee', () => {
    expect(parseBrandInput({ ...valid, code: 'L1' }).ok).toBe(false)
    expect(parseBrandInput({ ...valid, contactEmails: '' }).ok).toBe(false)
    expect(parseBrandInput({ ...valid, contactEmails: 'not-an-email' }).ok).toBe(false)
    expect(parseBrandInput({ ...valid, perLetterFeeNaira: '' }).ok).toBe(false)
    expect(parseBrandInput({ ...valid, name: '' }).ok).toBe(false)
    expect(parseBrandInput({ ...valid, address: '' }).ok).toBe(false)
    expect(parseBrandInput(null).ok).toBe(false)
  })
})

describe('parseBrandUpdate', () => {
  const edit = { name: 'LAPO MFB', address: '18 Idowu Taylor Street, Lagos', contactEmails: 'new@lapo.ng', perLetterFeeNaira: 7500, active: false }

  it('accepts name, address, contacts, fee and active — and ignores any attempt to change the code', () => {
    expect(parseBrandUpdate({ ...edit, code: 'HACK' })).toEqual({
      ok: true,
      value: { name: 'LAPO MFB', address: '18 Idowu Taylor Street, Lagos', contactEmails: ['new@lapo.ng'], perLetterFeeKobo: 750000, active: false },
    })
  })

  it('requires the active flag and at least one contact', () => {
    expect(parseBrandUpdate({ ...edit, active: undefined }).ok).toBe(false)
    expect(parseBrandUpdate({ ...edit, contactEmails: '' }).ok).toBe(false)
  })
})
