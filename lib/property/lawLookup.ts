// Pure helpers for the law library tools (lib/property/tools/lawTools.ts): which law a
// reference means, the section number, the search query, and the citations in a document.
// No database: unit-tested in lib/__tests__/lawLookup.test.ts.

export interface LawDocument {
  slug: string
  title: string
  citation: string | null
  /** 'All states', or the one state the law belongs to. */
  state: string
  appliesIn: string | null
  /** 'ingested' = text in the library; 'not_sourced' = not found yet (see notes). */
  status: string
  sourceName: string | null
  sourceUrl: string | null
  retrievedOn: string | null
  notes: string | null
  topics: string[]
}

export type DocRow = {
  slug: string; title: string; citation: string | null; state: string; applies_in: string | null; status: string
  source_name: string | null; source_url: string | null; retrieved_on: string | null; notes: string | null; topics: string[] | null
}

export function toLawDocument(r: DocRow): LawDocument {
  return {
    slug: r.slug, title: r.title, citation: r.citation, state: r.state, appliesIn: r.applies_in, status: r.status,
    sourceName: r.source_name, sourceUrl: r.source_url, retrievedOn: r.retrieved_on, notes: r.notes, topics: r.topics ?? [],
  }
}

/** Short names clients and lawyers use, mapped to the library's slugs. */
const ALIASES: Record<string, string> = {
  lua: 'land-use-act',
  'land use decree': 'land-use-act',
  'tenancy law': 'lagos-tenancy-law-2011',
  'lagos tenancy law': 'lagos-tenancy-law-2011',
  'tenancy law of lagos state': 'lagos-tenancy-law-2011',
  nurpa: 'nigerian-urban-and-regional-planning-act',
  'urban and regional planning act': 'nigerian-urban-and-regional-planning-act',
  'mortgage and property law': 'lagos-mortgage-and-property-law-2010',
  'land registration law': 'lagos-land-registration-law-2015',
  'stamp duties act': 'stamp-duties-act',
  'evidence act': 'evidence-act-2011',
  'recovery of premises act': 'fct-recovery-of-premises-act',
}

/**
 * A law's name, reduced so different ways of writing it compare equal:
 * "the Tenancy Law of Lagos State 2011" and "Tenancy Law 2011" both become "tenancy law".
 */
export function normaliseLawName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\bcap\.?\s*[a-z]?\d+\b.*$/, '')
    .replace(/\blaws? of the federation.*$/, '')
    .replace(/\bof [a-z ]*? state\b/g, '')
    .replace(/\b[a-z]+ state\b/g, '')
    .replace(/\b(19|20)\d\d\b/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\bthe\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The library document a reference means: a slug, a title, a short name ("LUA", "Tenancy
 * Law"), or a unique part of a title. Prefers a law that applies in the matter's state.
 */
export function resolveLaw(ref: string, docs: LawDocument[], state?: string | null): LawDocument | null {
  const raw = ref.trim().toLowerCase()
  const bySlug = docs.find((d) => d.slug === raw)
  if (bySlug) return bySlug
  const key = normaliseLawName(ref)
  const alias = ALIASES[raw] ?? ALIASES[key]
  if (alias) return docs.find((d) => d.slug === alias) ?? null
  const applies = (d: LawDocument) => d.state === 'All states' || (!!state && d.state === state)
  const exact = docs.filter((d) => normaliseLawName(d.title) === key)
  if (exact.length) return exact.find(applies) ?? exact[0]
  const partial = docs.filter((d) => key.length >= 4 && normaliseLawName(d.title).includes(key))
  const partialHere = partial.filter(applies)
  if (partialHere.length === 1) return partialHere[0]
  return partial.length === 1 ? partial[0] : null
}

/** "s. 22(1)(a)", "Section 22", "22" → "22". Keeps a letter suffix: "4A". */
export function normaliseSection(ref: string): string | null {
  const m = ref.trim().match(/(\d+)\s*([A-Za-z])?(?![a-z])/)
  return m ? `${m[1]}${m[2] ? m[2].toUpperCase() : ''}` : null
}

const STOPWORDS = new Set(
  'a an and are as at be by can do does for from has have how i if in is it its me my of on or our should that the their them they this to under was we what when where which who will with without you your'.split(' '),
)

/** The client's words as an OR-query: "landlord | increase | rent | notice". Empty when nothing is left. */
export function orQueryTerms(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? []
  return [...new Set(words.filter((w) => w.length > 1 && !STOPWORDS.has(w)))].slice(0, 12)
}

/**
 * Merges ranked result lists (keyword search, meaning search) into one ranking by reciprocal
 * rank fusion: an item's score is the sum of 1 / (k + rank) over the lists it appears in, so an
 * item near the top of both lists beats one at the top of only one. k = 60 is the usual value.
 * `weights` scales each list (default 1 each).
 */
export function fuseRankings(lists: string[][], k = 60, weights: number[] = []): string[] {
  const score = new Map<string, number>()
  lists.forEach((list, l) => {
    const w = weights[l] ?? 1
    list.forEach((key, i) => score.set(key, (score.get(key) ?? 0) + w / (k + i + 1)))
  })
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key)
}

export function citationKey(lawName: string, section: string): string {
  return `${normaliseLawName(lawName)}|${normaliseSection(section) ?? section}`
}

const CITATION_RE = /\b(?:[Ss]ections?|SECTIONS?|ss?\.)\s*((?:\d+[A-Za-z]?(?:\s*\([^)]{1,6}\))*(?:\s*(?:,|and|to|&)\s*)?)+)\s+of\s+(?:the\s+)?((?:(?:[A-Z][\w’'()&,-]*|of|and)\s+){0,9}?(?:Act|Law|Decree|Edict))\b/g

/**
 * Every "section N of the X Act/Law" in a text, as citation keys. Subsection brackets are
 * dropped ("22(1)" → 22); a list ("sections 21 and 22 of") gives one key per section.
 */
export function extractCitations(text: string): { key: string; quoted: string }[] {
  const out: { key: string; quoted: string }[] = []
  for (const m of text.matchAll(CITATION_RE)) {
    const numbers = m[1].replace(/\([^)]*\)/g, ' ').match(/\d+[A-Za-z]?/g) ?? []
    for (const n of numbers) out.push({ key: citationKey(m[2], n), quoted: m[0].replace(/\s+/g, ' ') })
  }
  return out
}
