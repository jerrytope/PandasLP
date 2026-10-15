// Web search for laws whose text is not in the law library yet (docs/property_agent_plans/
// phase-3-law-library.md, step 3). Our own tool, not a model's built-in search, so the same
// rules hold whichever model runs: only trusted law sites, results checked against that list in
// code, raw excerpts (not a model's summary), every search logged, and nothing found on the web
// ever cited by section in a document.

export interface WebResult {
  title: string
  url: string
  content: string
}

export interface WebSearcher {
  /** Searches only `includeDomains` (and their subdomains). */
  search(query: string, opts: { includeDomains: string[]; maxResults: number }): Promise<WebResult[]>
}

/**
 * The sites the agent may search. PROPOSED, FOR THE LAWYER TO APPROVE: prune or add here.
 *   confirmed  the law library seed's own source for the federal laws
 *   to-check   likely good; check they publish the actual text of laws
 */
export const TRUSTED_LAW_SITES: { domain: string; what: string; status: 'confirmed' | 'to-check' }[] = [
  { domain: 'placng.org', what: 'PLAC, Laws of the Federation of Nigeria', status: 'confirmed' },
  { domain: 'nigerialii.org', what: 'Nigeria Legal Information Institute: legislation and judgments', status: 'to-check' },
  { domain: 'lawnigeria.com', what: 'LawNigeria: federal and some state statutes', status: 'to-check' },
  { domain: 'lagosstate.gov.ng', what: 'Lagos State Government, including the Ministry of Justice', status: 'to-check' },
  { domain: 'fcta.gov.ng', what: 'Federal Capital Territory Administration', status: 'to-check' },
  { domain: 'oyostate.gov.ng', what: 'Oyo State Government', status: 'to-check' },
  { domain: 'ogunstate.gov.ng', what: 'Ogun State Government', status: 'to-check' },
  { domain: 'ondostate.gov.ng', what: 'Ondo State Government', status: 'to-check' },
  { domain: 'osunstate.gov.ng', what: 'Osun State Government', status: 'to-check' },
  { domain: 'ekitistate.gov.ng', what: 'Ekiti State Government', status: 'to-check' },
  { domain: 'edostate.gov.ng', what: 'Edo State Government', status: 'to-check' },
  { domain: 'deltastate.gov.ng', what: 'Delta State Government', status: 'to-check' },
  { domain: 'anambrastate.gov.ng', what: 'Anambra State Government', status: 'to-check' },
  { domain: 'enugustate.gov.ng', what: 'Enugu State Government', status: 'to-check' },
  { domain: 'crossriverstate.gov.ng', what: 'Cross River State Government', status: 'to-check' },
]

export const TRUSTED_DOMAINS = TRUSTED_LAW_SITES.map((s) => s.domain)

/** The trusted site a URL belongs to (the domain or a subdomain of it), or null. https only. */
export function trustedSite(url: string, domains: string[] = TRUSTED_DOMAINS): string | null {
  let host: string
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    host = u.hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
  return domains.find((d) => host === d || host.endsWith(`.${d}`)) ?? null
}

/** Tavily (https://docs.tavily.com): 1 credit per basic search. */
export function tavilySearcher(apiKey: string): WebSearcher {
  return {
    async search(query, opts) {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          query,
          search_depth: 'basic',
          topic: 'general',
          country: 'nigeria',
          max_results: opts.maxResults,
          include_domains: opts.includeDomains,
          include_answer: false,
          include_raw_content: false,
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) throw new Error(`Tavily returned ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] }
      return (data.results ?? [])
        .filter((r) => typeof r.url === 'string')
        .map((r) => ({ title: r.title ?? '', url: r.url!, content: r.content ?? '' }))
    },
  }
}

/** The searcher configured for this server, or null when no search key is set. */
export function configuredWebSearcher(env: Record<string, string | undefined> = process.env): WebSearcher | null {
  const key = env.TAVILY_API_KEY?.trim()
  return key ? tavilySearcher(key) : null
}
