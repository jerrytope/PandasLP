export const runtime = 'nodejs'

import { requireAiManager } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { AGENTS } from '@/lib/agents'
import { AREAS, ENABLED_AREAS, areaBlock } from '@/lib/property/areas'
import { SHARED_PROPERTY_BLOCK } from '@/lib/property/shared'
import { propertyAgentV2Enabled } from '@/lib/property/starter'
import {
  ALL_TARGETS,
  FOCUS_TARGETS,
  MAX_INSTRUCTIONS_LENGTH,
  MAX_NOTE_LENGTH,
  areaOfTarget,
  instructionProblems,
  isInstructionTarget,
  type InstructionTarget,
} from '@/lib/agentInstructionTargets'
import {
  discardDraft,
  draftsByTarget,
  latestVersions,
  publish,
  restore,
  saveDraft,
  signOff,
  signOffsOf,
  versionsOf,
} from '@/lib/agentInstructions'

const RATE_LIMIT = 120
const RATE_WINDOW_MS = 5 * 60 * 1000

function label(target: InstructionTarget): { name: string; group: 'focus' | 'property-area' | 'other' } {
  const area = areaOfTarget(target)
  if (area) return { name: `Property · ${AREAS[area].title}`, group: 'property-area' }
  const agent = AGENTS[target as keyof typeof AGENTS]
  return { name: agent.name, group: FOCUS_TARGETS.includes(target) ? 'focus' : 'other' }
}

/** What the agent is told by the code, for the lawyer to read (it can't be edited here). */
function baseInstructions(target: InstructionTarget): string {
  const area = areaOfTarget(target)
  if (area) {
    const config = AREAS[area]
    const byState = Object.entries(config.jurisdictionRules).map(([group, rules]) => `[${group.toUpperCase()}]\n${rules}`).join('\n\n')
    return `${areaBlock(config, ENABLED_AREAS)}\n\nRULES BY STATE (only the client's state is sent):\n\n${byState}`
  }
  if (target === 'recovery-of-premises' && propertyAgentV2Enabled()) {
    return `${SHARED_PROPERTY_BLOCK}\n\n(The rebuilt Property Law Agent is on. These shared rules apply to every area; each area's own rules and templates are under its own entry.)`
  }
  return AGENTS[target as keyof typeof AGENTS].systemPrompt
}

function rateLimited(req: Request): Response | null {
  const { allowed, retryAfterSeconds } = checkRateLimit(`manageai:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  return allowed ? null : Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
}

// GET: every target with its live version, draft and latest sign-off.
// GET ?target=: one target in full: the code's instructions, the draft, every version, every sign-off.
export async function GET(req: Request) {
  const limited = rateLimited(req)
  if (limited) return limited
  const auth = await requireAiManager(req)
  if (auth instanceof Response) return auth

  const target = new URL(req.url).searchParams.get('target')
  try {
    if (target) {
      if (!isInstructionTarget(target)) return Response.json({ error: 'Unknown agent.' }, { status: 400 })
      const [versions, drafts, signOffs] = await Promise.all([versionsOf(target), draftsByTarget(), signOffsOf(target)])
      return Response.json({
        target,
        ...label(target),
        propertyV2: propertyAgentV2Enabled(),
        base: baseInstructions(target),
        // The test chat opens with what a client sees first.
        starterMessage: AGENTS[areaOfTarget(target) ? 'recovery-of-premises' : (target as keyof typeof AGENTS)].starterMessage,
        draft: drafts.get(target) ?? null,
        versions,
        signOffs,
      })
    }

    const [latest, drafts, signOffs] = await Promise.all([latestVersions(), draftsByTarget(), signOffsOf()])
    // Property areas are only used by the rebuilt agent; hide them while it's off.
    const targets = ALL_TARGETS.filter((t) => propertyAgentV2Enabled() || !areaOfTarget(t))
    return Response.json({
      propertyV2: propertyAgentV2Enabled(),
      targets: targets.map((t) => {
        const live = latest.get(t) ?? null
        return {
          target: t,
          ...label(t),
          live: live && { version: live.version, hasText: live.body.trim().length > 0, createdBy: live.createdBy, createdAt: live.createdAt },
          hasDraft: drafts.has(t),
          signOff: signOffs.find((s) => s.target === t) ?? null,
        }
      }),
    })
  } catch (err) {
    console.error('manageai GET failed:', err)
    return Response.json({ error: 'Could not load the drafting instructions.' }, { status: 500 })
  }
}

type Body = {
  action?: string
  target?: string
  body?: string
  note?: string
  version?: number
  basedOnVersion?: number | null
  signedName?: string
}

// POST { action, target, ... }:
//   save_draft { body, basedOnVersion }  · discard_draft
//   publish { body, note }               · restore { version, note }
//   sign_off { signedName, note }
export async function POST(req: Request) {
  const limited = rateLimited(req)
  if (limited) return limited
  const auth = await requireAiManager(req)
  if (auth instanceof Response) return auth
  const by = auth.user.email ?? auth.user.id

  let input: Body
  try {
    input = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const { action, target } = input
  if (!isInstructionTarget(target)) return Response.json({ error: 'Unknown agent.' }, { status: 400 })
  const note = typeof input.note === 'string' ? input.note.trim() : ''
  if (note.length > MAX_NOTE_LENGTH) return Response.json({ error: `The note is too long (limit ${MAX_NOTE_LENGTH} characters).` }, { status: 400 })

  try {
    switch (action) {
      case 'save_draft': {
        if (typeof input.body !== 'string') return Response.json({ error: 'Missing the instructions.' }, { status: 400 })
        if (input.body.length > MAX_INSTRUCTIONS_LENGTH) return Response.json({ error: `The instructions are too long (limit ${MAX_INSTRUCTIONS_LENGTH.toLocaleString()} characters).` }, { status: 400 })
        const basedOn = typeof input.basedOnVersion === 'number' ? input.basedOnVersion : null
        await saveDraft(target, input.body, basedOn, by)
        return Response.json({ ok: true })
      }
      case 'discard_draft':
        await discardDraft(target)
        return Response.json({ ok: true })
      case 'publish': {
        if (typeof input.body !== 'string') return Response.json({ error: 'Missing the instructions.' }, { status: 400 })
        const problems = instructionProblems(input.body)
        if (problems.length) return Response.json({ error: problems.join(' ') }, { status: 422 })
        if (!note) return Response.json({ error: 'Say briefly what changed and why, so the history makes sense later.' }, { status: 400 })
        const version = await publish(target, input.body.trim(), note, by)
        return Response.json({ ok: true, version })
      }
      case 'restore': {
        if (typeof input.version !== 'number' || !Number.isInteger(input.version)) return Response.json({ error: 'Missing the version to restore.' }, { status: 400 })
        const version = await restore(target, input.version, note, by)
        return Response.json({ ok: true, version })
      }
      case 'sign_off': {
        const signedName = typeof input.signedName === 'string' ? input.signedName.trim() : ''
        if (!signedName || signedName.length > 200) return Response.json({ error: 'Type your full name to sign off.' }, { status: 400 })
        const version = await signOff(target, signedName, note, by)
        return Response.json({ ok: true, version })
      }
      default:
        return Response.json({ error: 'Unknown action.' }, { status: 400 })
    }
  } catch (err) {
    if (err instanceof RangeError) return Response.json({ error: err.message }, { status: 400 })
    console.error(`manageai ${action} failed:`, err)
    return Response.json({ error: 'Something went wrong. Nothing was changed.' }, { status: 500 })
  }
}
