import { describe, it, expect } from 'vitest'
import { AGENTS } from '../agents'

// Regression guard for the exact defect a claude-council review found: the Deed of
// Assignment template had an explicit Governor's Consent clause that the Deed of Gift and
// Deed of Legal Mortgage templates (added later, from a different source document) lacked,
// even though Land Use Act s.22 applies to all three. This test encodes a required-clause
// manifest per document template so a future edit can't silently reintroduce that class of
// gap — it's a structural (string-presence) check, not a legal-correctness one; it cannot
// verify the clause is legally right, only that nobody forgot to include it.

const systemPrompt = AGENTS['recovery-of-premises'].systemPrompt

function extractTemplates(prompt: string): Map<string, string> {
  const templates = new Map<string, string>()
  const re = /DOCUMENT TEMPLATE — ([^:(]+)[:(][^\n]*\n+---TEMPLATE START---([\s\S]*?)---TEMPLATE END---/g
  let match: RegExpExecArray | null
  while ((match = re.exec(prompt)) !== null) {
    templates.set(match[1].trim(), match[2])
  }
  return templates
}

const templates = extractTemplates(systemPrompt)

const ALL_TEMPLATE_NAMES = [
  'NOTICE TO QUIT',
  "SEVEN DAYS' NOTICE",
  'TENANCY AGREEMENT',
  'DEED OF ASSIGNMENT',
  'DEED OF GIFT',
  'POWER OF ATTORNEY',
  'DEED OF LEGAL MORTGAGE',
  'AGREEMENT FOR SALE OF LAND',
  'PROPERTY SEARCH REPORT',
]

// Documents that transfer or charge an interest in land under a right of occupancy — these
// require Governor's Consent under Land Use Act s.22. Notices, tenancy agreements, POAs, and
// search reports do not transfer/charge title themselves, so they're correctly excluded.
const REQUIRES_GOVERNORS_CONSENT_CLAUSE = ['DEED OF ASSIGNMENT', 'DEED OF GIFT', 'DEED OF LEGAL MORTGAGE']

const DEED_TEMPLATES_NEEDING_EXECUTION_BLOCK = [
  'TENANCY AGREEMENT',
  'DEED OF ASSIGNMENT',
  'DEED OF GIFT',
  'DEED OF LEGAL MORTGAGE',
  'AGREEMENT FOR SALE OF LAND',
]

describe('Property Law Agent — template extraction', () => {
  it('finds all nine document templates', () => {
    for (const name of ALL_TEMPLATE_NAMES) {
      expect(templates.has(name), `missing template: ${name}`).toBe(true)
    }
    expect(templates.size).toBe(ALL_TEMPLATE_NAMES.length)
  })
})

describe('Property Law Agent — Governor\'s Consent clause manifest', () => {
  for (const name of REQUIRES_GOVERNORS_CONSENT_CLAUSE) {
    it(`${name} includes a Governor's Consent / Land Use Act s.22 clause`, () => {
      const body = templates.get(name)
      expect(body, `template not found: ${name}`).toBeDefined()
      expect(body).toMatch(/Governor's Consent/i)
      expect(body).toMatch(/Section 22/)
    })
  }

  it('Agreement for Sale of Land includes a Governor\'s Consent undertaking', () => {
    const body = templates.get('AGREEMENT FOR SALE OF LAND')
    expect(body).toMatch(/Governor's Consent/i)
  })
})

describe('Property Law Agent — Deed of Gift must not carry a price', () => {
  it('has no consideration/price placeholder in the operative clause', () => {
    const body = templates.get('DEED OF GIFT')!
    expect(body).not.toMatch(/\[CONSIDERATION\]/)
    expect(body).toMatch(/natural love and affection/i)
  })
})

describe('Property Law Agent — execution block consistency', () => {
  for (const name of DEED_TEMPLATES_NEEDING_EXECUTION_BLOCK) {
    it(`${name} defers to the shared EXECUTION BLOCKS section rather than a hardcoded signature block`, () => {
      const body = templates.get(name)!
      expect(body).toMatch(/EXECUTION BLOCK/)
    })
  }
})

describe('Property Law Agent — archaic drafting patterns do not regress', () => {
  it('no template body uses "WITNESSETH" (modern drafting drops it — see DRAFTING STANDARDS)', () => {
    for (const [name, body] of templates) {
      expect(body, `${name} contains WITNESSETH`).not.toMatch(/WITNESSETH/)
    }
  })

  it('no template body prefixes the testatum with "NOW THIS" (see DRAFTING STANDARDS)', () => {
    for (const [name, body] of templates) {
      expect(body, `${name} contains "NOW THIS"`).not.toMatch(/NOW THIS/)
    }
  })

  it('no template body uses "situated at" (house style is "situate at")', () => {
    for (const [name, body] of templates) {
      expect(body, `${name} contains "situated at"`).not.toMatch(/situated at/i)
    }
  })

  it('no template body prefixes an execution clause with "the within-named" outside the POA exception', () => {
    for (const [name, body] of templates) {
      if (name === 'POWER OF ATTORNEY') continue // POA execution intentionally omits this phrase in its own template; the exception lives in the shared guidance for OTHER deeds executed under a POA, not in this template itself.
      expect(body, `${name} contains "the within-named"`).not.toMatch(/the within-named/i)
    }
  })
})

describe('Property Law Agent — Power of Attorney vagueness guard', () => {
  it('the shared prompt explicitly forbids a vague "to manage" power', () => {
    expect(systemPrompt).toMatch(/never accept or draft a vague power like "to manage/i)
  })
})
