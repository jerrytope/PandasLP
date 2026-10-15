import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { parseLawSeed, SqliteLawLibrary } from '../dev/sqliteLawLibrary'
import { SqliteMatterRepo } from '../dev/sqliteMatterRepo'
import { citationKey, extractCitations, fuseRankings, normaliseLawName, normaliseSection, orQueryTerms, resolveLaw, type LawDocument } from '../property/lawLookup'
import { hybridSearch } from '../property/lawSearch'
import { buildAreaSystem, standingCitations } from '../property/orchestrator'
import { SHARED_PROPERTY_TOOLS, type PropertyToolContext } from '../property/tools'

describe('lawLookup helpers', () => {
  it('reduces law names so different spellings match', () => {
    expect(normaliseLawName('the Tenancy Law of Lagos State 2011')).toBe('tenancy law')
    expect(normaliseLawName('Tenancy Law 2011')).toBe('tenancy law')
    expect(normaliseLawName('Land Use Act, Cap L5, LFN 2004')).toBe('land use act')
    expect(normaliseLawName('Lagos State Land Registration Law 2015')).toBe('land registration law')
  })

  it('reads section numbers', () => {
    expect(normaliseSection('s. 22(1)(a)')).toBe('22')
    expect(normaliseSection('Section 13')).toBe('13')
    expect(normaliseSection('4a')).toBe('4A')
    expect(normaliseSection('none')).toBeNull()
  })

  it('turns a question into search words', () => {
    expect(orQueryTerms('Can my landlord increase the rent without notice?')).toEqual(['landlord', 'increase', 'rent', 'notice'])
  })

  it('finds every "section N of the X" citation', () => {
    expect(extractCitations('pursuant to Section 22 of the Land Use Act Cap L5, and sections 21 and 23(1) of the Land Use Act').map((c) => c.key))
      .toEqual(['land use act|22', 'land use act|21', 'land use act|23'])
    expect(extractCitations('under section 13(4) of the Tenancy Law of Lagos State 2011').map((c) => c.key)).toEqual(['tenancy law|13'])
    expect(extractCitations('section 8 of the Recovery of Premises Act').map((c) => c.key)).toEqual(['recovery of premises act|8'])
    expect(extractCitations('Pay within seven days of this notice.')).toEqual([])
  })

  it('resolves a reference to the right law, preferring one that applies in the state', () => {
    const doc = (slug: string, title: string, state = 'All states'): LawDocument =>
      ({ slug, title, state, citation: null, appliesIn: null, status: 'ingested', sourceName: null, sourceUrl: null, retrievedOn: null, notes: null, topics: [] })
    const docs = [doc('land-use-act', 'Land Use Act'), doc('lagos-tenancy-law-2011', 'Tenancy Law 2011', 'Lagos'), doc('delta-recovery', 'Recovery of Premises Law', 'Delta')]
    expect(resolveLaw('LUA', docs)?.slug).toBe('land-use-act')
    expect(resolveLaw('the Tenancy Law of Lagos State', docs)?.slug).toBe('lagos-tenancy-law-2011')
    expect(resolveLaw('land-use-act', docs)?.slug).toBe('land-use-act')
    expect(resolveLaw('Recovery of Premises', docs, 'Delta')?.slug).toBe('delta-recovery')
    expect(resolveLaw('Wills Law', docs)).toBeNull()
  })
})

const SEED = path.resolve(__dirname, '../../docs/pandaslp-law-library-seed.sql')
const hasSeed = existsSync(SEED)

