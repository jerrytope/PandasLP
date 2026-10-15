// search_law_web: the fallback when the law library doesn't have a law's text. Searches only the
// trusted law sites (lib/property/webSearch.ts), drops any result from elsewhere, returns raw
// excerpts marked UNVERIFIED, logs every search, and adds nothing to what a document may cite.

import type { AgentTool } from '../../agentRuntime/types'
import { TRUSTED_DOMAINS, trustedSite } from '../webSearch'
import type { PropertyToolContext } from './context'
import { requireString } from './context'

export const MAX_WEB_SEARCHES_PER_TURN = 3
const MAX_RESULTS = 5
const MAX_EXCERPT_CHARS = 800

export const searchLawWeb: AgentTool<PropertyToolContext> = {
  definition: {
    name: 'search_law_web',
    description: "Searches trusted Nigerian law websites, ONLY for a law whose text is not in the firm's law library (get_section or lookup_law said it is not in yet, or found nothing relevant). Results are UNVERIFIED: use them to explain, say a Pandas LP lawyer will verify, and never cite their sections in a document. At most 3 searches per turn.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name the law and the point, e.g. "Recovery of Premises Act FCT notice to quit tenant at will".' },
      },
      required: ['query'],
    },
  },
  handler: async (input, ctx) => {
    if (!ctx.webSearch) return { ok: false, error: 'Web search is not available. Name the law without section numbers, and escalate if the matter turns on its exact wording.' }
    ctx.webSearches = (ctx.webSearches ?? 0) + 1
    if (ctx.webSearches > MAX_WEB_SEARCHES_PER_TURN) {
      return { ok: false, error: `No more web searches this turn (limit ${MAX_WEB_SEARCHES_PER_TURN}). Work with what you have, or escalate.` }
    }
    const query = requireString(input, 'query', 300)

    let found
    try {
      found = await ctx.webSearch.search(query, { includeDomains: TRUSTED_DOMAINS, maxResults: MAX_RESULTS })
    } catch (err) {
      console.error('search_law_web failed:', err instanceof Error ? err.message : err)
      return { ok: false, error: 'The web search failed. Do not retry; name the law without section numbers, or escalate.' }
    }
    // The search service is asked for trusted sites only; this makes sure of it.
    const results = found
      .map((r) => ({ ...r, site: trustedSite(r.url) }))
      .filter((r): r is typeof r & { site: string } => r.site !== null)
      .map((r) => ({
        title: r.title,
        url: r.url,
        site: r.site,
        excerpt: r.content.length > MAX_EXCERPT_CHARS ? `${r.content.slice(0, MAX_EXCERPT_CHARS)}…` : r.content,
      }))

    await ctx.store.logEvent(ctx.caseId, 'web_search', {
      query,
      results: results.map((r) => ({ title: r.title, url: r.url })),
      dropped: found.length - results.length,
    })

    return {
      ok: true,
      result: {
        status: 'UNVERIFIED',
        results,
        guidance: results.length
          ? 'Unverified text from the web. You may explain what it appears to say, naming the site, and tell the client a Pandas LP lawyer will verify it. Do not quote a section number from it in any document. If the matter turns on its exact wording, escalate.'
          : 'Nothing found on the trusted sites. Do not guess what the law says: name it without section numbers, or escalate.',
      },
    }
  },
}
