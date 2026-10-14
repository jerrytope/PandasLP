import type { MatterStore } from '../matterStore'
import type { PropertyArea } from '../types'
import type { PropertyDocumentKey } from '../../propertyPricing'

/** A document a tool approved this turn, already rendered in the <<<DOCUMENT>>> format. */
export interface EmittedDocument {
  type: PropertyDocumentKey
  title: string
  price: number
  priceLabel: string
  /** The exact text AgentChat parses (lib/agentChatParsing.ts). */
  block: string
}

/** What every property tool can see and change during one chat turn. */
export interface PropertyToolContext {
  caseId: string
  /** The area handling the matter. handoff_to changes it. */
  area: PropertyArea | null
  store: MatterStore
  /** Filled by emit_document; the orchestrator appends these to the reply. */
  emitted: EmittedDocument[]
}

// ----- Input helpers: a RangeError goes back to the model as a fixable tool error. -----

export function requireString(input: Record<string, unknown>, key: string, maxLength = 2000): string {
  const value = input[key]
  if (typeof value !== 'string' || !value.trim()) throw new RangeError(`${key} is required.`)
  if (value.length > maxLength) throw new RangeError(`${key} is too long (at most ${maxLength} characters).`)
  return value.trim()
}

export function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key]
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new RangeError(`${key} must be text.`)
  return value.trim()
}

export function requireNumber(input: Record<string, unknown>, key: string): number {
  const value = input[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError(`${key} must be a number.`)
  return value
}

export function optionalNumber(input: Record<string, unknown>, key: string): number | undefined {
  return input[key] === undefined || input[key] === null ? undefined : requireNumber(input, key)
}

export function optionalBoolean(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') throw new RangeError(`${key} must be true or false.`)
  return value
}

export function requireObject(input: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = input[key]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RangeError(`${key} must be an object.`)
  return value as Record<string, unknown>
}

/** Naira for a price label: ₦1,250,000. */
export function naira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`
}
