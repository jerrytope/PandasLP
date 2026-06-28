'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Agent } from '@/lib/agents'
import styles from './AgentChat.module.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AgentChatProps {
  agent: Agent
  onClose: () => void
  onContinue?: () => void
  continueLabel?: string
}

function renderContent(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export default function AgentChat({ agent, onClose, onContinue, continueLabel }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: agent.starterMessage }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, loading])

  function handleClear() {
    setMessages([{ role: 'assistant', content: agent.starterMessage }])
    setError('')
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    const nextMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, agentId: agent.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={agent.name}>
        <div className={styles.header}>
          <span className={styles.headerDot} style={{ background: agent.color }} />
          <div className={styles.headerInfo}>
            <div className={styles.headerName}>{agent.name}</div>
            <div className={styles.headerSub}>Pandas LP · Nigerian Law</div>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleClear}
              aria-label="Clear chat"
              title="Clear chat"
            >
              ↺
            </button>
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close chat" title="Close">
              ✕
            </button>
          </div>
        </div>

        <div className={styles.disclaimer}>This agent prepares legal documents — not legal advice.</div>

        <div className={styles.messages} ref={messagesRef}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={`${styles.bubbleRow} ${m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant}`}
            >
              <div className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
                {renderContent(m.content)}
              </div>
            </div>
          ))}

          {loading && (
            <div className={`${styles.bubbleRow} ${styles.bubbleRowAssistant}`}>
              <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                <span className={styles.typingDots}>
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}

          {error && <div className={styles.bubbleError}>{error}</div>}
        </div>

        {onContinue && (
          <div className={styles.continueBar}>
            <button type="button" className="btn btn-primary btn-block" onClick={onContinue}>
              {continueLabel || 'Continue →'}
            </button>
          </div>
        )}

        <div className={styles.inputRow}>
          <textarea
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message…"
            rows={1}
          />
          <button type="button" className="btn btn-primary" onClick={handleSend} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
