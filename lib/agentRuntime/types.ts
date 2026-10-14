import type { ClaudeCallOptions, ClaudeMessage, ClaudeResult, ClaudeTool, SystemBlock } from '../claude'

/**
 * Ends the agent's turn early, after the current round of tools has run: a hand-off switches
 * to another agent, an escalation stops drafting. The caller decides what each kind means.
 */
export interface StopSignal {
  kind: string
  data?: Record<string, unknown>
}

export type ToolOutcome =
  | { ok: true; result: unknown; stop?: StopSignal }
  | { ok: false; error: string }

/** A tool: what the model sees (its JSON schema) and the server-side code that runs it. */
export interface AgentTool<Ctx> {
  definition: ClaudeTool
  handler: (input: Record<string, unknown>, ctx: Ctx) => ToolOutcome | Promise<ToolOutcome>
}

/** How the runtime calls the model. callClaude in production; a stand-in in tests. */
export type ModelCaller = (opts: ClaudeCallOptions) => Promise<ClaudeResult>

export interface RunAgentOptions<Ctx> {
  /** For cost reporting, e.g. "chat.property.recovery". */
  route: string
  system: SystemBlock[]
  tools: AgentTool<Ctx>[]
  messages: ClaudeMessage[]
  ctx: Ctx
  /** Model calls allowed in one turn before giving up. */
  maxSteps: number
  maxTokens: number
  caseId?: string | null
  model?: string
  cacheConversation?: boolean
  call?: ModelCaller
}

export type RunAgentResult =
  | {
      ok: true
      /** Everything the model said to the client this turn, in order. */
      text: string
      /** The turn's new messages (assistant turns and tool results), to continue from. */
      newMessages: ClaudeMessage[]
      stop: StopSignal | null
      steps: number
      costUsd: number
    }
  | {
      ok: false
      kind: 'model' | 'max_steps'
      error: string
      newMessages: ClaudeMessage[]
      steps: number
      costUsd: number
      notConfigured?: boolean
    }
