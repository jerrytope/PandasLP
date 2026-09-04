import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

/* The directory. This is the part that scales: a seventh practice area is a
   new entry in the two arrays below plus one page file, not a redesign.
   Availability is kept in step with lib/agentCapabilities.ts. */

export const metadata: Metadata = {
  title: 'Legal Agents',
  description:
    'The Pandas LP legal agents. Debt recovery and property law are open today, each drafted by an agent grounded in Nigerian law and signed by a licensed practitioner.',
  alternates: { canonical: '/agents' },
}

const LIVE = [
  {
    href: '/agents/debt-recovery',
    name: 'Debt Recovery',
    price: 'From ₦10,000',
    line: 'Demand letter, Day 7 and Day 14 follow-ups, then filing at the Small Claims Court.',
    img: '/img/img-debt.jpg',
    alt: 'A sealed letter on firm stationery, ready to be served',
  },
  {
    href: '/agents/property-law',
    name: 'Property Law',
    price: 'From ₦5,000',
    line: 'Nine Nigerian property instruments, from one conversation.',
    img: '/img/img-property.jpg',
    alt: 'A folded land survey plan, a rolled deed and two keys',
  },
]

const NEXT_UP = [
  { name: 'Judgment Enforcement', line: 'For when a debtor has lost in court and still has not paid.' },
  { name: 'Lawyer Consultation', line: 'For matters that need judgment and conversation, not a document.' },
  { name: 'Contracts and Commercial', line: 'NDAs, employment, partnership and vendor agreements.' },
  { name: 'CAC Registration', line: 'Business name or company registration, as a guided conversation.' },
]

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <section className="lp-hero lp-container" aria-label="Legal agents">
          <div className="lp-hero-copy" style={{ maxWidth: '46ch' }}>
            <div className="lp-eyebrow">Legal agents</div>
            <h1 className="lp-h1">Two open today.</h1>
            <p className="lp-lede">
              Each one drafts from the firm’s own templates and stops at the same line: nothing
              reaches a debtor, a tenant or a court without a licensed practitioner signing it.
            </p>
          </div>
        </section>

        <section className="lp-section lp-muted" aria-label="Open now">
          <div className="lp-container">
            <div className="lp-agents">
              {LIVE.map((a) => (
                <Link key={a.href} href={a.href} className="lp-agent ap-card">
                  <div className="lp-agent-img">
                    <img src={a.img} alt={a.alt} loading="lazy" />
                  </div>
                  <div className="lp-agent-head">
                    <h2>{a.name}</h2>
                    <span className="lp-eyebrow">{a.price}</span>
                  </div>
                  <div className="lp-agent-body">
                    <p>{a.line}</p>
                  </div>
                  <div className="lp-agent-foot">
                    <span className="ap-card-go">See what it does and what it will not do &rarr;</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-container" aria-label="Not open yet">
          <h2 className="lp-h2 lp-section-head">Written and priced, not open yet.</h2>
          <div className="ap-next">
            {NEXT_UP.map((n) => (
              <div key={n.name} className="ap-next-item">
                <h3>{n.name}</h3>
                <p>{n.line}</p>
              </div>
            ))}
          </div>
          <p className="lp-note">
            These open as practitioner capacity allows. We will not run a matter we cannot see
            through to court.
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
