'use client'

import Link from 'next/link'
import RecoveredCounter from './RecoveredCounter'
import { Carousel, DocumentPreview, Eyebrow, H2, Lede, Pipeline, QuoteCard, Section, SignedLetter, SitePhoto, StatRow } from './ui'
import { DRAFTED_DOCUMENTS, FIRM } from '@/lib/sitePractices'
import { safeJsonLd } from '@/lib/jsonLd'
import styles from './home/home.module.css'

/* ─────────────────────────────────────────────────────────────
   Homepage ("Ink & Brass", docs/frontend-revamp-plan.md).

   Plain words first (27 Oct 2026 review: the page read as a tech product). "Case", not
   "matter"; "lawyer", not "practitioner"; "deliver", not "serve". Code and API detail live on
   /businesses and /developers/api, not here.

   Order: hero with a signed letter → credentials (and published numbers) → photo band →
   how it works → what we prepare → what we will not do → client words (only if
   published) → confidentiality → for businesses → fees → notes → questions → what
   happens next.

   Facts come from lib/agentPagesData.js, lib/sitePractices.ts and the privacy policy.
   Numbers and client quotes appear only once staff publish them in Admin → Site content.
   Styles: components/home/home.module.css and components/ui.
   ───────────────────────────────────────────────────────────── */

const PROPERTY_AGENT = 'recovery-of-premises'
const DEBT_AGENT = 'small-claims'

const LETTER_NOTES = ['You read it before you pay', 'Reminders sent on Day 7 and Day 14']

const PIPELINE = [
  { title: 'Tell us what happened', ai: 'Asks simple questions. Answer in your own words, the way you would explain it to a friend.', lawyer: 'Steps in if your case is disputed or unclear.' },
  { title: 'We prepare it', ai: 'Fills in the firm’s own letter, written by our lawyers.', lawyer: 'Wrote the letters and the rules the AI follows.' },
  { title: 'You read it', ai: 'Shows you the full letter before you pay anything.', lawyer: 'Nothing has been sent yet.' },
  { title: 'A lawyer signs', ai: 'Waits for the lawyer.', lawyer: 'Reads, corrects and signs every document.' },
  { title: 'Delivered and followed up', ai: 'Sends reminders on Day 7 and Day 14.', lawyer: 'Delivers it for you if you ask, and goes to court if it comes to that.' },
]

const BIZ_STEPS = [
  { t: 'Share your list', b: 'Overdue borrowers in a shared Google Sheet, or sent from your own system.' },
  { t: 'A lawyer approves each letter', b: 'One letter per loan, never sent twice.' },
  { t: 'We email the borrower', b: 'You are copied in, with reminders on Day 7 and Day 14.' },
  { t: 'One invoice a month', b: 'Only for the letters a lawyer approved.' },
]

/* Two from each practice page, word for word (lib/agentPagesData.js). */
const LIMITS = [
  { practice: 'Debt recovery', t: 'It will not tell you your odds', b: 'No prediction of winning, no guaranteed timeline. It will tell you where your evidence is thin, which is the useful version.' },
  { practice: 'Debt recovery', t: 'It will not invent authority', b: 'No case references, statute sections or monetary limits it is not certain of. It asks you to confirm instead.' },
  { practice: 'Property law', t: 'It will not advise self-help eviction', b: 'Changing locks or removing a tenant without a court order is never on the table. Notice, then court, every time.' },
  { practice: 'Property law', t: 'It hands disputed cases to a lawyer', b: 'Ongoing court cases, disputed ownership, squatters, or skipping Governor’s Consent go to a lawyer before anything is written.' },
]

/* From the privacy policy (app/privacy/page.tsx), not a new promise. */
const SAFEGUARDS = [
  { t: 'Only the people working on your case see it', b: 'Access to case data is restricted to you and to the Pandas LP staff who need it to work on your case.' },
  { t: 'Not sold. Not used to train AI', b: 'We do not sell your data, and it is not used to train any AI model beyond the single request needed to draft your document.' },
  { t: 'We never see your card', b: 'Payments are processed by Paystack. We receive confirmation and the amount, never your card or bank details.' },
  { t: 'Your rights under the NDPA 2023', b: 'You can ask to see, correct or delete the personal data we hold about you.' },
]

const FEE_LEAD = {
  value: '₦10,000',
  label: 'Letter of demand, delivered by you',
  note: 'Prepared from the firm’s own letter, then checked and signed by a lawyer before it goes anywhere. You see the letter before you pay.',
}

const FEES = [
  { label: 'The same letter, delivered by us', value: '₦25,000', best: 'If you would rather we deliver it for you.' },
  { label: 'Reminders on Day 7 and Day 14', value: 'Included', accent: true, best: 'Sent for you once the letter is delivered.' },
  { label: 'Each tenancy or lease document', value: '₦25,000', best: 'Notices to quit, tenancy and lease agreements.' },
  { label: 'Deeds transferring land or property', value: '2.5% of the price', best: 'Invoiced by the firm. No drafting fee on top.' },
  { label: 'Court filing fees', value: 'Set by the court', muted: true, best: 'Only if a case goes that far.' },
]

