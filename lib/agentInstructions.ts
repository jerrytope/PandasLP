// The lead lawyer's drafting instructions (add-agent-instructions.sql): loading the live ones
// for the agents, and the drafts, versions and sign-offs behind /manageai. Server-only (uses the
// service-role client). The wording and the targets are in lib/agentInstructionTargets.ts.
//
// An agent must never fail because of this: if the instructions can't be read, it runs on its
// code instructions alone, exactly as before /manageai existed.

import { supabaseAdmin } from './supabaseAdmin'
import { applicableTargets, type InstructionTarget } from './agentInstructionTargets'

const KIND = 'drafting_notes'

export interface InstructionVersion {
  target: InstructionTarget
  version: number
  body: string
  note: string
  restoredFrom: number | null
  createdBy: string
  createdAt: string
}

export interface InstructionDraft {
  target: InstructionTarget
  body: string
  basedOnVersion: number | null
  updatedBy: string
  updatedAt: string
}

export interface SignOff {
  target: InstructionTarget
  version: number
  signedBy: string
  signedName: string
  note: string
  createdAt: string
}

type VersionRow = { target: string; version: number; body: string; note: string; restored_from: number | null; created_by: string; created_at: string }

function toVersion(r: VersionRow): InstructionVersion {
  return { target: r.target as InstructionTarget, version: r.version, body: r.body, note: r.note, restoredFrom: r.restored_from, createdBy: r.created_by, createdAt: r.created_at }
}

// ----- What the agents read -----

// A publish shows up within this long on every server; straight away on the one that published
// (clearInstructionCache).
const CACHE_MS = 30_000
let cache: { at: number; live: Map<string, string> } | null = null

export function clearInstructionCache(): void {
  cache = null
}

/** The live instructions for every target that has some (latest version, non-empty). */
async function liveInstructions(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.live
  try {
    const { data, error } = await supabaseAdmin
      .from('agent_instruction_versions')
      .select('target, version, body')
      .eq('kind', KIND)
      .order('version', { ascending: false })
    if (error) throw new Error(error.message)
    const live = new Map<string, string>()
    for (const row of data ?? []) if (!live.has(row.target)) live.set(row.target, row.body)
    cache = { at: Date.now(), live }
    return live
  } catch (err) {
    console.error('Could not load the lead lawyer\'s drafting instructions; using the code instructions alone:', err)
    // Try again on the next request rather than caching the failure.
    return new Map()
  }
}

/**
 * The instruction sets that apply to a target, broadest first, ready for
 * withDraftingInstructions(). `override` replaces one target's live instructions (the test
 * chat on /manageai tries a draft this way).
 */
export async function instructionsFor(target: InstructionTarget, override?: { target: InstructionTarget; body: string }): Promise<string[]> {
  const live = await liveInstructions()
  return applicableTargets(target).map((t) => (override && override.target === t ? override.body : live.get(t) ?? ''))
}

/** The live instructions for every target, for the property agent (which picks its area per turn). */
export async function allLiveInstructions(override?: { target: InstructionTarget; body: string }): Promise<Partial<Record<InstructionTarget, string>>> {
  const live = await liveInstructions()
  const all: Partial<Record<InstructionTarget, string>> = Object.fromEntries(live) as Partial<Record<InstructionTarget, string>>
  if (override) all[override.target] = override.body
  return all
}

// ----- /manageai -----

function fail(action: string, error: { message: string }): never {
  throw new Error(`Drafting instructions: could not ${action}: ${error.message}`)
}

const VERSION_COLUMNS = 'target, version, body, note, restored_from, created_by, created_at'

/** Every version of a target, newest first. */
export async function versionsOf(target: InstructionTarget): Promise<InstructionVersion[]> {
  const { data, error } = await supabaseAdmin
    .from('agent_instruction_versions')
    .select(VERSION_COLUMNS)
    .eq('target', target)
    .eq('kind', KIND)
    .order('version', { ascending: false })
  if (error) fail('read the versions', error)
  return (data ?? []).map((r) => toVersion(r as VersionRow))
}

/** The latest version of every target that has one. */
export async function latestVersions(): Promise<Map<InstructionTarget, InstructionVersion>> {
  const { data, error } = await supabaseAdmin
    .from('agent_instruction_versions')
    .select(VERSION_COLUMNS)
    .eq('kind', KIND)
    .order('version', { ascending: false })
  if (error) fail('read the versions', error)
  const latest = new Map<InstructionTarget, InstructionVersion>()
  for (const r of data ?? []) {
    const v = toVersion(r as VersionRow)
    if (!latest.has(v.target)) latest.set(v.target, v)
  }
  return latest
}

export async function draftsByTarget(): Promise<Map<InstructionTarget, InstructionDraft>> {
  const { data, error } = await supabaseAdmin.from('agent_instruction_drafts').select('target, body, based_on_version, updated_by, updated_at').eq('kind', KIND)
  if (error) fail('read the drafts', error)
  return new Map((data ?? []).map((r) => [r.target as InstructionTarget, { target: r.target as InstructionTarget, body: r.body, basedOnVersion: r.based_on_version, updatedBy: r.updated_by, updatedAt: r.updated_at }]))
}

export async function saveDraft(target: InstructionTarget, body: string, basedOnVersion: number | null, by: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('agent_instruction_drafts')
    .upsert({ target, kind: KIND, body, based_on_version: basedOnVersion, updated_by: by, updated_at: new Date().toISOString() }, { onConflict: 'target,kind' })
  if (error) fail('save the draft', error)
}

export async function discardDraft(target: InstructionTarget): Promise<void> {
  const { error } = await supabaseAdmin.from('agent_instruction_drafts').delete().eq('target', target).eq('kind', KIND)
  if (error) fail('discard the draft', error)
}

/** Publishes a new version (never replaces an old one) and removes the draft. Returns its number. */
export async function publish(target: InstructionTarget, body: string, note: string, by: string, restoredFrom: number | null = null): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('publish_agent_instructions', {
    p_target: target, p_kind: KIND, p_body: body, p_note: note, p_by: by, p_restored_from: restoredFrom,
  })
  if (error) fail('publish', error)
  clearInstructionCache()
  return data as number
}

/** Publishes a copy of an old version as the newest one. */
export async function restore(target: InstructionTarget, version: number, note: string, by: string): Promise<number> {
  const old = (await versionsOf(target)).find((v) => v.version === version)
  if (!old) throw new RangeError(`There is no version ${version} for this agent.`)
  return publish(target, old.body, note || `Restored version ${version}`, by, version)
}

export async function signOffsOf(target?: InstructionTarget): Promise<SignOff[]> {
  let query = supabaseAdmin.from('agent_signoffs').select('target, version, signed_by, signed_name, note, created_at')
  if (target) query = query.eq('target', target)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) fail('read the sign-offs', error)
  return (data ?? []).map((r) => ({ target: r.target as InstructionTarget, version: r.version, signedBy: r.signed_by, signedName: r.signed_name, note: r.note, createdAt: r.created_at }))
}

/** Records a sign-off against the version live now (0 = none published). */
export async function signOff(target: InstructionTarget, signedName: string, note: string, by: string): Promise<number> {
  const live = (await versionsOf(target))[0]?.version ?? 0
  const { error } = await supabaseAdmin.from('agent_signoffs').insert({ target, version: live, signed_by: by, signed_name: signedName, note })
  if (error) fail('record the sign-off', error)
  return live
}
