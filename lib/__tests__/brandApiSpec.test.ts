import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { BRAND_API_SPEC } from '../brandApiSpec'

// Every route under app/api/v1/borrowers, as "/borrowers/{id}/letter" etc.
function routePaths(dir: string, prefix: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) found.push(...routePaths(full, `${prefix}/${name.replace(/^\[(.+)\]$/, '{$1}')}`))
    else if (name === 'route.ts') found.push(prefix)
  }
  return found
}

describe('the OpenAPI description', () => {
  it('describes every brand API route, and only those', () => {
    const routes = routePaths(path.resolve(__dirname, '../../app/api/v1/borrowers'), '/borrowers').sort()
    expect(Object.keys(BRAND_API_SPEC.paths).sort()).toEqual(routes)
  })

  it('describes every webhook event the code sends', () => {
    expect(Object.keys(BRAND_API_SPEC.webhooks).sort()).toEqual(
      [
        'borrower.awaiting_decision',
        'borrower.day14_sent',
        'borrower.day7_sent',
        'borrower.lawyer_approved',
        'borrower.letter_drafted',
        'borrower.missing_documents',
        'borrower.outcome',
        'borrower.served',
      ].sort(),
    )
  })

  it('is valid JSON with the parts a code generator needs', () => {
    const json = JSON.parse(JSON.stringify(BRAND_API_SPEC))
    expect(json.openapi).toBe('3.1.0')
    expect(json.components.securitySchemes.bearer.scheme).toBe('bearer')
    expect(Object.keys(json.components.schemas.BorrowerInput.properties)).toContain('amount_outstanding')
  })
})
