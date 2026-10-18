// What the lead lawyer can give drafting instructions for on /manageai, and how those
// instructions are worded to the agent. Pure (no database), so it is unit-tested directly and
// safe to import anywhere. Loading and saving are in lib/agentInstructions.ts.
//
// A target is one agent, or one area of the rebuilt Property Law Agent. Its id is what
// agent_instruction_versions.target stores (add-agent-instructions.sql), so ids never change.

import type { AgentId } from './agents'
import { PROPERTY_AREAS, type PropertyArea } from './property/types'

export const AGENT_TARGETS = [
  'small-claims',
  'recovery-of-premises',
  'contracts',
  'cac-registration',
  'judgment-enforcement',
  'lawyer-consultation',
] as const satisfies readonly AgentId[]

export type AreaTarget = `property:${PropertyArea}`
export type InstructionTarget = AgentId | AreaTarget

export const AREA_TARGETS: AreaTarget[] = PROPERTY_AREAS.map((a) => `property:${a}` as const)
export const ALL_TARGETS: InstructionTarget[] = [...AGENT_TARGETS, ...AREA_TARGETS]

export function isInstructionTarget(value: unknown): value is InstructionTarget {
  return typeof value === 'string' && (ALL_TARGETS as string[]).includes(value)
}

export function areaOfTarget(target: InstructionTarget): PropertyArea | null {
  return target.startsWith('property:') ? (target.slice('property:'.length) as PropertyArea) : null
}

/** Small claims and property get the most attention, so they're listed first. */
export const FOCUS_TARGETS: InstructionTarget[] = ['small-claims', 'recovery-of-premises']

/** Longest instructions accepted (the database CHECK is the same). */
export const MAX_INSTRUCTIONS_LENGTH = 20000
export const MAX_NOTE_LENGTH = 2000

const HEADING = `LEAD LAWYER'S DRAFTING INSTRUCTIONS
These come from Pandas LP's lead lawyer. Follow them every time you draft or revise a document. Where one conflicts with anything above about how a document is worded, laid out or structured, follow the instruction below. They never change the price of a document, the <<<DOCUMENT>>> format, or the tools you must use.`

/**
 * The instructions as the agent sees them. Several sets (the whole property agent, then one
 * area) are listed in that order. Empty sets are left out; nothing at all gives ''.
 */
export function draftingInstructionsBlock(sets: (string | null | undefined)[]): string {
  const bodies = sets.map((s) => (s ?? '').trim()).filter(Boolean)
  if (bodies.length === 0) return ''
  return `${HEADING}\n\n${bodies.join('\n\n')}`
}

/** The base instructions with the lawyer's added at the end. With none, exactly the base. */
export function withDraftingInstructions(base: string, sets: (string | null | undefined)[]): string {
  const block = draftingInstructionsBlock(sets)
  return block ? `${base}\n\n${block}` : base
}

/** The instruction sets that apply to a target, broadest first (the property agent, then an area). */
export function applicableTargets(target: InstructionTarget): InstructionTarget[] {
  return areaOfTarget(target) ? ['recovery-of-premises', target] : [target]
}

/** Problems that stop a publish, in plain English. Empty = fine. */
export function instructionProblems(body: string): string[] {
  const problems: string[] = []
  if (body.length > MAX_INSTRUCTIONS_LENGTH) problems.push(`The instructions are too long (${body.length.toLocaleString()} characters; the limit is ${MAX_INSTRUCTIONS_LENGTH.toLocaleString()}).`)
  // These markers are how the app finds a document or an options list in the agent's reply.
  // Written into the instructions, the agent may copy them and break the reply.
  if (/<<<\s*(END_)?(DOCUMENT|OPTIONS)\s*>>>/i.test(body)) problems.push('Remove the <<<DOCUMENT>>> / <<<OPTIONS>>> markers: describe the change in words instead.')
  if (/---\s*TEMPLATE (START|END)\s*---/i.test(body)) problems.push('Remove the ---TEMPLATE START--- / ---TEMPLATE END--- markers: describe the change in words instead.')
  return problems
}
