import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { SqliteMatterRepo } from '../dev/sqliteMatterRepo'
import { SHARED_PROPERTY_TOOLS, type PropertyToolContext } from '../property/tools'
import { configuredWebSearcher, tavilySearcher, TRUSTED_DOMAINS, trustedSite, type WebSearcher } from '../property/webSearch'

describe('trusted law sites', () => {
  it('accepts a trusted domain and its subdomains', () => {
    expect(trustedSite('https://placng.org/lawsofnigeria/print.php?sn=228')).toBe('placng.org')
    expect(trustedSite('https://lawsofnigeria.placng.org/laws/L5.pdf')).toBe('placng.org')
    expect(trustedSite('https://moj.lagosstate.gov.ng/laws')).toBe('lagosstate.gov.ng')
  })

  it('rejects everything else, including lookalikes', () => {
    expect(trustedSite('https://placng.org.evil.com/x')).toBeNull()
    expect(trustedSite('https://notplacng.org/x')).toBeNull()
    expect(trustedSite('https://some-law-blog.com/land-use-act')).toBeNull()
    expect(trustedSite('ftp://placng.org/x')).toBeNull()
    expect(trustedSite('not a url')).toBeNull()
  })
})

describe('tavilySearcher', () => {
  it('asks Tavily for the trusted domains only, with the key as a bearer token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [{ title: 'Land Use Act', url: 'https://placng.org/x', content: 'Section 22...' }] })),
    )
    try {
      const results = await tavilySearcher('tvly-test').search('land use act consent', { includeDomains: ['placng.org'], maxResults: 5 })
      expect(results).toEqual([{ title: 'Land Use Act', url: 'https://placng.org/x', content: 'Section 22...' }])
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.tavily.com/search')
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer tvly-test')
      expect(JSON.parse(String(init.body))).toMatchObject({ query: 'land use act consent', include_domains: ['placng.org'], max_results: 5, include_answer: false })
    } finally {
      fetchMock.mockRestore()
    }
  })

  it('is only configured when TAVILY_API_KEY is set', () => {
    expect(configuredWebSearcher({})).toBeNull()
    expect(configuredWebSearcher({ TAVILY_API_KEY: ' ' })).toBeNull()
    expect(configuredWebSearcher({ TAVILY_API_KEY: 'tvly-x' })).not.toBeNull()
  })
})

describe('search_law_web', () => {
  const tool = SHARED_PROPERTY_TOOLS.find((t) => t.definition.name === 'search_law_web')!

  function setup(webSearch: WebSearcher | null) {
    const repo = new SqliteMatterRepo()
    const caseId = repo.createCase()
    const ctx: PropertyToolContext = { caseId, area: 'recovery', store: repo, emitted: [], webSearch, citable: new Set() }
    const run = async (query = 'Recovery of Premises Act FCT tenant at will') => {
      await repo.getOrCreateMatter(caseId)
      return tool.handler({ query }, ctx)
    }
    return { repo, caseId, ctx, run }
  }

  it('says it is unavailable without a search service', async () => {
    expect(await setup(null).run()).toMatchObject({ ok: false, error: expect.stringMatching(/not available/) })
  })

  it('returns unverified excerpts from trusted sites only, and logs the search', async () => {
    let asked: string[] = []
    const searcher: WebSearcher = {
      async search(_q, opts) {
        asked = opts.includeDomains
        return [
          { title: 'Recovery of Premises Act', url: 'https://nigerialii.org/act/rpa', content: 'A tenant at will is entitled to one week...' },
          { title: 'Blog post', url: 'https://some-law-blog.com/rpa', content: 'Our take...' },
        ]
      },
    }
    const { run, repo, caseId, ctx } = setup(searcher)
    const out = await run()
    expect(asked).toEqual(TRUSTED_DOMAINS)
    expect(out).toMatchObject({ ok: true, result: { status: 'UNVERIFIED', results: [{ site: 'nigerialii.org', url: 'https://nigerialii.org/act/rpa' }] } })
    expect((out as { result: { results: unknown[] } }).result.results).toHaveLength(1)
    expect(await repo.events(caseId, 'web_search')).toMatchObject([{ payload: { dropped: 1, results: [{ url: 'https://nigerialii.org/act/rpa' }] } }])
    // Nothing found on the web becomes citable in a document.
    expect(ctx.citable?.size).toBe(0)
  })

  it('allows at most 3 searches in a turn', async () => {
    const { run } = setup({ search: async () => [] })
    for (let i = 0; i < 3; i++) expect(await run()).toMatchObject({ ok: true })
    expect(await run()).toMatchObject({ ok: false, error: expect.stringMatching(/limit 3/) })
  })

  it('reports a failed search without throwing', async () => {
    const { run } = setup({ search: async () => { throw new Error('Tavily returned 500') } })
    expect(await run()).toMatchObject({ ok: false, error: expect.stringMatching(/failed/) })
  })
})
