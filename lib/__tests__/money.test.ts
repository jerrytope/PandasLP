import { describe, expect, it } from 'vitest'
import { amountInWords, formatKobo, nairaToKobo, numberToWords, parseNairaInput, vatOn } from '../money'

describe('money', () => {
  it('converts and formats naira', () => {
    expect(nairaToKobo(50000)).toBe(5_000_000)
    expect(formatKobo(5_000_000)).toBe('₦50,000.00')
    expect(formatKobo(375_000, { symbol: false })).toBe('3,750.00')
  })

  it('parses typed amounts', () => {
    expect(parseNairaInput('50,000')).toBe(5_000_000)
    expect(parseNairaInput('₦50000.5')).toBe(5_000_050)
    expect(parseNairaInput('NGN 1 250 000')).toBe(125_000_000)
    expect(parseNairaInput('fifty')).toBeNull()
    expect(parseNairaInput('12.345')).toBeNull()
  })

  it('computes VAT to the kobo', () => {
    expect(vatOn(5_000_000, 7.5)).toBe(375_000)
    expect(vatOn(3_333_300, 7.5)).toBe(249_998) // 249,997.5 kobo rounds up
    expect(vatOn(5_000_000, 0)).toBe(0)
  })

  it('writes amounts in words the way the firm does', () => {
    expect(numberToWords(3_300_000)).toBe('Three Million, Three Hundred Thousand')
    expect(numberToWords(50_000)).toBe('Fifty Thousand')
    expect(numberToWords(105)).toBe('One Hundred and Five')
    expect(numberToWords(1_253_421)).toBe('One Million, Two Hundred and Fifty-Three Thousand, Four Hundred and Twenty-One')
    expect(amountInWords(5_000_000)).toBe('Fifty Thousand Naira Only')
    expect(amountInWords(5_375_050)).toBe('Fifty-Three Thousand, Seven Hundred and Fifty Naira and Fifty Kobo Only')
  })
})
