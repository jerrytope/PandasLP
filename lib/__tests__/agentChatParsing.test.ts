import { describe, it, expect } from 'vitest'
import { extractDocument, extractOptions, extractClientPhone, extractClientEmail, extractRecipientPhone, extractCounterFacts } from '../agentChatParsing'

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

describe('extractClientEmail', () => {
  it('returns null and the original text when there is no email block', () => {
    const result = extractClientEmail('Just a normal reply, no email here.')
    expect(result.email).toBeNull()
    expect(result.visible).toBe('Just a normal reply, no email here.')
  })

  it('extracts the email and strips the block from the visible text', () => {
    const content = [
      "Got it — I'll use that to send the client their reviewed letter.",
      '<<<CLIENT_EMAIL>>>',
      'client@example.com',
      '<<<END_CLIENT_EMAIL>>>',
    ].join('\n')

    const { visible, email } = extractClientEmail(content)
    expect(email).toBe('client@example.com')
    expect(visible).toBe("Got it — I'll use that to send the client their reviewed letter.")
  })

  it('treats an empty block as no email', () => {
    const content = ['<<<CLIENT_EMAIL>>>', '', '<<<END_CLIENT_EMAIL>>>'].join('\n')
    const { email } = extractClientEmail(content)
    expect(email).toBeNull()
  })
})

describe('extractRecipientPhone', () => {
  it('returns null and the original text when there is no recipient-phone block', () => {
    const result = extractRecipientPhone('Just a normal reply, no phone number here.')
    expect(result.phone).toBeNull()
    expect(result.visible).toBe('Just a normal reply, no phone number here.')
  })

  it('extracts the debtor phone and strips the block from the visible text', () => {
    const content = [
      "Got it — we'll serve the letter to that number.",
      '<<<RECIPIENT_PHONE>>>',
      '+234 802 111 2222',
      '<<<END_RECIPIENT_PHONE>>>',
    ].join('\n')

    const { visible, phone } = extractRecipientPhone(content)
    expect(phone).toBe('+234 802 111 2222')
    expect(visible).toBe("Got it — we'll serve the letter to that number.")
  })

  it('treats an empty block as no phone number', () => {
    const content = ['<<<RECIPIENT_PHONE>>>', '', '<<<END_RECIPIENT_PHONE>>>'].join('\n')
    const { phone } = extractRecipientPhone(content)
    expect(phone).toBeNull()
  })

  it('is distinct from extractClientPhone — a message with only a CLIENT_PHONE block has no recipient phone', () => {
    const content = ['<<<CLIENT_PHONE>>>', '+234 811 000 0000', '<<<END_CLIENT_PHONE>>>'].join('\n')
    expect(extractRecipientPhone(content).phone).toBeNull()
  })
})

describe('extractDocument — PRICE: 0 means "invoiced by the firm"', () => {
  // The transfer-of-title path emits PRICE: 0 to say there is nothing to collect online,
  // because the 2.5% is invoiced directly. AgentChat distinguishes that from a missing
  // PRICE line with `draftDoc?.price === 0`, so 0 has to survive parsing as the number 0
  // and NOT collapse to undefined. If it ever did, `price ?? amount` would fall back to the
  // agent's standard fee and quietly put a Paystack form in front of a deed.
  it('parses PRICE: 0 as the number 0, not undefined', () => {
    const { doc } = extractDocument(
      '<<<DOCUMENT>>>\nTITLE: Deed of Assignment\nPRICE: 0\nPRICE_LABEL: Pandas LP will invoice you 2.5%\n---\nTHIS DEED OF ASSIGNMENT is made...\n<<<END_DOCUMENT>>>',
    )
    expect(doc).not.toBeNull()
    expect(doc!.price).toBe(0)
    expect(doc!.price).not.toBeUndefined()
  })

  it('still leaves price undefined when no PRICE line is given', () => {
    const { doc } = extractDocument(
      '<<<DOCUMENT>>>\nTITLE: Notice to Quit\n---\nTAKE NOTICE that you are required...\n<<<END_DOCUMENT>>>',
    )
    expect(doc).not.toBeNull()
    expect(doc!.price).toBeUndefined()
  })
})

describe('extractCounterFacts', () => {
  it('returns null when there is no counter-extract block', () => {
    expect(extractCounterFacts('Just a normal reply, no extraction block here.')).toBeNull()
  })

  it('parses a well-formed extraction, including a multi-line summary', () => {
    const content = [
      '<<<COUNTER_EXTRACT>>>',
      'COUNSEL_NAME: Chidi Okafor, Okafor & Associates',
      'PROPOSED_AMOUNT: 650000',
      'SUMMARY:',
      'Disputes ₦200,000 of the claim as already paid.',
      'Offers ₦650,000 in full and final settlement.',
      '<<<END_COUNTER_EXTRACT>>>',
    ].join('\n')

    const facts = extractCounterFacts(content)
    expect(facts).toEqual({
      counselName: 'Chidi Okafor, Okafor & Associates',
      proposedAmount: 650000,
      summary: 'Disputes ₦200,000 of the claim as already paid.\nOffers ₦650,000 in full and final settlement.',
    })
  })

  it('treats "unknown" and "none" as honest absences, not literal values', () => {
    const content = [
      '<<<COUNTER_EXTRACT>>>',
      'COUNSEL_NAME: unknown',
      'PROPOSED_AMOUNT: none',
      'SUMMARY:',
      'A brief letter acknowledging receipt and requesting two more weeks to respond.',
      '<<<END_COUNTER_EXTRACT>>>',
    ].join('\n')

    const facts = extractCounterFacts(content)
    expect(facts?.counselName).toBeNull()
    expect(facts?.proposedAmount).toBeNull()
    expect(facts?.summary).toContain('two more weeks')
  })

  it('strips commas and the naira sign from the figure before parsing it', () => {
    const content = [
      '<<<COUNTER_EXTRACT>>>',
      'COUNSEL_NAME: unknown',
      'PROPOSED_AMOUNT: ₦1,250,000',
      'SUMMARY:',
      'Counter-offer.',
      '<<<END_COUNTER_EXTRACT>>>',
    ].join('\n')

    expect(extractCounterFacts(content)?.proposedAmount).toBe(1250000)
  })
})
