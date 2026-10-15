// LOCAL TESTING ONLY. The law library on SQLite (node:sqlite, FTS5 with Porter stemming),
// loaded from the same seed file Supabase is filled from (docs/pandaslp-law-library-seed.sql),
// so the law tools are tested against the real statute text without a database or an API.
// Never imported by the app.

import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { orQueryTerms, toLawDocument, type DocRow, type LawDocument } from '../property/lawLookup'
import type { Embedder } from '../property/embeddings'
import { DEFAULT_SEARCH_MODE, hybridSearch, type LawLibrary, type LawSearchHit, type LawSectionChunk, type SearchMode } from '../property/lawSearch'

type Value = string | number | null

/** Reads one VALUES tuple: 'text' (with '' escapes), $tag$text$tag$, numbers, null. */
function parseTuple(src: string, start: number): { values: Value[]; end: number } {
  const values: Value[] = []
  let i = start
  const skip = () => { while (/\s|,/.test(src[i])) i++ }
  if (src[i] !== '(') throw new Error(`Expected "(" at ${i}`)
  i++
  for (;;) {
    skip()
    if (src[i] === ')') return { values, end: i + 1 }
    if (src[i] === "'") {
      let out = ''
      i++
      for (;;) {
        if (src[i] === "'" && src[i + 1] === "'") { out += "'"; i += 2; continue }
        if (src[i] === "'") { i++; break }
        out += src[i++]
      }
      values.push(out)
    } else if (src[i] === '$') {
      const tag = src.slice(i, src.indexOf('$', i + 1) + 1)
      const close = src.indexOf(tag, i + tag.length)
      values.push(src.slice(i + tag.length, close))
      i = close + tag.length
    } else {
      const m = src.slice(i).match(/^(null|-?\d+(?:\.\d+)?)/i)
      if (!m) throw new Error(`Unexpected value at ${i}: ${src.slice(i, i + 30)}`)
      values.push(m[1].toLowerCase() === 'null' ? null : Number(m[1]))
      i += m[1].length
    }
  }
}

/** Postgres array literal '{"a","b"}' → ['a', 'b']. */
function parseArray(v: Value): string[] {
  if (typeof v !== 'string') return []
  return (v.match(/"((?:[^"\\]|\\.)*)"|[^{},\s]+/g) ?? []).map((s) => s.replace(/^"|"$/g, ''))
}

export interface ParsedSeed {
  documents: (Record<string, Value>)[]
  sections: (Record<string, Value>)[]
}

/** Parses the law library seed SQL into rows. */
export function parseLawSeed(sql: string): ParsedSeed {
  const out: ParsedSeed = { documents: [], sections: [] }
  const re = /insert into public\.(law_documents|law_sections) \(([^)]*)\) values /g
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    const columns = m[2].split(',').map((c) => c.trim())
    const { values, end } = parseTuple(sql, re.lastIndex)
    re.lastIndex = end
    const row = Object.fromEntries(columns.map((c, i) => [c, values[i]]))
    ;(m[1] === 'law_documents' ? out.documents : out.sections).push(row)
  }
  return out
}

/** One section's stored embedding, with what a search hit needs. */
interface VectorRow {
  hit: LawSearchHit
  state: string
  status: string
  vector: Float32Array
}

export class SqliteLawLibrary implements LawLibrary {
  readonly db = new DatabaseSync(':memory:')
  private readonly vectors: VectorRow[] = []
  private readonly embed: Embedder | null
  private readonly mode: SearchMode

