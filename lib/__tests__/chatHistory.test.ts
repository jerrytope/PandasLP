import { describe, it, expect } from 'vitest'
import { capHistory, MAX_MESSAGES, KEEP_FROM_START, type ChatMessage } from '../chatHistory'

function makeMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `message ${i}`,
  }))
}

describe('capHistory', () => {
  it('leaves short conversations untouched', () => {
    const messages = makeMessages(10)
    expect(capHistory(messages)).toEqual(messages)
  })

  it('leaves a conversation exactly at the limit untouched', () => {
    const messages = makeMessages(MAX_MESSAGES)
    expect(capHistory(messages)).toEqual(messages)
  })

  it('caps a runaway conversation to the configured size', () => {
    const messages = makeMessages(MAX_MESSAGES + 40)
    const result = capHistory(messages)
    expect(result.length).toBe(MAX_MESSAGES)
  })

  it('keeps the earliest messages (where initial facts live) and the most recent window', () => {
    const messages = makeMessages(MAX_MESSAGES + 40)
    const result = capHistory(messages)
    expect(result.slice(0, KEEP_FROM_START)).toEqual(messages.slice(0, KEEP_FROM_START))
    expect(result.slice(KEEP_FROM_START)).toEqual(messages.slice(-(MAX_MESSAGES - KEEP_FROM_START)))
    // The most recent message must never be dropped
    expect(result[result.length - 1]).toEqual(messages[messages.length - 1])
  })
})
