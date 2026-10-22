'use client'

import Link from 'next/link'
import RecoveredCounter from './RecoveredCounter'
import { Carousel, DocumentPreview, Eyebrow, H2, Lede, Pipeline, QuoteCard, RunLog, Section, SitePhoto, StatRow } from './ui'
import { DRAFTED_DOCUMENTS, FIRM } from '@/lib/sitePractices'
import { safeJsonLd } from '@/lib/jsonLd'
import styles from './home/home.module.css'

/* ─────────────────────────────────────────────────────────────
   Homepage ("Ink & Brass", docs/frontend-revamp-plan.md).

   Order: hero with the run-log → credentials (and published numbers) → photo band →
   how a matter moves → what we draft → what it will not do → client words (only if
   published) → confidentiality → for businesses → fees → notes → questions → what
   happens next.

   Facts come from lib/agentPagesData.js, lib/sitePractices.ts and the privacy policy.
   Numbers and client quotes appear only once staff publish them in Admin → Site content.
   Styles: components/home/home.module.css and components/ui.
   ───────────────────────────────────────────────────────────── */

const PROPERTY_AGENT = 'recovery-of-premises'
const DEBT_AGENT = 'small-claims'

const RUN_LOG = [
  { status: 'done', text: 'Facts captured from your answers', detail: '9 facts' },
  { status: 'done', text: 'Amount owed confirmed', detail: '₦2,400,000' },
  { status: 'done', text: 'Evidence and limitation period checked' },
  { status: 'done', text: 'Letter of demand drafted' },
  { status: 'done', text: 'You read the draft and paid', detail: '₦10,000' },
  { status: 'next', text: 'Awaiting review and signature by a lawyer' },
]

const PIPELINE = [
  { title: 'Interview', ai: 'Asks plain questions in your own words and saves each fact.', lawyer: 'Steps in when a matter is contested or unclear.' },
  { title: 'Draft', ai: 'Fills the firm’s own template. Never a blank page.', lawyer: 'Wrote the templates and the rules the agent follows.' },
  { title: 'You read it', ai: 'Shows you the whole draft before you pay.', lawyer: 'Nothing has gone anywhere yet.' },
  { title: 'Review and sign', ai: 'Waits.', lawyer: 'Reads, corrects and signs every document.' },
  { title: 'Serve and follow up', ai: 'Sends the Day 7 and Day 14 follow-ups.', lawyer: 'Serves it if you ask, and files at court if it comes to that.' },
]

/* Two from each practice page, word for word (lib/agentPagesData.js). */
const LIMITS = [
  { practice: 'Debt recovery', t: 'It will not tell you your odds', b: 'No prediction of winning, no guaranteed timeline. It will tell you where your evidence is thin, which is the useful version.' },
  { practice: 'Debt recovery', t: 'It will not invent authority', b: 'No case references, statute sections or monetary limits it is not certain of. It asks you to confirm instead.' },
  { practice: 'Property law', t: 'It will not advise self-help eviction', b: 'Changing locks or removing a tenant without a court order is never on the table. Notice, then court, every time.' },
  { practice: 'Property law', t: 'It stands down on contested matters', b: 'Live litigation, disputed ownership, squatters, or skipping Governor’s Consent go to a practitioner before any drafting.' },
]

/* From the privacy policy (app/privacy/page.tsx), not a new promise. */
const SAFEGUARDS = [
  { t: 'Only the people working on your matter see it', b: 'Access to case data is restricted to you and to the Pandas LP staff who need it to work on your matter.' },
  { t: 'Not sold. Not used to train AI', b: 'We do not sell your data, and it is not used to train any AI model beyond the single request needed to draft your document.' },
  { t: 'We never see your card', b: 'Payments are processed by Paystack. We receive confirmation and the amount, never your card or bank details.' },
  { t: 'Your rights under the NDPA 2023', b: 'You can ask to see, correct or delete the personal data we hold about you.' },
]

const FEE_LEAD = {
  value: '₦10,000',
  label: 'Letter of demand, yours to serve',
  note: 'Drafted from the firm’s template, reviewed and signed by a licensed practitioner before it goes anywhere. You read the draft before you pay.',
}

