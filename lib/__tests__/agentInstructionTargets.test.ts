import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))

import {
  ALL_TARGETS,
  applicableTargets,
  areaOfTarget,
  draftingInstructionsBlock,
  instructionProblems,
  isInstructionTarget,
  withDraftingInstructions,
} from '../agentInstructionTargets'
import { AGENTS } from '../agents'
import { PROPERTY_AREAS } from '../property/types'
import { buildAreaSystem } from '../property/orchestrator'
import { readSnapshot, snapshotRepo } from '../property/snapshotRepo'

describe('drafting instruction targets', () => {
  it('cover every agent and every property area', () => {
    for (const id of Object.keys(AGENTS)) expect(isInstructionTarget(id)).toBe(true)
    for (const area of PROPERTY_AREAS) expect(isInstructionTarget(`property:${area}`)).toBe(true)
    expect(ALL_TARGETS).toHaveLength(Object.keys(AGENTS).length + PROPERTY_AREAS.length)
    expect(isInstructionTarget('property:nonsense')).toBe(false)
    expect(isInstructionTarget('')).toBe(false)
  })

  it('match the database CHECK on target names', () => {
    for (const t of ALL_TARGETS) expect(t).toMatch(/^[a-z][a-z:-]{1,60}$/)
  })

  it('apply the whole property agent before an area', () => {
    expect(areaOfTarget('property:tenancy')).toBe('tenancy')
    expect(areaOfTarget('small-claims')).toBeNull()
    expect(applicableTargets('property:tenancy')).toEqual(['recovery-of-premises', 'property:tenancy'])
    expect(applicableTargets('small-claims')).toEqual(['small-claims'])
  })
})

describe('the instructions as the agent sees them', () => {
  it('leave the base instructions exactly as they are when nothing is published', () => {
    const base = AGENTS['small-claims'].systemPrompt
    expect(withDraftingInstructions(base, [])).toBe(base)
    expect(withDraftingInstructions(base, ['', '   ', null, undefined])).toBe(base)
    expect(draftingInstructionsBlock([''])).toBe('')
  })

  it('add the lawyer\'s instructions after the base, under one heading, broadest first', () => {
    const out = withDraftingInstructions('BASE', ['Agent-wide rule.', '  Area rule.  '])
    expect(out.startsWith('BASE\n\nLEAD LAWYER\'S DRAFTING INSTRUCTIONS')).toBe(true)
    expect(out.indexOf('Agent-wide rule.')).toBeLessThan(out.indexOf('Area rule.'))
    expect(out.endsWith('Area rule.')).toBe(true)
    expect(out.match(/LEAD LAWYER'S DRAFTING INSTRUCTIONS/g)).toHaveLength(1)
  })

  it('end the property area block, which stays cached, and leave it unchanged when there are none', () => {
    const matter = { caseId: 'c', area: 'recovery' as const, state: 'Lagos', lagosArea: null, facts: {}, status: 'active' as const }
    const now = new Date('2026-10-18T10:00:00Z')
    const without = buildAreaSystem(matter, now)
    expect(buildAreaSystem(matter, now, undefined, undefined, {})).toEqual(without)

    const withNotes = buildAreaSystem(matter, now, undefined, undefined, {
      'recovery-of-premises': 'Whole agent: sign as Pandas LP.',
      'property:recovery': 'Recovery: quit dates in words.',
      'property:tenancy': 'Tenancy only: never shown here.',
    })
    expect(withNotes[1].cache).toBe('1h')
    expect(withNotes[1].text.startsWith(without[1].text)).toBe(true)
    expect(withNotes[1].text).toContain('Whole agent: sign as Pandas LP.')
    expect(withNotes[1].text).toContain('Recovery: quit dates in words.')
    expect(withNotes[1].text).not.toContain('Tenancy only')
    expect(withNotes[0]).toEqual(without[0])
  })
})

describe('checks before publishing', () => {
  it('accept plain English', () => {
    expect(instructionProblems('Write the quit date in words as well as figures.')).toEqual([])
    expect(instructionProblems('')).toEqual([])
  })

  it('refuse the markers the app reads from replies, and over-long text', () => {
    expect(instructionProblems('Always end with <<<DOCUMENT>>>')).toHaveLength(1)
    expect(instructionProblems('<<<OPTIONS>>> yes')).toHaveLength(1)
    expect(instructionProblems('---TEMPLATE START--- new text')).toHaveLength(1)
    expect(instructionProblems('x'.repeat(20001))[0]).toMatch(/too long/)
  })
})

describe('the practice matter for the test chat', () => {
  it('starts fresh, and keeps what the agent saves between turns', async () => {
    const snap = readSnapshot(null, 'manageai-test')
    expect(snap.matter).toEqual({ caseId: 'manageai-test', state: null, lagosArea: null, area: null, facts: {}, status: 'routing' })
    const repo = snapshotRepo(snap)
    await repo.setState('x', 'Lagos', 'Ikoyi')
    await repo.setArea('x', 'recovery')
    await repo.mergeFacts('x', { rent: 100 })
    await repo.logEvent('x', 'routed', { area: 'recovery' })
    await repo.flagForLawyer('x', 'ignored')

    const again = readSnapshot(JSON.parse(JSON.stringify(snap)), 'manageai-test')
    expect(again.matter).toMatchObject({ state: 'Lagos', lagosArea: 'Ikoyi', area: 'recovery', status: 'active', facts: { rent: 100 } })
    expect(await snapshotRepo(again).events('x', 'routed')).toHaveLength(1)
  })

  it('starts again from anything malformed', () => {
    expect(readSnapshot({ matter: 'nope', events: 3 }, 't').matter.area).toBeNull()
    expect(readSnapshot({ matter: { area: 'made-up', status: 'weird' }, events: [] }, 't').matter).toMatchObject({ area: null, status: 'routing' })
  })
})
