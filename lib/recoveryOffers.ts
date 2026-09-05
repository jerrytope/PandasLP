import { AGENT_CAPABILITIES } from './agentCapabilities'
import { getAgentPayment } from './agentServiceMap'
import type { AgentId } from './agents'
import type { RecoveryOffer } from './emailTemplates'

/* ─────────────────────────────────────────────────────────────────────────
   What the recovery email is allowed to offer a client.

   Two gates, both of which must pass, because this email goes to a real
   client and every line in it is a representation about what the firm can
   do for them today:

     1. AGENT_CAPABILITIES[id].availability === 'live'. An agent that is
        'soon' or 'testing' is never advertised, no matter what copy exists
        for it below. This is the same source of truth the /agents page
        reads, so an agent going live lights up in both places at once and
        neither can drift from the other.

     2. There is hand-written client-facing copy for it here. An agent that
        goes live without copy is silently left out rather than described by
        some generated sentence. Omission is the safe failure.

   Prices come from getAgentPayment, never from a literal typed into an
   email template, so a price change cannot leave a stale figure in a
   client's inbox.
   ───────────────────────────────────────────────────────────────────────── */

interface OfferCopy {
  name: string
  href: string
  // Two phrasings: one for the service they have just used (a repeat instruction),
  // one for a service that would be new to them.
  repeat: (price: string) => string
  fresh: (price: string) => string
}

const OFFER_COPY: Partial<Record<AgentId, OfferCopy>> = {
  'small-claims': {
    name: 'Debt recovery',
    href: '/agents/debt-recovery',
    repeat: (p) => `Someone else owing you? The same process again, from ${p}.`,
    fresh: (p) => `Someone owes you and has stopped replying. Demand letter, follow ups, then court. From ${p}.`,
  },
  'recovery-of-premises': {
    name: 'Property law',
    href: '/agents/property-law',
    repeat: (p) => `Another property matter? From ${p}.`,
    fresh: (p) => `Tenancies, quit notices, deeds and title searches. From ${p}.`,
  },
}

const money = (n: number) => '₦' + n.toLocaleString('en-NG')

export function buildRecoveryOffers(siteUrl: string, currentAgentId: string | null): RecoveryOffer[] {
  return (Object.keys(OFFER_COPY) as AgentId[])
    .filter((id) => AGENT_CAPABILITIES[id]?.availability === 'live')
    .map((id) => {
      const copy = OFFER_COPY[id]!
      const price = money(getAgentPayment(id).amount)
      return {
        name: copy.name,
        line: id === currentAgentId ? copy.repeat(price) : copy.fresh(price),
        href: `${siteUrl}${copy.href}`,
      }
    })
}