const FEES = [
  { label: 'The same letter, served by us', value: '₦25,000', best: 'Best if you would rather the firm delivers it.' },
  { label: 'Day 7 and Day 14 follow-ups', value: 'Included', accent: true, best: 'Sent for you once the letter is served.' },
  { label: 'Each tenancy or lease document', value: '₦25,000', best: 'Notices to quit, tenancy and lease agreements.' },
  { label: 'Deeds transferring title, invoiced by the firm', value: '2.5% of the consideration', best: 'No drafting fee on top.' },
  { label: 'Court filing fees', value: 'Set by the court', muted: true, best: 'Only if a matter goes that far.' },
]

/* Every answer restates a fact already on this page. No outcome or speed promises. */
const FAQS = [
  { q: 'What does Pandas LP do?', a: 'Pandas LP is a licensed Nigerian law firm (CAC BN 9646741) handling debt recovery and property law: letters of demand, follow-ups, filing at the Small Claims Court, notices to quit, tenancy and lease documents, deeds of assignment and property searches.' },
  { q: 'How much does a letter of demand cost?', a: 'A letter of demand is ₦10,000 if you serve it yourself, or ₦25,000 if we serve it for you. The Day 7 and Day 14 follow-ups are included. Court filing fees, if the matter goes further, are set by the court.' },
  { q: 'Who prepares and signs the documents?', a: 'Each document is drafted from the firm’s template, then reviewed and signed by a licensed legal practitioner before it goes anywhere. You read the draft before you pay.' },
  { q: 'What happens if the debtor still does not pay?', a: 'After the letter is served, a follow-up goes out on Day 7 and the response window closes on Day 14. If the debt is still unpaid, the matter can move to filing at the Small Claims Court.' },
  { q: 'How much do property documents cost?', a: 'Each tenancy or lease document is ₦25,000. Deeds transferring title are invoiced by the firm at 2.5% of the consideration.' },
  { q: 'I am not sure my debt is worth chasing. Where do I start?', a: 'Use the free debt check. It is seven quick questions, takes about a minute, and shows how strong your case looks and what it would cost.' },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LandingPage({ onOpenAgent, onStartLawyerConsult, content = null, notes = [] }) {
  const stats = content?.stats ?? { asOf: '', items: [] }
  const quotes = content?.quotes ?? []

  return (
    <>
      {/* ══ HERO ══ */}
      <section className={styles.hero} aria-label="Pandas LP">
        <div className="container" style={{ maxWidth: 'var(--max-width)', padding: '0 var(--gutter)' }}>
          <div className={styles.heroGrid}>
            <div>
              {/* The kicker sits inside the h1 so the heading carries the brand and both practice areas for search. */}
              <h1 className={styles.h1}>
                <span className={`eyebrow ${styles.h1Kicker}`}>Pandas LP · Debt recovery and property law in Nigeria</span>
                Tell us what happened. <em>We take it from there.</em>
              </h1>
              <p className={styles.heroLede}>
                Recover money you are owed with a letter of demand from ₦10,000, reviewed and signed by a licensed practitioner.
                Day 7 and Day 14 follow-ups are included.
              </p>
              <div className={styles.heroActions}>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => onOpenAgent(DEBT_AGENT)}>Recover a debt</button>
                <button type="button" className="btn btn-outline btn-lg" onClick={() => onOpenAgent(PROPERTY_AGENT)}>I have a property matter</button>
              </div>
              <div className={styles.heroLinks}>
                <span>Not sure it is worth chasing? <Link href="/debt-check?ref=home-hero">Take the free 1-minute debt check</Link></span>
                <button type="button" onClick={onStartLawyerConsult}>Speak to a lawyer first</button>
              </div>
            </div>
            <RunLog title="matter PLP-0142 · Letter of demand · Lagos" steps={RUN_LOG} />
          </div>
        </div>
      </section>

      {/* ══ CREDENTIALS, and numbers once published ══ */}
      <div className="container" style={{ maxWidth: 'var(--max-width)', padding: '0 var(--gutter) 64px' }}>
        <ul className={styles.proof} aria-label="About the firm">
          <li>{FIRM.registration}</li>
          <li>Signed by a licensed practitioner</li>
          <li>You read the draft before you pay</li>
          <li>No retainer. No hourly rate.</li>
        </ul>
        {stats.items.length > 0 && (
          <div className={styles.proofStats}>
            <StatRow items={stats.items} asOf={stats.asOf} />
          </div>
        )}
      </div>

      {/* ══ PHOTO BAND ══ */}
      <Section tone="band" label="Our work" flush>
        <SitePhoto photo={content?.photos?.hero} label="The firm at work" ratio="21 / 9" />
        <p className={styles.bandLine}>
          The agent drafts. <span>A licensed practitioner signs.</span> Nothing reaches a debtor, a tenant or a court before that.
        </p>
      </Section>

      {/* ══ RECOVERED ══ renders nothing until there is a real confirmed total */}
      <RecoveredCounter />

      {/* ══ HOW A MATTER MOVES ══ */}
      <Section id="how-it-works" label="How a matter moves">
        <Eyebrow>How a matter moves</Eyebrow>
        <H2>Five steps, and one of them is always a person.</H2>
        <div style={{ marginTop: 48 }}>
          <Pipeline steps={PIPELINE} />
        </div>
      </Section>

      {/* ══ WHAT WE DRAFT ══ */}
      <Section tone="muted" id="services" label="What we draft">
        <Carousel
          label="Documents we draft"
          heading={<><Eyebrow>What we draft</Eyebrow><H2>Two practices open today. Every document on paper.</H2></>}
        >
          {DRAFTED_DOCUMENTS.map((d) => (
            <Link key={d.title} href={`/agent/${d.agentId}`} className={styles.docCard} aria-label={`Start: ${d.title}, ${d.price}`}>
              <DocumentPreview reference={d.reference} title={d.title} body={d.body} />
              <div className={styles.docMeta}>
                <span>{d.practice}</span>
                <h3>{d.title}</h3>
                <em>{d.price}</em>
              </div>
            </Link>
          ))}
        </Carousel>
      </Section>

      {/* ══ WHAT IT WILL NOT DO ══ */}
      <Section label="What it will not do">
        <div className={styles.sectionIntro}>
          <div>
            <Eyebrow>What it will not do</Eyebrow>
            <H2>The refusals tell you more than the features.</H2>
          </div>
          <Link href="/agents" className="btn btn-outline">Read them all</Link>
        </div>
        <div className={styles.limits}>
          {LIMITS.map((l) => (
            <div key={l.t} className={styles.limit}>
              <span className={styles.limitTag}>{l.practice}</span>
              <h3>{l.t}</h3>
              <p>{l.b}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ══ CLIENT WORDS — only once staff publish them ══ */}
      {quotes.length > 0 && (
        <Section tone="muted" label="Clients">
          <Eyebrow>In their words</Eyebrow>
          <div className={styles.quotes} style={{ marginTop: 24 }}>
            {quotes.map((q) => <QuoteCard key={q.name + q.quote.slice(0, 20)} quote={q.quote} name={q.name} role={q.role} metrics={q.metrics} />)}
          </div>
        </Section>
      )}

      {/* ══ CONFIDENTIALITY ══ */}
      <Section label="Confidentiality">
        <div className={styles.split}>
          <div>
            <Eyebrow>Confidentiality</Eyebrow>
            <H2>What you tell us stays with the firm.</H2>
            <Lede>The same duty of confidence as any law firm, written down in plain words.</Lede>
          </div>
          <div>
            <ul className={styles.rows}>
              {SAFEGUARDS.map((s, i) => (
                <li key={s.t}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <span><strong>{s.t}</strong><p>{s.b}</p></span>
                </li>
              ))}
            </ul>
            <Link href="/privacy" className={styles.rowsLink}>Read the privacy policy</Link>
          </div>
        </div>
      </Section>

      {/* ══ FOR BUSINESSES ══ */}
      <Section tone="muted" label="For businesses">
        <div className={styles.split}>
          <div>
            <Eyebrow>For lenders and businesses</Eyebrow>
            <H2>Send borrowers in bulk. We do the rest.</H2>
            <Lede>By a shared Google Sheet or by API. Each borrower gets a lawyer-approved letter, served by email, with Day 7 and Day 14 reminders, billed monthly.</Lede>
            <ul className={styles.bizList}>
              <li>One case per loan, never twice</li>
              <li>Webhooks at each step, signed</li>
              <li>A test mode before any real borrower</li>
            </ul>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/businesses" className="btn btn-primary">For businesses</Link>
              <Link href="/developers/api" className="btn btn-outline">Read the API docs</Link>
            </div>
          </div>
          <div className={styles.code} aria-label="Example API request">
            <div className={styles.codeBar}><span>POST /api/v1/borrowers</span><span>plp_test_…</span></div>
            <pre>{`{
  `}<span className={styles.k}>"loan_id"</span>{`: `}<span className={styles.s}>"LN-2026-0042"</span>{`,
  `}<span className={styles.k}>"borrower_full_name"</span>{`: `}<span className={styles.s}>"Adebayo Ogunleye"</span>{`,
  `}<span className={styles.k}>"phone_number"</span>{`: `}<span className={styles.s}>"08031234567"</span>{`,
  `}<span className={styles.k}>"amount_outstanding"</span>{`: 380000,
  `}<span className={styles.k}>"loan_date"</span>{`: `}<span className={styles.s}>"2026-03-15"</span>{`
}

→ 201  { "case_id": "ACME-0004", "status": "new" }`}</pre>
          </div>
        </div>
      </Section>

      {/* ══ FEES ══ */}
      <Section id="fees" label="Fees">
        <span id="pricing" />
        <Eyebrow>Fees</Eyebrow>
        <H2>No retainer. No hourly rate.</H2>
        <div className={styles.feeLead} style={{ marginTop: 40 }}>
          <div>
            <span className={styles.feeFigure}>{FEE_LEAD.value}</span>
            <span className={styles.feeFigureLabel}>{FEE_LEAD.label}</span>
          </div>
          <p className={styles.feeNote}>{FEE_LEAD.note}</p>
        </div>
        <table className={styles.feeTable}>
          <tbody>
            {FEES.map((f) => (
              <tr key={f.label}>
                <th scope="row">{f.label}</th>
                <td className={f.accent ? styles.feeAccent : f.muted ? styles.feeMuted : ''}>{f.value}</td>
                <td className={styles.feeBest}>{f.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ══ NOTES ══ */}
      {notes.length > 0 && (
        <Section tone="muted" label="Notes">
          <div className={styles.sectionIntro}>
            <div>
              <Eyebrow>Notes</Eyebrow>
              <H2>Plain guides to the law we practise.</H2>
            </div>
            <Link href="/blog" className="btn btn-outline">View all</Link>
          </div>
          <div className={styles.notes}>
            {notes.map((n) => (
              <Link key={n.slug} href={`/blog/${n.slug}`} className={styles.note}>
                <time dateTime={n.date}>{formatDate(n.date)}</time>
                <h3>{n.title}</h3>
                <p>{n.description}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ══ QUESTIONS ══ plain <details>, so the answers are in the server HTML */}
      <Section id="faq" label="Questions">
        <Eyebrow>Questions</Eyebrow>
        <H2>Questions people ask first.</H2>
        <div className={styles.faq} style={{ marginTop: 32 }}>
          {FAQS.map((f) => (
            <details key={f.q} className={styles.faqItem}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      </Section>

      {/* ══ WHAT HAPPENS NEXT ══ */}
      <Section tone="band" label="Start a matter">
        <div className={styles.close}>
          <div>
            <h2 className={styles.closeTitle}>Start with the problem, not the paperwork.</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" className={`btn btn-lg ${styles.bandButton}`} onClick={() => onOpenAgent(DEBT_AGENT)}>Someone owes me money</button>
              <button type="button" className={`btn btn-lg ${styles.bandOutline}`} onClick={() => onOpenAgent(PROPERTY_AGENT)}>I have a property matter</button>
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ color: 'rgba(237, 230, 217, 0.62)' }}>What happens next</div>
            <ol className={styles.next}>
              <li><span><strong>You answer plain questions</strong> in your own words. About ten minutes.</span></li>
              <li><span><strong>You read the whole draft</strong> before anything is paid.</span></li>
              <li><span><strong>You pay the fixed fee</strong> shown on the draft. No retainer.</span></li>
              <li><span><strong>A licensed practitioner signs it,</strong> and it is served, by you or by us.</span></li>
            </ol>
          </div>
        </div>
      </Section>
    </>
  )
}
