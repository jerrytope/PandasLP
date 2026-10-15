// The law library (add-law-library.sql) as the property tools see it. The tools take a
// LawLibrary rather than calling the database, so they are tested against the real seed in
// SQLite (lib/dev/sqliteLawLibrary.ts) without Supabase.
//
// Search is by meaning (embeddings, lib/property/embeddings.ts), falling back to keywords if the
// embedding model can't be loaded; see SearchMode in lib/property/lawSearch.ts for why.

import { supabaseAdmin } from '../supabaseAdmin'
import { gteSmallEmbedder, type Embedder } from './embeddings'
import { orQueryTerms, toLawDocument, type DocRow, type LawDocument } from './lawLookup'
import { DEFAULT_SEARCH_MODE, hybridSearch, type LawLibrary, type LawSearchHit, type LawSectionChunk, type SearchMode } from './lawSearch'

export type { LawLibrary, LawSearchHit, LawSectionChunk, SearchMode } from './lawSearch'

const DOCS_TTL_MS = 10 * 60 * 1000

/**
 * The library in Supabase (service role). The document list is cached for 10 minutes.
 * `embed` null = keyword search only (also LAW_VECTOR_SEARCH=off).
 */
export function createSupabaseLawLibrary(opts: { embed: Embedder | null; mode?: SearchMode }): LawLibrary {
  let docsCache: { at: number; docs: LawDocument[] } | null = null
  const mode = opts.mode ?? DEFAULT_SEARCH_MODE

  return {
    async documents() {
      if (docsCache && Date.now() - docsCache.at < DOCS_TTL_MS) return docsCache.docs
      const { data, error } = await supabaseAdmin
        .from('law_documents')
        .select('slug, title, citation, state, applies_in, status, source_name, source_url, retrieved_on, notes, topics')
      if (error) throw new Error(`Law library: could not list laws: ${error.message}`)
      docsCache = { at: Date.now(), docs: (data as DocRow[]).map(toLawDocument) }
      return docsCache.docs
    },

    async section(slug, section) {
      const { data: doc, error: docErr } = await supabaseAdmin.from('law_documents').select('id').eq('slug', slug).maybeSingle()
      if (docErr) throw new Error(`Law library: ${docErr.message}`)
      if (!doc) return []
      const { data, error } = await supabaseAdmin
        .from('law_sections')
        .select('chunk, heading, part, content')
        .eq('document_id', doc.id)
        .eq('section', section)
        .order('chunk', { ascending: true })
      if (error) throw new Error(`Law library: could not read the section: ${error.message}`)
      return (data ?? []) as LawSectionChunk[]
    },

    async search(query, state, limit) {
      const terms = orQueryTerms(query)
      const toHit = (r: LawSearchHit): LawSearchHit => ({ slug: r.slug, title: r.title, section: r.section, chunk: r.chunk, heading: r.heading, content: r.content })
      return hybridSearch({
        limit,
        mode,
        keyword: async (n) => {
          if (!terms.length) return []
          const { data, error } = await supabaseAdmin.rpc('search_law_sections', { p_query: terms.join(' | '), p_state: state, p_limit: n })
          if (error) throw new Error(`Law library: search failed: ${error.message}`)
          return ((data ?? []) as LawSearchHit[]).map(toHit)
        },
        vector: opts.embed
          ? async (n) => {
              const embedding = await opts.embed!(query)
              const { data, error } = await supabaseAdmin.rpc('match_law_sections', { p_embedding: JSON.stringify(embedding), p_state: state, p_limit: n })
              if (error) throw new Error(`match_law_sections: ${error.message}`)
              return ((data ?? []) as LawSearchHit[]).map(toHit)
            }
          : null,
      })
    },
  }
}

/** The production library: meaning search with gte-small, or keywords only with LAW_VECTOR_SEARCH=off. */
export const supabaseLawLibrary: LawLibrary = createSupabaseLawLibrary({
  embed: process.env.LAW_VECTOR_SEARCH === 'off' ? null : gteSmallEmbedder(),
})
