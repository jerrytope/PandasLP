// get_section and lookup_law: the agent's only source of statute text. Whatever they return is
// recorded (in ctx.citable and as a 'law_lookup' event), and emit_document lets a document cite
// a section only if it was looked up for this matter or is in the area's own rules.

import type { AgentTool } from '../../agentRuntime/types'
import { jurisdictionOf } from '../calc'
import { citationKey, normaliseSection, orQueryTerms, resolveLaw, type LawDocument } from '../lawLookup'
import type { PropertyToolContext } from './context'
import { optionalNumber, requireString } from './context'

type Tool = AgentTool<PropertyToolContext>

const MAX_SECTION_CHARS = 6000
const MAX_EXCERPT_CHARS = 600
const LAGOS_TENANCY_LAW = 'lagos-tenancy-law-2011'

function appliesHere(doc: LawDocument, state: string | null | undefined): boolean {
  return doc.state === 'All states' || (!!state && doc.state === state)
}

/** Laws for this state whose text isn't in the library yet and that look relevant to the words. */
function missingLaws(docs: LawDocument[], state: string | null | undefined, query: string) {
  const stems = orQueryTerms(query).filter((t) => t.length >= 4).map((t) => t.slice(0, 5))
  return docs
    .filter((d) => d.status !== 'ingested' && appliesHere(d, state))
    .filter((d) => {
      const hay = `${d.title} ${d.topics.join(' ')}`.toLowerCase()
      return stems.some((s) => hay.includes(s))
    })
    .map((d) => ({ law: d.title, why: d.notes }))
}

/** Lagos Tenancy Law in Apapa, Ikeja GRA, Ikoyi or VI: say it doesn't apply there. */
function areaNote(slug: string, ctx: PropertyToolContext): string | undefined {
  if (slug === LAGOS_TENANCY_LAW && ctx.matterState === 'Lagos' && jurisdictionOf('Lagos', ctx.lagosArea) === 'lagos-excluded-area') {
    return 'This Law does NOT apply in this part of Lagos (Apapa, Ikeja GRA, Ikoyi, Victoria Island). Do not rely on it for this matter.'
  }
  return undefined
}

async function remember(ctx: PropertyToolContext, entries: { slug: string; title: string; section: string }[]) {
  if (!entries.length) return
  ctx.citable ??= new Set()
  for (const e of entries) ctx.citable.add(citationKey(e.title, e.section))
  await ctx.store.logEvent(ctx.caseId, 'law_lookup', { sections: entries })
}

export const getSection: Tool = {
  definition: {
    name: 'get_section',
    description: "The exact text of one section of a law in the firm's law library. Use it before you state what a section says or put a section number in a document. `law` can be the law's name (\"Land Use Act\", \"Tenancy Law\") or its library id.",
    input_schema: {
      type: 'object',
      properties: {
        law: { type: 'string', description: 'e.g. "Land Use Act", "Tenancy Law of Lagos State", "land-use-act".' },
        section: { type: 'string', description: 'e.g. "22", "s.13(4)" (the whole section is returned).' },
      },
      required: ['law', 'section'],
    },
  },
  handler: async (input, ctx) => {
    if (!ctx.library) return { ok: false, error: 'The law library is not available right now. Name the law without a section number.' }
    const docs = await ctx.library.documents()
    const doc = resolveLaw(requireString(input, 'law', 200), docs, ctx.matterState)
    if (!doc) {
      const here = docs.filter((d) => d.status === 'ingested' && appliesHere(d, ctx.matterState)).map((d) => d.title)
      throw new RangeError(`That law is not in the library. Laws with text available for this matter: ${here.join('; ')}. Use lookup_law to search them.`)
    }
    if (!appliesHere(doc, ctx.matterState)) {
      throw new RangeError(`${doc.title} is a ${doc.state} law; this matter is in ${ctx.matterState ?? 'another state'}. Do not apply it here.`)
    }
    if (doc.status !== 'ingested') {
      throw new RangeError(`The official text of ${doc.title} is not in the library yet${doc.notes ? ` (${doc.notes})` : ''}. Name the law without a section number; if the matter turns on its exact wording, escalate.`)
    }
    const section = normaliseSection(requireString(input, 'section', 30))
    if (!section) throw new RangeError('section must contain a section number, e.g. "22".')
    const chunks = await ctx.library.section(doc.slug, section)
    if (!chunks.length) throw new RangeError(`${doc.title} has no section ${section} in the library. Use lookup_law to find the right section.`)

    const text = chunks.map((c) => c.content).join('\n\n')
    await remember(ctx, [{ slug: doc.slug, title: doc.title, section }])
    return {
      ok: true,
      result: {
        law: doc.title,
        citation: doc.citation,
        section,
        heading: chunks[0].heading,
        part: chunks[0].part,
        text: text.length > MAX_SECTION_CHARS ? `${text.slice(0, MAX_SECTION_CHARS)}… [section continues]` : text,
        source: { name: doc.sourceName, url: doc.sourceUrl, retrievedOn: doc.retrievedOn },
        ...(areaNote(doc.slug, ctx) ? { note: areaNote(doc.slug, ctx) } : {}),
      },
    }
  },
}

export const lookupLaw: Tool = {
  definition: {
    name: 'lookup_law',
    description: "Searches the firm's law library (the laws that apply to this matter's state) for the sections relevant to a question, in plain words. Returns the best few sections with an excerpt; use get_section for a section's full text. Also lists relevant laws whose text is not in the library yet.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'e.g. "notice to quit for a yearly tenant", "consent to mortgage".' },
        limit: { type: 'integer', description: 'How many sections, 1 to 5 (default 3).' },
      },
      required: ['query'],
    },
  },
  handler: async (input, ctx) => {
    if (!ctx.library) return { ok: false, error: 'The law library is not available right now. Name the law without a section number.' }
    if (!ctx.matterState) throw new RangeError('The matter has no state yet.')
    const query = requireString(input, 'query', 300)
    const limit = Math.min(Math.max(Math.round(optionalNumber(input, 'limit') ?? 3), 1), 5)
    const [hits, docs] = await Promise.all([ctx.library.search(query, ctx.matterState, limit * 2), ctx.library.documents()])

    // One result per section (a long section can match in more than one chunk).
    const seen = new Set<string>()
    const results = []
    for (const h of hits) {
      const key = `${h.slug}|${h.section}`
      if (seen.has(key)) continue
      seen.add(key)
      const note = areaNote(h.slug, ctx)
      results.push({
        law: h.title,
        section: h.section,
        heading: h.heading,
        excerpt: h.content.length > MAX_EXCERPT_CHARS ? `${h.content.slice(0, MAX_EXCERPT_CHARS)}…` : h.content,
        ...(note ? { note } : {}),
      })
      if (results.length >= limit) break
    }
    await remember(ctx, results.map((r) => ({ slug: hits.find((h) => h.title === r.law)!.slug, title: r.law, section: r.section })))

    const notInLibrary = missingLaws(docs, ctx.matterState, query)
    return {
      ok: true,
      result: {
        results,
        ...(notInLibrary.length ? { notInLibraryYet: notInLibrary, guidance: 'Text of these laws is not in the library: name them without section numbers, and escalate if the matter turns on their exact wording.' } : {}),
        ...(results.length ? {} : { message: 'No section in the library matched. Do not cite a section; rely on your rules or escalate.' }),
      },
    }
  },
}
