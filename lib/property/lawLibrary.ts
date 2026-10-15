// The law library (add-law-library.sql) as the property tools see it. The tools take a
// LawLibrary rather than calling the database, so they are tested against the real seed in
// SQLite (lib/dev/sqliteLawLibrary.ts) without Supabase.

import { supabaseAdmin } from '../supabaseAdmin'
import { orQueryTerms, toLawDocument, type DocRow, type LawDocument } from './lawLookup'

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
  heading: string | null
  content: string
}

export interface LawLibrary {
  /** Every law the library knows of, with or without its text. */
  documents(): Promise<LawDocument[]>
  /** The chunks of one section, in order. Empty if there is no such section. */
  section(slug: string, section: string): Promise<LawSectionChunk[]>
  /** Keyword search over the laws that apply in a state (and all-state laws). Best first. */
  search(query: string, state: string, limit: number): Promise<LawSearchHit[]>
}

const DOCS_TTL_MS = 10 * 60 * 1000
let docsCache: { at: number; docs: LawDocument[] } | null = null

/** The library in Supabase (service role). The document list is cached for 10 minutes. */
export const supabaseLawLibrary: LawLibrary = {
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
    if (!terms.length) return []
    const { data, error } = await supabaseAdmin.rpc('search_law_sections', { p_query: terms.join(' | '), p_state: state, p_limit: limit })
    if (error) throw new Error(`Law library: search failed: ${error.message}`)
    return ((data ?? []) as LawSearchHit[]).map((r) => ({ slug: r.slug, title: r.title, section: r.section, heading: r.heading, content: r.content }))
  },
}