describe.skipIf(!hasSeed)('the law library seed, loaded into SQLite', () => {
  const library = hasSeed ? SqliteLawLibrary.fromFile(SEED) : (null as never)

  it('loads every law and section', async () => {
    const parsed = parseLawSeed((await import('node:fs')).readFileSync(SEED, 'utf8'))
    expect(parsed.documents.length).toBe(15)
    expect(parsed.sections.length).toBe(239)
    const docs = await library.documents()
    expect(docs.filter((d) => d.status === 'ingested').map((d) => d.slug)).toContain('lagos-tenancy-law-2011')
  })

  it('returns a section with all its text', async () => {
    const s22 = await library.section('land-use-act', '22')
    expect(s22[0].heading).toMatch(/consent of Governor/)
    expect(s22.map((c) => c.content).join(' ')).toMatch(/without the consent of the\s+Governor first had and obtained/)
  })

  it('finds the right section from plain words', async () => {
    const top = async (q: string, state: string) => (await library.search(q, state, 3)).map((h) => `${h.slug}|${h.section}`)
    expect((await top('notice to quit yearly tenant', 'Lagos'))[0]).toBe('lagos-tenancy-law-2011|13')
    expect((await top('can my landlord collect two years rent in advance', 'Lagos'))[0]).toBe('lagos-tenancy-law-2011|4')
    expect(await top('consent of the governor to sell my land', 'Oyo')).toContain('land-use-act|22')
  })

  it("never returns another state's law", async () => {
    const hits = await library.search('notice to quit tenant', 'Oyo', 10)
    expect(hits.some((h) => h.slug === 'lagos-tenancy-law-2011')).toBe(false)
  })

  describe('the tools', () => {
    function setup(state: string, lagosArea: string | null = null) {
      const repo = new SqliteMatterRepo()
      const caseId = repo.createCase()
      const ctx: PropertyToolContext = { caseId, area: 'recovery', store: repo, emitted: [], library, matterState: state, lagosArea, standingCitations: new Set() }
      const run = async (name: string, input: Record<string, unknown>) => {
        await repo.getOrCreateMatter(caseId)
        try {
          return await SHARED_PROPERTY_TOOLS.find((t) => t.definition.name === name)!.handler(input, ctx)
        } catch (err) {
          return { ok: false as const, error: (err as Error).message }
        }
      }
      return { repo, caseId, ctx, run }
    }

    it('get_section returns the text and makes the section citable', async () => {
      const { run, ctx, repo, caseId } = setup('Lagos', 'elsewhere')
      const out = await run('get_section', { law: 'Tenancy Law of Lagos State', section: 's.13(4)' })
      expect(out).toMatchObject({ ok: true, result: { law: 'Tenancy Law 2011', section: '13', heading: 'Length of Notice' } })
      expect(ctx.citable?.has('tenancy law|13')).toBe(true)
      expect(await repo.events(caseId, 'law_lookup')).toHaveLength(1)
    })

    it('get_section refuses a law with no text yet, or from another state', async () => {
      const { run } = setup('Lagos')
      const missing = await run('get_section', { law: 'Mortgage and Property Law', section: '5' })
      expect(missing).toMatchObject({ ok: false })
      expect(missing.ok === false && missing.error).toMatch(/not in the library yet/)
      const other = setup('Oyo')
      expect(await other.run('get_section', { law: 'Tenancy Law', section: '13' })).toMatchObject({ ok: false })
    })

    it('warns that the Lagos Tenancy Law does not apply in Ikoyi', async () => {
      const { run } = setup('Lagos', 'ikoyi')
      expect(await run('get_section', { law: 'Tenancy Law', section: '13' })).toMatchObject({ ok: true, result: { note: expect.stringMatching(/does NOT apply/) } })
    })

    it('lookup_law gives one result per section and names relevant laws not in yet', async () => {
      const { run } = setup('FCT')
      const out = await run('lookup_law', { query: 'notice to quit for a tenant at will', limit: 3 })
      expect(out.ok).toBe(true)
      const result = (out as { result: { results: { law: string; section: string }[]; notInLibraryYet?: { law: string }[] } }).result
      expect(new Set(result.results.map((r) => `${r.law}|${r.section}`)).size).toBe(result.results.length)
      expect(result.notInLibraryYet?.map((l) => l.law)).toContain('Recovery of Premises Act')
    })

    it('emit_document refuses a section that was not looked up, and accepts it once it is', async () => {
      const { run, ctx } = setup('Lagos', 'elsewhere')
      const body = 'TAKE NOTICE that under section 13 of the Tenancy Law of Lagos State 2011 you are to quit on or before **20 April 2027**.'
      const before = await run('emit_document', { documentType: 'notice-to-quit', title: 'Notice to Quit', body })
      expect(before).toMatchObject({ ok: false })
      expect(before.ok === false && before.error).toMatch(/not been looked up/)
      await run('get_section', { law: 'Tenancy Law', section: '13' })
      expect(ctx.citable?.has('tenancy law|13')).toBe(true)
      expect(await run('emit_document', { documentType: 'notice-to-quit', title: 'Notice to Quit', body })).toMatchObject({ ok: true })
    })
  })
})