  /** `embed` turns the question into a vector (gte-small); null = keyword search only. */
  constructor(seed: ParsedSeed, opts: { embed?: Embedder | null; mode?: SearchMode } = {}) {
    this.embed = opts.embed ?? null
    this.mode = opts.mode ?? DEFAULT_SEARCH_MODE
    this.db.exec(`
      CREATE TABLE law_documents (id TEXT PRIMARY KEY, slug TEXT UNIQUE, title TEXT, citation TEXT, state TEXT, applies_in TEXT,
        status TEXT, source_name TEXT, source_url TEXT, retrieved_on TEXT, notes TEXT, topics TEXT);
      CREATE TABLE law_sections (id INTEGER PRIMARY KEY, document_id TEXT, section TEXT, chunk INTEGER, heading TEXT, part TEXT, content TEXT);
      CREATE VIRTUAL TABLE law_fts USING fts5(heading, content, content='law_sections', content_rowid='id', tokenize='porter unicode61');
    `)
    const doc = this.db.prepare('INSERT INTO law_documents VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    for (const d of seed.documents) {
      doc.run(d.id, d.slug, d.title, d.citation, d.state, d.applies_in, d.status, d.source_name, d.source_url, d.retrieved_on, d.notes, JSON.stringify(parseArray(d.topics)))
    }
    const sec = this.db.prepare('INSERT INTO law_sections (document_id, section, chunk, heading, part, content) VALUES (?,?,?,?,?,?)')
    for (const s of seed.sections) sec.run(s.document_id, s.section, s.chunk ?? 1, s.heading, s.part, s.content)
    this.db.exec("INSERT INTO law_fts(law_fts) VALUES ('rebuild')")

    // The seed's embeddings, kept in memory for meaning search (cosine = dot product: they are normalised).
    const docsById = new Map(seed.documents.map((d) => [d.id, d]))
    for (const s of seed.sections) {
      const d = docsById.get(s.document_id)
      if (!d || typeof s.embedding !== 'string') continue
      this.vectors.push({
        hit: { slug: String(d.slug), title: String(d.title), section: String(s.section), chunk: Number(s.chunk ?? 1), heading: (s.heading as string | null) ?? null, content: String(s.content) },
        state: String(d.state),
        status: String(d.status),
        vector: Float32Array.from(s.embedding.replace(/[[\]]/g, '').split(',').map(Number)),
      })
    }
  }

  static fromFile(path: string, opts: { embed?: Embedder | null; mode?: SearchMode } = {}): SqliteLawLibrary {
    return new SqliteLawLibrary(parseLawSeed(readFileSync(path, 'utf8')), opts)
  }

  /** The sections closest in meaning to a question vector, among the laws that apply in the state. */
  nearest(query: ArrayLike<number>, state: string, n: number): LawSearchHit[] {
    const scored: { hit: LawSearchHit; score: number }[] = []
    for (const row of this.vectors) {
      if (row.status !== 'ingested' || (row.state !== 'All states' && row.state !== state)) continue
      let dot = 0
      for (let i = 0; i < row.vector.length; i++) dot += row.vector[i] * query[i]
      scored.push({ hit: row.hit, score: dot })
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, n).map((s) => s.hit)
  }

  async documents(): Promise<LawDocument[]> {
    const rows = this.db.prepare('SELECT * FROM law_documents ORDER BY slug').all() as Record<string, string | null>[]
    return rows.map((r) => toLawDocument({ ...(r as unknown as DocRow), topics: JSON.parse(r.topics ?? '[]') }))
  }

  async section(slug: string, section: string): Promise<LawSectionChunk[]> {
    return this.db
      .prepare('SELECT s.chunk, s.heading, s.part, s.content FROM law_sections s JOIN law_documents d ON d.id = s.document_id WHERE d.slug = ? AND s.section = ? ORDER BY s.chunk')
      .all(slug, section) as unknown as LawSectionChunk[]
  }

  /** Keyword search alone (FTS5, BM25 with headings weighted double). */
  keywordSearch(query: string, state: string, n: number): LawSearchHit[] {
    const terms = orQueryTerms(query)
    if (!terms.length) return []
    return this.db
      .prepare(`SELECT d.slug, d.title, s.section, s.chunk, s.heading, s.content FROM law_fts f
                  JOIN law_sections s ON s.id = f.rowid JOIN law_documents d ON d.id = s.document_id
                 WHERE law_fts MATCH ? AND d.status = 'ingested' AND (d.state = 'All states' OR d.state = ?)
                 ORDER BY bm25(law_fts, 2.0, 1.0) LIMIT ?`)
      .all(terms.map((t) => `"${t}"`).join(' OR '), state, Math.max(n, 1)) as unknown as LawSearchHit[]
  }

  async search(query: string, state: string, limit: number): Promise<LawSearchHit[]> {
    const embed = this.embed
    return hybridSearch({
      limit,
      mode: this.mode,
      keyword: async (n) => this.keywordSearch(query, state, n),
      vector: embed ? async (n) => this.nearest(await embed(query), state, n) : null,
    })
  }
}
