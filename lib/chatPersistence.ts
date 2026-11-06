import type { ChatMessage } from './chatHistory'

export interface StoredChatMessage {
  id: string
  role: string
  content: string
  reply_to_message_id?: string | null
}

export type StoredTurn =
  | { kind: 'ready'; messages: ChatMessage[] }
  | { kind: 'replay'; response: string; messageId: string }
  | { kind: 'not_found' }
  | { kind: 'conflict' }

export function resolveStoredTurn(
  rows: StoredChatMessage[],
  userMessageId: string,
  starter: string,
): StoredTurn {
  const userMessageIndex = rows.findIndex((message) => message.id === userMessageId)
  if (userMessageIndex < 0 || rows[userMessageIndex].role !== 'user') return { kind: 'not_found' }

  const savedReply = rows.find(
    (message) => message.role === 'assistant' && message.reply_to_message_id === userMessageId,
  )
  if (savedReply) return { kind: 'replay', response: savedReply.content, messageId: savedReply.id }

  const followingMessages = rows.slice(userMessageIndex + 1)
  if (followingMessages.length > 0) {
    if (followingMessages.length === 1 && followingMessages[0].role === 'assistant') {
      return { kind: 'replay', response: followingMessages[0].content, messageId: followingMessages[0].id }
    }
    return { kind: 'conflict' }
  }

  const messages = rows.slice(0, userMessageIndex + 1)
  if (messages.some((message) => message.role !== 'user' && message.role !== 'assistant')) {
    return { kind: 'conflict' }
  }
  const history: ChatMessage[] = messages.map((message) => ({
    role: message.role as ChatMessage['role'],
    content: message.content,
  }))
  if (history[0]?.content !== starter) history.unshift({ role: 'assistant', content: starter })
  if (history[history.length - 1]?.role !== 'user') return { kind: 'conflict' }
  return { kind: 'ready', messages: history }
}
