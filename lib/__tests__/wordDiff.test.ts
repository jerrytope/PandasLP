import { describe, it, expect } from 'vitest'
import { wordDiff, hasChanges } from '../wordDiff'

describe('wordDiff', () => {
  it('reports no changes for identical text', () => {
    const parts = wordDiff('the debtor owes 50000 naira', 'the debtor owes 50000 naira')
    expect(hasChanges(parts)).toBe(false)
    expect(parts.every((p) => p.type === 'same')).toBe(true)
  })

  it('detects a single word replacement', () => {
    const parts = wordDiff('the debtor owes 50000 naira', 'the debtor owes 75000 naira')
    expect(hasChanges(parts)).toBe(true)
    expect(parts.some((p) => p.type === 'removed' && p.text === '50000')).toBe(true)
    expect(parts.some((p) => p.type === 'added' && p.text === '75000')).toBe(true)
  })

  it('detects a pure addition', () => {
    const parts = wordDiff('the debtor owes naira', 'the debtor still owes naira')
    expect(parts.some((p) => p.type === 'added' && p.text.includes('still'))).toBe(true)
  })

  it('detects a pure removal', () => {
    const parts = wordDiff('the debtor still owes naira', 'the debtor owes naira')
    expect(parts.some((p) => p.type === 'removed' && p.text.includes('still'))).toBe(true)
  })

  it('rejoining all part text reconstructs the edited version for a pure addition/removal case', () => {
    const original = 'the debtor owes naira'
    const edited = 'the debtor still owes naira'
    const parts = wordDiff(original, edited)
    const reconstructed = parts.filter((p) => p.type !== 'removed').map((p) => p.text).join('')
    expect(reconstructed).toBe(edited)
  })

  it('handles completely empty edited text', () => {
    const parts = wordDiff('some extracted facts here', '')
    expect(hasChanges(parts)).toBe(true)
    expect(parts.every((p) => p.type === 'removed')).toBe(true)
  })

  it('handles completely empty original text', () => {
    const parts = wordDiff('', 'brand new content')
    expect(hasChanges(parts)).toBe(true)
    expect(parts.every((p) => p.type === 'added')).toBe(true)
  })

  it('preserves whitespace/newlines as part of tokens', () => {
    const parts = wordDiff('line one\nline two', 'line one\nline three')
    const reconstructedOriginal = parts.filter((p) => p.type !== 'added').map((p) => p.text).join('')
    expect(reconstructedOriginal).toBe('line one\nline two')
  })
})