describe('prepare_consent_application', () => {
  it('makes the provision it returns citable (s.21 for customary land)', async () => {
    const repo = new SqliteMatterRepo()
    const ctx: PropertyToolContext = { caseId: repo.createCase(), area: 'conveyancing', store: repo, emitted: [] }
    const tool = SHARED_PROPERTY_TOOLS.find((t) => t.definition.name === 'prepare_consent_application')!
    await tool.handler({ instrument: 'assignment', state: 'Enugu', titleType: 'customary' }, ctx)
    expect(ctx.citable?.has('land use act|21')).toBe(true)
  })
})

describe('search modes', () => {
  const hit = (section: string) => ({ slug: 'law', title: 'Law', section, heading: null, content: '' })
  const keyword = async () => [hit('1'), hit('2')]
  const sections = (hits: { section: string }[]) => hits.map((h) => h.section)

  it('merges rankings, weighted', () => {
    expect(fuseRankings([['a', 'b'], ['b', 'c']])).toEqual(['b', 'a', 'c'])
    // Weighting the second list puts its top item (c) ahead of the first list's (a).
    expect(fuseRankings([['a', 'b'], ['c', 'b']])).toEqual(['b', 'a', 'c'])
    expect(fuseRankings([['a', 'b'], ['c', 'b']], 60, [1, 3])).toEqual(['b', 'c', 'a'])
  })

  it('meaning mode uses embeddings, and falls back to keywords if they fail or find nothing', async () => {
    expect(sections(await hybridSearch({ limit: 2, mode: 'meaning', keyword, vector: async () => [hit('9')] }))).toEqual(['9'])
    expect(sections(await hybridSearch({ limit: 2, mode: 'meaning', keyword, vector: async () => { throw new Error('no model') } }))).toEqual(['1', '2'])
    expect(sections(await hybridSearch({ limit: 2, mode: 'meaning', keyword, vector: async () => [] }))).toEqual(['1', '2'])
    expect(sections(await hybridSearch({ limit: 2, mode: 'meaning', keyword, vector: null }))).toEqual(['1', '2'])
  })

  it('keyword and hybrid modes', async () => {
    expect(sections(await hybridSearch({ limit: 2, mode: 'keyword', keyword, vector: async () => [hit('9')] }))).toEqual(['1', '2'])
    expect(sections(await hybridSearch({ limit: 3, mode: 'hybrid', keyword, vector: async () => [hit('9')] }))).toEqual(['9', '1', '2'])
  })
})

describe.skipIf(!hasSeed)('meaning search over the seed', () => {
  it("finds a section from its own stored vector, within the matter's state", async () => {
    const library = SqliteLawLibrary.fromFile(SEED)
    const parsed = parseLawSeed((await import('node:fs')).readFileSync(SEED, 'utf8'))
    const docId = parsed.documents.find((d) => d.slug === 'lagos-tenancy-law-2011')!.id
    const s4 = parsed.sections.find((s) => s.document_id === docId && s.section === '4')!
    const vector = String(s4.embedding).replace(/[[\]]/g, '').split(',').map(Number)
    expect(library.nearest(vector, 'Lagos', 1)[0]).toMatchObject({ slug: 'lagos-tenancy-law-2011', section: '4' })
    expect(library.nearest(vector, 'Oyo', 3).some((h) => h.slug === 'lagos-tenancy-law-2011')).toBe(false)
    // Through search(), with an embedder that returns that vector:
    const withEmbed = SqliteLawLibrary.fromFile(SEED, { embed: async () => vector })
    expect((await withEmbed.search('anything at all', 'Lagos', 1))[0]).toMatchObject({ section: '4' })
  })
})

describe('standing citations', () => {
  it("allow what the area's own rules and templates cite", () => {
    const keys = standingCitations(buildAreaSystem({ caseId: 'c', area: 'conveyancing', state: 'Oyo', lagosArea: null, facts: {}, status: 'active' }, new Date()))
    expect(keys.has('land use act|22')).toBe(true)
    expect(keys.has(citationKey('Companies and Allied Matters Act 2020', '102'))).toBe(true)
    expect(keys.has('land use act|29')).toBe(false)
  })
})
