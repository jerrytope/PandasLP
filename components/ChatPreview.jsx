'use client'

import { useState } from 'react'
import chat from './AgentChat.module.css'

/* ─────────────────────────────────────────────────────────────
   A working miniature of the real agent interface.

   It imports AgentChat.module.css directly, so the header, the bubble
   rows and the bubbles are styled by the same rules that style the
   product itself. Change the chat, this changes with it. That is the
   point: it is a preview of the real thing, not a drawing of it.

   Interactive on purpose. The two tabs are the site's actual routing
   decision ("which of these is your problem?"), so choosing one both
   previews that agent and sets where the button underneath goes.
   ───────────────────────────────────────────────────────────── */

const PREVIEWS = {
  debt: {
    label: 'Someone owes me money',
    agentId: 'small-claims',
    name: 'Small Claims Court Agent',
    sub: 'From ₦10,000',
    cta: 'Start a recovery matter',
    turns: [
      ['a', 'Who owes you money, and what was it for?'],
      ['u', 'my business partner. he took the client payment on a construction job and never paid my share. about ₦1.2 million'],
      ['a', 'Was there a written partnership agreement, or was it verbal?'],
      ['u', 'verbal. but we have whatsapp messages where he agreed to the 50/50 split'],
      ['a', 'Those are admissible. I should be straight with you though: a verbal partnership with no written terms is contestable if he disputes the percentage.'],
    ],
  },
  property: {
    label: 'I have a property matter',
    agentId: 'recovery-of-premises',
    name: 'Property Law Agent',
    sub: 'From ₦5,000',
    cta: 'Start a property matter',
    turns: [
      ['a', 'What do you need today?'],
      ['u', 'my tenant in surulere hasn’t paid since january. i already sent him a whatsapp telling him to leave in one month'],
      ['a', 'How was the rent paid, and is the property in Lagos State?'],
      ['u', 'yearly. yes, lagos'],
      ['a', 'Then that notice would not stand. A yearly tenancy needs six months, not one, and a short notice is void. We start again properly.'],
    ],
  },
}

export default function ChatPreview({ onOpenAgent }) {
  const [key, setKey] = useState('debt')
  const p = PREVIEWS[key]

  return (
    <div className="lp-preview">
      <div className="lp-preview-tabs" role="tablist" aria-label="Choose your matter">
        {Object.entries(PREVIEWS).map(([k, v]) => (
          <button
            key={k}
            role="tab"
            aria-selected={key === k}
            className={`lp-preview-tab${key === k ? ' is-on' : ''}`}
            onClick={() => setKey(k)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="lp-preview-frame">
        <div className={chat.header}>
          <span className={chat.headerDot} aria-hidden="true" />
          <div className={chat.headerInfo}>
            <div className={chat.headerName}>{p.name}</div>
            <div className={chat.headerSub}>{p.sub}</div>
          </div>
        </div>

        {/* keyed so switching tabs replays the reveal */}
        <div className={chat.messages} key={key}>
          {p.turns.map(([who, text], i) => (
            <div
              key={i}
              className={`${chat.bubbleRow} ${who === 'u' ? chat.bubbleRowUser : chat.bubbleRowAssistant} lp-preview-turn`}
              style={{ animationDelay: `${i * 0.42}s` }}
            >
              <div className={`${chat.bubble} ${who === 'u' ? chat.bubbleUser : chat.bubbleAssistant}`}>
                {text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => onOpenAgent(p.agentId)}
      >
        {p.cta}
      </button>
    </div>
  )
}
