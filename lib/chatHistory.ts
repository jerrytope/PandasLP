export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Claude receives the full conversation on every turn (no server-side memory), so an
// unbounded interview grows cost and latency linearly with no ceiling. Real intakes here
// resolve in well under MAX_MESSAGES turns, so this is a no-op for normal use — it only
// kicks in for runaway/pathological conversations. Keep a few messages from the start
// (where the client's initial facts usually live) plus the most recent window.
export const MAX_MESSAGES = 60
export const KEEP_FROM_START = 4

export function capHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages
  const start = messages.slice(0, KEEP_FROM_START)
  const recent = messages.slice(-(MAX_MESSAGES - KEEP_FROM_START))
  return [...start, ...recent]
}