/* Every answer restates a fact already on this page. No outcome or speed promises. */
const FAQS = [
  { q: 'What does Pandas LP do?', a: 'Pandas LP is a licensed Nigerian law firm (CAC BN 9646741) handling debt recovery and property law: letters of demand, follow-ups, filing at the Small Claims Court, notices to quit, tenancy and lease documents, deeds of assignment and property searches.' },
  { q: 'How much does a letter of demand cost?', a: 'A letter of demand is ₦10,000 if you deliver it yourself, or ₦25,000 if we deliver it for you. Reminders on Day 7 and Day 14 are included. Court filing fees, if the case goes further, are set by the court.' },
  { q: 'Who prepares and signs the documents?', a: 'Each document is prepared from the firm’s own template, then checked and signed by a licensed lawyer before it goes anywhere. You read it before you pay.' },
  { q: 'What happens if the debtor still does not pay?', a: 'After the letter is delivered, a reminder goes out on Day 7 and the time to respond ends on Day 14. If the debt is still unpaid, we can take the case to the Small Claims Court.' },
  { q: 'How much do property documents cost?', a: 'Each tenancy or lease document is ₦25,000. Deeds transferring land or property are invoiced by the firm at 2.5% of the price paid.' },
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
                Owed money, or dealing with a tenant or landlord? Answer a few simple questions. We prepare the letter,
                a lawyer checks and signs it, and we follow up for you. Letters of demand from ₦10,000.
              </p>
              <div className={styles.heroActions}>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => onOpenAgent(DEBT_AGENT)}>Recover a debt</button>
                <button type="button" className="btn btn-outline btn-lg" onClick={() => onOpenAgent(PROPERTY_AGENT)}>Property or tenancy matter</button>
              </div>
              <div className={styles.heroLinks}>
                <span>Not sure it is worth chasing? <Link href="/debt-check?ref=home-hero">Take the free 1-minute debt check</Link></span>
                <button type="button" onClick={onStartLawyerConsult}>Talk to a lawyer first</button>
              </div>
            </div>
            <SignedLetter reference="PLP · Debt recovery" recipient="Mr. A. Okafor, Ikeja, Lagos" amount="₦2,400,000" notes={LETTER_NOTES} />
          </div>
        </div>
      </section>

      {/* ══ CREDENTIALS, and numbers once published ══ */}
      <div className="container" style={{ maxWidth: 'var(--max-width)', padding: '0 var(--gutter) 64px' }}>
        <ul className={styles.proof} aria-label="About the firm">
          <li>Registered business, {FIRM.registration}</li>
          <li>Every letter signed by a lawyer</li>
          <li>See the letter before you pay</li>
          <li>Fixed fees, no hourly rate</li>
        </ul>
        {stats.items.length > 0 && (
          <div className={styles.proofStats}>
            <StatRow items={stats.items} asOf={stats.asOf} />
          </div>
        )}
      </div>

      {/* ══ PHOTO BAND ══ the photo only once a real one is uploaded; an empty placeholder looked unfinished */}
      <Section tone="band" label="Our work" flush={Boolean(content?.photos?.hero?.url)}>
        {content?.photos?.hero?.url && <SitePhoto photo={content.photos.hero} label="The firm at work" ratio="21 / 9" />}
        <p className={styles.bandLine}>
          Our AI prepares the paperwork. <span>A lawyer checks and signs it.</span> Nothing reaches the other side before that.
        </p>
      </Section>

      {/* ══ RECOVERED ══ renders nothing until there is a real confirmed total */}
      <RecoveredCounter />

      {/* ══ HOW A MATTER MOVES ══ */}
      <Section id="how-it-works" label="How it works">
        <Eyebrow>How it works</Eyebrow>
        <H2>Five steps. A lawyer signs before anything is sent.</H2>
        <div style={{ marginTop: 48 }}>
          <Pipeline steps={PIPELINE} />
        </div>
      </Section>

      {/* ══ WHAT WE DRAFT ══ */}
      <Section tone="muted" id="services" label="What we draft">
        <Carousel
          label="Documents we draft"
          heading={<><Eyebrow>What we prepare</Eyebrow><H2>Documents we can prepare for you today.</H2></>}
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
      <Section label="What we will not do">
        <div className={styles.sectionIntro}>
          <div>
            <Eyebrow>What we will not do</Eyebrow>
            <H2>Some things are always left to a lawyer.</H2>
          </div>
          <Link href="/agents" className="btn btn-outline">See the full list</Link>
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
            <Lede>The same duty of confidence as any law firm, in plain words.</Lede>
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
            <H2>Many overdue borrowers? Send them all at once.</H2>
            <Lede>Share your list and we handle the rest: a lawyer-approved letter for each borrower, delivered by email, with reminders, and one invoice a month.</Lede>
            <div className={styles.bizActions}>
              <Link href="/businesses" className="btn btn-primary">See how it works for businesses</Link>
              <Link href="/developers/api" className={styles.rowsLink}>Developers: API docs</Link>
            </div>
          </div>
          <ol className={styles.bizSteps}>
            {BIZ_STEPS.map((step) => (
              <li key={step.t}><span><strong>{step.t}</strong><p>{step.b}</p></span></li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ══ FEES ══ */}
      <Section id="fees" label="Fees">
        <span id="pricing" />
        <Eyebrow>Fees</Eyebrow>
        <H2>Fixed fees. No hourly rate.</H2>
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
      <Section tone="band" label="Start a case">
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
              <li><span><strong>A lawyer signs it,</strong> and it is delivered, by you or by us.</span></li>
            </ol>
          </div>
        </div>
      </Section>
    </>
  )
}
