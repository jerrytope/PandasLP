import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPage from '@/components/site/PublicPage'
import { Container, Eyebrow, H2, Section, SitePhoto } from '@/components/ui'
import { FIRM, LIVE_PRACTICES, OPENING_LATER } from '@/lib/sitePractices'
import styles from '@/components/site/pages.module.css'

// About the firm. Only facts already published elsewhere (CLAUDE.md, the footer, the practice
// pages). The founder's note and the photos come from Admin → Site content; the note shows only
// once staff have written it and switched it on.

export const metadata: Metadata = {
  title: 'About',
  description: 'Pandas LP is a Nigerian law firm for debt recovery and property law, registered as a business name with the CAC (BN 9646741).',
  alternates: { canonical: '/about' },
}

export const revalidate = 60

export default function AboutPage() {
  return (
    <PublicPage>
      {(content) => (
        <>
          <section className={styles.hero} aria-label="About Pandas LP">
            <Container>
              <Eyebrow>About</Eyebrow>
              <h1 className={styles.h1}>A law firm that works like software, and signs like a lawyer.</h1>
              <p className={styles.lede}>
                Pandas LP is a Nigerian law firm for debt recovery and property law. Our agents run the interview and draft
                from the firm’s own templates; a licensed practitioner reviews and signs every document, and the firm serves,
                files and appears in court when a matter needs it.
              </p>
            </Container>
          </section>

          <Section tone="band" label="The firm" flush>
            <div className={styles.photos}>
              <SitePhoto photo={content.photos.team} label="The team" ratio="4 / 3" />
              {/* 20 / 21 makes it exactly as tall as the team photo beside it (columns 1.4fr : 1fr). */}
              <SitePhoto photo={content.photos.office} label="The office" ratio="20 / 21" />
            </div>
          </Section>

          {content.founder && (
            <Section label="From the founder">
              <div className={styles.founder}>
                <SitePhoto photo={content.photos.founder} label="Founder" ratio="4 / 5" />
                <div>
                  <Eyebrow>From the founder</Eyebrow>
                  <p className={styles.founderNote}>{content.founder.note}</p>
                  <p className={styles.founderBy}><strong>{content.founder.name}</strong>{content.founder.title ? ` · ${content.founder.title}` : ''}</p>
                </div>
              </div>
            </Section>
          )}

          <Section tone="muted" label="What we take">
            <Eyebrow>What we take</Eyebrow>
            <H2>Two practices open. Four written and waiting.</H2>
            <ul className={styles.steps} style={{ marginTop: 40 }}>
              {LIVE_PRACTICES.map((p) => (
                <li key={p.slug}>
                  <h3><Link href={p.href} className={styles.textLink} style={{ fontSize: 'inherit', textDecoration: 'none' }}>{p.name}</Link></h3>
                  <p>{p.line}</p>
                </li>
              ))}
              {OPENING_LATER.map((p) => (
                <li key={p.name} style={{ opacity: 0.7 }}>
                  <h3>{p.name}</h3>
                  <p>{p.line} Opening as practitioner capacity allows.</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section label="The firm">
            <Eyebrow>The firm</Eyebrow>
            <H2>Stated exactly.</H2>
            <div className={styles.facts} style={{ marginTop: 40 }}>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Registration</span>
                <span className={styles.factValue}>{FIRM.registration}</span>
                <span className={styles.factNote}>A business name registered with the Corporate Affairs Commission.</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Bar</span>
                <span className={styles.factValue}>NBA notified</span>
                <span className={styles.factNote}>The Nigerian Bar Association has been notified of the firm.</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Office</span>
                <span className={styles.factValue}>Victoria Island, Lagos</span>
                <span className={styles.factNote}>{FIRM.address.join(', ')}</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Contact</span>
                <span className={styles.factValue}>{FIRM.phone}</span>
                <span className={styles.factNote}><a href={`mailto:${FIRM.email}`} className={styles.textLink}>{FIRM.email}</a></span>
              </div>
            </div>
            <p style={{ marginTop: 32 }}><Link href="/how-we-work" className={styles.textLink}>How we work, step by step</Link></p>
          </Section>
        </>
      )}
    </PublicPage>
  )
}
