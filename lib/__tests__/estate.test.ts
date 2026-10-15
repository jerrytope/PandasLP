import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { SqliteMatterRepo } from '../dev/sqliteMatterRepo'
import { checkLimitation, chooseProbatePath, wholeYearsBetween } from '../property/estate'
import { AREAS, areaBlock } from '../property/areas'
import { SHARED_PROPERTY_TOOLS, type PropertyToolContext } from '../property/tools'
import type { PropertyArea } from '../property/types'

describe('chooseProbatePath', () => {
  const base = { state: 'Lagos' }

  it('a will with executors able to act: probate, at the state High Court registry', () => {
    expect(chooseProbatePath({ ...base, hasWill: true, executorsAbleAndWilling: true })).toMatchObject({
      path: 'probate',
      applyTo: 'The Probate Registry of the High Court of Lagos State',
      documents: expect.arrayContaining(['The original will']),
    })
  })

  it('a will with no executor able to act: letters of administration with the will annexed', () => {
    expect(chooseProbatePath({ ...base, hasWill: true, executorsAbleAndWilling: false }).path).toBe('letters-of-administration-with-will-annexed')
  })

  it('no will after a Marriage Act marriage: letters of administration', () => {
    expect(chooseProbatePath({ ...base, hasWill: false, marriageType: 'statutory' })).toMatchObject({
      path: 'letters-of-administration',
      documents: expect.arrayContaining(['An administration bond with sureties']),
    })
  })

  it('no will otherwise: escalated (customary or Islamic succession)', () => {
    for (const marriageType of ['customary', 'islamic', 'never-married'] as const) {
      expect(chooseProbatePath({ ...base, hasWill: false, marriageType })).toMatchObject({ path: 'escalate', applyTo: null })
    }
  })

  it('a Muslim deceased is always escalated, and a grant made elsewhere is resealed', () => {
    expect(chooseProbatePath({ ...base, hasWill: true, executorsAbleAndWilling: true, deceasedWasMuslim: true }).path).toBe('escalate')
    expect(chooseProbatePath({ ...base, hasWill: true, executorsAbleAndWilling: true, grantMadeElsewhere: true }).path).toBe('reseal')
  })

  it('needs the facts that decide it', () => {
    expect(() => chooseProbatePath({ ...base, hasWill: true })).toThrow(RangeError)
    expect(() => chooseProbatePath({ ...base, hasWill: false })).toThrow(RangeError)
  })

  it('names the FCT registry correctly', () => {
    expect(chooseProbatePath({ state: 'FCT', hasWill: true, executorsAbleAndWilling: true }).applyTo).toBe('The Probate Registry of the High Court of the Federal Capital Territory')
  })
})

describe('checkLimitation', () => {
  it('counts whole years', () => {
    expect(wholeYearsBetween('2014-10-15', '2026-10-14')).toBe(11)
    expect(wholeYearsBetween('2014-10-14', '2026-10-14')).toBe(12)
  })

  it('flags a possible limitation bar, a near one, or none', () => {
    expect(checkLimitation('2013-01-01', '2026-10-14')).toMatchObject({ flag: 'possible-limitation-bar', yearsSince: 13, limitDate: '2025-01-01' })
    expect(checkLimitation('2016-06-01', '2026-10-14')).toMatchObject({ flag: 'close-to-limit', yearsSince: 10 })
    expect(checkLimitation('2024-01-01', '2026-10-14')).toMatchObject({ flag: 'within-time', yearsSince: 2 })
    expect(() => checkLimitation('2027-01-01', '2026-10-14')).toThrow(RangeError)
  })
})

describe('Phase 4 tools and documents', () => {
  function setup(area: PropertyArea) {
    const repo = new SqliteMatterRepo()
    const caseId = repo.createCase()
    const ctx: PropertyToolContext = { caseId, area, store: repo, emitted: [], matterState: 'Oyo', today: '2026-10-14', standingCitations: new Set() }
    const run = async (name: string, input: Record<string, unknown>) => {
      await repo.getOrCreateMatter(caseId)
      try {
        return await SHARED_PROPERTY_TOOLS.find((t) => t.definition.name === name)!.handler(input, ctx)
      } catch (err) {
        return { ok: false as const, error: (err as Error).message }
      }
    }
    return { ctx, run }
  }

  it('choose_probate_path works in Wills & probate only', async () => {
    expect(await setup('wills-probate').run('choose_probate_path', { hasWill: false, marriageType: 'statutory' })).toMatchObject({
      ok: true,
      result: { path: 'letters-of-administration', applyTo: 'The Probate Registry of the High Court of Oyo State' },
    })
    expect(await setup('recovery').run('choose_probate_path', { hasWill: false, marriageType: 'statutory' })).toMatchObject({ ok: false })
  })

  it('check_limitation uses today', async () => {
    expect(await setup('land-dispute').run('check_limitation', { since: '2013-01-01' })).toMatchObject({ ok: true, result: { flag: 'possible-limitation-bar' } })
  })

  it('a will and a dispute brief are emitted with no price: a lawyer confirms the fee', async () => {
    const will = setup('wills-probate')
    expect(await will.run('emit_document', { documentType: 'will', title: 'Will', body: 'THIS IS THE LAST WILL AND TESTAMENT of me, Ade Bello, made this ____ day of ____________ 20____.' })).toMatchObject({ ok: true, result: { price: 0 } })
    expect(will.ctx.emitted[0].priceLabel).toMatch(/lawyer will confirm/)
    const brief = setup('land-dispute')
    expect(await brief.run('emit_document', { documentType: 'dispute-brief', title: 'Lawyer Brief', body: 'LAWYER BRIEF: LAND TITLE DISPUTE. Client: Mr Ade Bello.' })).toMatchObject({ ok: true, result: { price: 0 } })
    // ...and not from another area.
    expect(await setup('recovery').run('emit_document', { documentType: 'will', title: 'Will', body: 'A will.' })).toMatchObject({ ok: false })
  })
})

describe('Phase 4 area rules', () => {
  it('Wills & probate carries the formalities, revocation and escalation triggers', () => {
    const block = areaBlock(AREAS['wills-probate'])
    expect(block).toMatch(/Two witnesses, present at the same time/)
    expect(block).toMatch(/witness's husband or wife, must not benefit/)
    expect(block).toMatch(/later marriage under the Marriage Act/)
    expect(block).toMatch(/Igiogbe/)
    expect(block).toMatch(/HOW TO SIGN YOUR WILL/)
    expect(block).toMatch(/to conveyancing:/)
  })

  it('Land disputes never drafts court papers and flags limitation, pending cases, grabbers and urgency', () => {
    const block = areaBlock(AREAS['land-dispute'])
    expect(block).toMatch(/NEVER DRAFT COURT PAPERS/)
    expect(block).toMatch(/Idundun v Okumagba/)
    expect(block).toMatch(/Kodilinye v Odu/)
    for (const flag of ['Limitation', 'Pending case', 'Land grabbers', 'Urgency']) expect(block).toMatch(new RegExp(flag))
    expect(AREAS['land-dispute'].handoffs).toEqual([])
  })
})
