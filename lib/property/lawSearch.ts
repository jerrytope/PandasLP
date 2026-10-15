// The law library's interface and its hybrid search, with no database: shared by the Supabase
// library (lib/property/lawLibrary.ts) and the local SQLite one (lib/dev/sqliteLawLibrary.ts),
// so both rank results the same way.

import { fuseRankings, type LawDocument } from './lawLookup'

export interface LawSectionChunk {
  chunk: number
  heading: string | null
  part: string | null
  content: string
}

export interface LawSearchHit {
  slug: string
  title: string
  section: string
  chunk?: number
  heading: string | null
  content: string
}

export interface LawLibrary {
  /** Every law the library knows of, with or without its text. */
  documents(): Promise<LawDocument[]>
  /** The chunks of one section, in order. Empty if there is no such section. */
  section(slug: string, section: string): Promise<LawSectionChunk[]>
  /** Keyword + meaning search over the laws that apply in a state (and all-state laws). Best first. */
  search(query: string, state: string, limit: number): Promise<LawSearchHit[]>
}

/**
 * How the library searches:
 *   meaning  embeddings (gte-small) only, falling back to keywords if the model is unavailable
 *   keyword  full-text search only
 *   hybrid   both, merged with HYBRID_WEIGHTS
 * Chosen by `npm run laws:eval` (15 Oct 2026, 21 client-style questions on the seed): meaning
 * 15/21 right section in the top 3, keyword 8/21, hybrid 13-14/21 at any weighting. Re-run it
 * when laws are added; keywords may earn their place on a bigger library.
 */
export type SearchMode = 'meaning' | 'keyword' | 'hybrid'
export const DEFAULT_SEARCH_MODE: SearchMode = 'meaning'
/** keyword : meaning, for hybrid mode. 1:3 was the best hybrid weighting in the evaluation. */
export const HYBRID_WEIGHTS = [1, 3]

const hitKey = (h: LawSearchHit) => `${h.slug}|${h.section}|${h.chunk ?? 1}`

/**
 * Runs the search(es) for the mode, each asked for more than `limit` so the merge has something
 * to choose from, and returns the top `limit`. Shared by the Supabase and SQLite libraries so
 * both rank the same way. A failed or empty meaning search falls back to keywords.
 */
export async function hybridSearch(opts: {
  limit: number
  mode: SearchMode
  keyword: (n: number) => Promise<LawSearchHit[]>
  vector: ((n: number) => Promise<LawSearchHit[]>) | null
}): Promise<LawSearchHit[]> {
  const pool = Math.max(opts.limit * 3, 10)
  const meaning = async (): Promise<LawSearchHit[]> => {
    if (!opts.vector) return []
    try {
      return await opts.vector(pool)
    } catch (err) {
      console.error('Law library: meaning search unavailable, using keywords:', err instanceof Error ? err.message : err)
      return []
    }
  }

  if (opts.mode === 'keyword') return (await opts.keyword(pool)).slice(0, opts.limit)
  if (opts.mode === 'meaning') {
    const v = await meaning()
    return (v.length ? v : await opts.keyword(pool)).slice(0, opts.limit)
  }
  const [k, v] = await Promise.all([opts.keyword(pool), meaning()])
  const byKey = new Map([...k, ...v].map((h) => [hitKey(h), h]))
  return fuseRankings([k.map(hitKey), v.map(hitKey)], 60, HYBRID_WEIGHTS).slice(0, opts.limit).map((key) => byKey.get(key)!)
}
