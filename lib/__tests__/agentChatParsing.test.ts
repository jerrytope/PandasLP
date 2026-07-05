import { describe, it, expect } from 'vitest'
import { extractDocument, extractOptions, extractClientPhone } from '../agentChatParsing'

describe('extractDocument', () => {
  it('returns the content untouched when there is no document block', () => {
    const result = extractDocument('Just a normal reply, no document here.')
    expect(result.doc).toBeNull()
    expect(result.visible).toBe('Just a normal reply, no document here.')
  })

  it('parses a well-formed document block, including price and price label', () => {
    const content = [
      "Here's your letter — take a look below.",
      '<<<DOCUMENT>>>',
      'TITLE: Letter of Demand — Tunde Bello',
      'PRICE: 10000',
      'PRICE_LABEL: Self-service PDF',
      '---',
      'Dear Sir/Madam,\n\nBody of the letter.',
      '<<<END_DOCUMENT>>>',
    ].join('\n')

    const { visible, doc } = extractDocument(content)
    expect(visible).toBe("Here's your letter — take a look below.")
    expect(doc).toEqual({
      title: 'Letter of Demand — Tunde Bello',
      body: 'Dear Sir/Madam,\n\nBody of the letter.',
      price: 10000,
      priceLabel: 'Self-service PDF',
    })
  })

  it('falls back to a generic intro when the model omits one', () => {
    const content = [
      '<<<DOCUMENT>>>',
      'TITLE: Notice to Quit',
      '---',
      'Body text.',
      '<<<END_DOCUMENT>>>',
    ].join('\n')

    const { visible, doc } = extractDocument(content)
    expect(visible).toBe('Here is your drafted document — review it in the panel below.')
    expect(doc?.price).toBeUndefined()
    expect(doc?.priceLabel).toBeUndefined()
  })

  it('treats a non-numeric PRICE as absent rather than crashing', () => {
    const content = [
      '<<<DOCUMENT>>>',
      'TITLE: Some Document',
      'PRICE: TBD',
      '---',
      'Body.',
      '<<<END_DOCUMENT>>>',
    ].join('\n')

    const { doc } = extractDocument(content)
    expect(doc?.price).toBeUndefined()
  })
})

describe('extractOptions', () => {
  it('returns no options and the original text when there is no options block', () => {
    const result = extractOptions('Just a normal question, no buttons.')
    expect(result.options).toEqual([])
    expect(result.visible).toBe('Just a normal question, no buttons.')
  })

  it('parses each line of an options block into a separate option', () => {
    const content = [
      'How would you like this delivered?',
      '<<<OPTIONS>>>',
      "₦10,000 — I'll deliver the letter myself",
      '₦25,000 — Pandas LP serves it on my behalf',
      '<<<END_OPTIONS>>>',
    ].join('\n')

    const { visible, options } = extractOptions(content)
    expect(visible).toBe('How would you like this delivered?')
    expect(options).toEqual([
      "₦10,000 — I'll deliver the letter myself",
      '₦25,000 — Pandas LP serves it on my behalf',
    ])
  })

  it('drops blank lines inside the options block', () => {
    const content = ['<<<OPTIONS>>>', 'Yes', '', 'No', '<<<END_OPTIONS>>>'].join('\n')
    const { options } = extractOptions(content)
    expect(options).toEqual(['Yes', 'No'])
  })
})

describe('extractClientPhone', () => {
  it('returns null and the original text when there is no phone block', () => {
    const result = extractClientPhone('Just a normal reply, no phone number here.')
    expect(result.phone).toBeNull()
    expect(result.visible).toBe('Just a normal reply, no phone number here.')
  })

  it('extracts the phone number and strips the block from the visible text', () => {
    const content = [
      'Got it — a lawyer will call you once payment is confirmed.',
      '<<<CLIENT_PHONE>>>',
      '+234 811 234 5678',
      '<<<END_CLIENT_PHONE>>>',
    ].join('\n')

    const { visible, phone } = extractClientPhone(content)
    expect(phone).toBe('+234 811 234 5678')
    expect(visible).toBe('Got it — a lawyer will call you once payment is confirmed.')
  })

  it('treats an empty block as no phone number', () => {
    const content = ['<<<CLIENT_PHONE>>>', '', '<<<END_CLIENT_PHONE>>>'].join('\n')
    const { phone } = extractClientPhone(content)
    expect(phone).toBeNull()
  })
})
