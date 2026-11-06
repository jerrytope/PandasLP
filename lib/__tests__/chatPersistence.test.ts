import { describe, expect, it } from 'vitest'
import { resolveStoredTurn, type StoredChatMessage } from '../chatPersistence'

const starter = 'Hello'

function row(id: string, role: string, content: string, replyTo: string | null = null): StoredChatMessage {
  return { id, role, content, reply_to_message_id: replyTo }
}

describe('resolveStoredTurn', () => {
  it('builds history from stored messages and adds the opening message once', () => {
    expect(resolveStoredTurn([row('u1', 'user', 'I need help')], 'u1', starter)).toEqual({
      kind: 'ready',
      messages: [
        { role: 'assistant', content: starter },
        { role: 'user', content: 'I need help' },
      ],
    })
  })

  it('replays a saved reply for a retried user turn', () => {
    expect(resolveStoredTurn([
      row('u1', 'user', 'I need help'),
      row('a1', 'assistant', 'Here is the answer', 'u1'),
    ], 'u1', starter)).toEqual({
      kind: 'replay',
      response: 'Here is the answer',
      messageId: 'a1',
    })
  })

  it('recognizes a legacy reply immediately after its user turn', () => {
    expect(resolveStoredTurn([
      row('u1', 'user', 'I need help'),
      row('a1', 'assistant', 'Prior answer'),
    ], 'u1', starter)).toMatchObject({ kind: 'replay', response: 'Prior answer' })
  })

  it('rejects stale turns after a later user message exists', () => {
    expect(resolveStoredTurn([
      row('u1', 'user', 'First'),
      row('a1', 'assistant', 'First answer'),
      row('u2', 'user', 'Second'),
    ], 'u1', starter)).toEqual({ kind: 'conflict' })
  })

  it('rejects unknown message ids', () => {
    expect(resolveStoredTurn([], 'missing', starter)).toEqual({ kind: 'not_found' })
  })
})
