// LOCAL TESTING ONLY. The law library on SQLite (node:sqlite, FTS5 with Porter stemming),
// loaded from the same seed file Supabase is filled from (docs/pandaslp-law-library-seed.sql),
// so the law tools are tested against the real statute text without a database or an API.
// Never imported by the app.

import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { orQueryTerms, toLawDocument, type DocRow, type LawDocument } from '../property/lawLookup'
import type { LawLibrary, LawSearchHit, LawSectionChunk } from '../property/lawLibrary'

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

export class SqliteLawLibrary implements LawLibrary {
  readonly db = new DatabaseSync(':memory:')

  constructor(seed: ParsedSeed) {
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
  }

  static fromFile(path: string): SqliteLawLibrary {
    return new SqliteLawLibrary(parseLawSeed(readFileSync(path, 'utf8')))
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

  async search(query: string, state: string, limit: number): Promise<LawSearchHit[]> {
    const terms = orQueryTerms(query)
    if (!terms.length) return []
    return this.db
      .prepare(`SELECT d.slug, d.title, s.section, s.heading, s.content FROM law_fts f
                  JOIN law_sections s ON s.id = f.rowid JOIN law_documents d ON d.id = s.document_id
                 WHERE law_fts MATCH ? AND d.status = 'ingested' AND (d.state = 'All states' OR d.state = ?)
                 ORDER BY bm25(law_fts, 2.0, 1.0) LIMIT ?`)
      .all(terms.map((t) => `"${t}"`).join(' OR '), state, Math.min(Math.max(limit, 1), 10)) as unknown as LawSearchHit[]
  }
}
