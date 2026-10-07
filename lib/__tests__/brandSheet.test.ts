import { describe, it, expect } from 'vitest'
import {
  AGENT_COLUMNS,
  BRAND_COLUMNS,
  BRAND_SHEET_HEADERS,
  columnLetter,
  isValidBrandCode,
  isValidCaseRef,
  validateHeaders,
} from '../brandSheet'

describe('brand sheet layout', () => {
  it('has the 17 fixed columns A–Q, with Case ID first and the agent columns last', () => {
    expect(BRAND_SHEET_HEADERS).toHaveLength(17)
    expect(columnLetter('Case ID')).toBe('A')
    expect(columnLetter('Status')).toBe('L')
    expect(columnLetter('Last Updated')).toBe('Q')
    expect(BRAND_SHEET_HEADERS.slice(-AGENT_COLUMNS.length)).toEqual([...AGENT_COLUMNS])
  })

  it('never lets a column be both the brand’s and the agent’s, and Case ID is neither', () => {
    const overlap = BRAND_COLUMNS.filter((c) => (AGENT_COLUMNS as readonly string[]).includes(c))
    expect(overlap).toEqual([])
    expect(BRAND_COLUMNS).not.toContain('Case ID')
    expect(AGENT_COLUMNS).not.toContain('Case ID')
  })
})

describe('validateHeaders', () => {
  it('accepts the exact header row, ignoring stray spaces', () => {
    expect(validateHeaders(BRAND_SHEET_HEADERS.map((h) => ` ${h} `))).toEqual({ ok: true })
  })

  it('rejects a renamed, missing or reordered column and says which', () => {
    const renamed = [...BRAND_SHEET_HEADERS] as string[]
    renamed[3] = 'E-mail'
    const result = validateHeaders(renamed)
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.error).toContain('column D should be "Email" but is "E-mail"')

    expect(validateHeaders(BRAND_SHEET_HEADERS.slice(0, 16)).ok).toBe(false)
    const swapped = [...BRAND_SHEET_HEADERS] as string[]
    ;[swapped[1], swapped[2]] = [swapped[2], swapped[1]]
    expect(validateHeaders(swapped).ok).toBe(false)
  })
})

describe('codes and Case IDs', () => {
  it('accepts 2–8 capital letters as a brand code', () => {
    expect(isValidBrandCode('LAPO')).toBe(true)
    expect(isValidBrandCode('AB')).toBe(true)
    expect(isValidBrandCode('A')).toBe(false)
    expect(isValidBrandCode('lapo')).toBe(false)
    expect(isValidBrandCode('LAPO1')).toBe(false)
    expect(isValidBrandCode('ABCDEFGHI')).toBe(false)
  })

  it('accepts Case IDs like LAPO-0001 and LAPO-12345', () => {
    expect(isValidCaseRef('LAPO-0001')).toBe(true)
    expect(isValidCaseRef('LAPO-12345')).toBe(true)
    expect(isValidCaseRef('LAPO-1')).toBe(false)
    expect(isValidCaseRef('12')).toBe(false)
  })
})
