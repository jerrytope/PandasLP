// "Ink & Brass" building blocks for the public site (docs/frontend-revamp-plan.md). Server-safe
// except Carousel and RunLog, which are client components in their own files. See /styleguide.

import type { ReactNode } from 'react'
import PhotoPlaceholder from './PhotoPlaceholder'
import type { Photo } from '@/lib/siteContentSchema'
import styles from './ui.module.css'

export { default as Carousel } from './Carousel'
export { default as RunLog, type RunLogStep } from './RunLog'
export { PhotoPlaceholder }

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.container} ${className}`.trim()}>{children}</div>
}

/** A page section. tone: canvas (default), muted (a step lighter), band (always dark). */
export function Section({ children, tone = 'canvas', id, label, flush = false }: { children: ReactNode; tone?: 'canvas' | 'muted' | 'band'; id?: string; label?: string; flush?: boolean }) {
  const toneClass = tone === 'muted' ? styles.sectionMuted : tone === 'band' ? styles.sectionBand : ''
  return (
    <section id={id} aria-label={label} className={`${styles.section} ${toneClass} ${flush ? styles.sectionFlush : ''}`.trim()}>
      <div className={styles.container}>{children}</div>
    </section>
  )
}

/** The small mono label above every H2. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className={styles.h2}>{children}</h2>
}

export function Lede({ children }: { children: ReactNode }) {
  return <p className={styles.lede}>{children}</p>
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className={styles.tag}>{children}</span>
}

/**
 * A photo from Admin → Site content, or the designed placeholder until one is uploaded.
 * ratio is CSS aspect-ratio, e.g. "16 / 9".
 */
export function SitePhoto({ photo, label, ratio = '16 / 9', className = '' }: { photo: Photo | null | undefined; label: string; ratio?: string; className?: string }) {
  return (
    <div className={`${styles.photo} ${className}`.trim()} style={{ aspectRatio: ratio }}>
      {photo?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL; a plain img keeps local and live working without image-host config
        <img src={photo.url} alt={photo.alt || label} loading="lazy" decoding="async" />
      ) : (
        <PhotoPlaceholder label={label} />
      )}
    </div>
  )
}

/** A legal document on paper (white in both themes). body: paragraphs. */
export function DocumentPreview({ reference, title, body, fade = true, date }: { reference: string; title: string; body: string[]; fade?: boolean; date?: string }) {
  return (
    <div className={`${styles.doc} ${fade ? styles.docFade : ''}`.trim()} aria-label={`Preview of a ${title}`} role="img">
      <div className={styles.docRef}>
        <span>{reference}</span>
        {date && <span>{date}</span>}
      </div>
      <div className={styles.docTitle}>{title}</div>
      <div className={styles.docBody}>
        {body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  )
}

/** Published numbers (Admin → Site content), each with what it counts, and the "as of". */
export function StatRow({ items, asOf }: { items: { value: string; label: string; definition: string }[]; asOf: string }) {
  if (items.length === 0) return null
  return (
    <div>
      <dl className={styles.stats}>
        {items.map((s) => (
          <div key={s.label} className={styles.stat}>
            <dt className={styles.statLabel}>{s.label}</dt>
            <dd style={{ order: -1 }} className={styles.statValue}>{s.value}</dd>
            <dd className={styles.statDefinition}>{s.definition}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.statsAsOf}>As of {asOf}</p>
    </div>
  )
}

export function QuoteCard({ quote, name, role, metrics = [] }: { quote: string; name: string; role?: string; metrics?: { value: string; label: string }[] }) {
  return (
    <figure className={styles.quote}>
      <blockquote className={styles.quoteText}>“{quote}”</blockquote>
      <figcaption className={styles.quoteBy}>
        <strong>{name}</strong>
        {role ? ` · ${role}` : ''}
      </figcaption>
      {metrics.length > 0 && (
        <div className={styles.quoteMetrics}>
          {metrics.map((m) => (
            <div key={m.label} className={styles.quoteMetric}>
              <strong>{m.value}</strong>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </figure>
  )
}

/** How a case moves: numbered steps, each with what the AI does and what the lawyer checks. */
export function Pipeline({ steps }: { steps: { title: string; ai: string; lawyer: string }[] }) {
  return (
    <ol className={styles.pipeline}>
      {steps.map((s) => (
        <li key={s.title} className={styles.pipelineStep}>
          <h3>{s.title}</h3>
          <p className={styles.pipelineRole}><b>Our AI</b>{s.ai}</p>
          <p className={styles.pipelineRole}><b>Your lawyer</b>{s.lawyer}</p>
        </li>
      ))}
    </ol>
  )
}

/**
 * The homepage's hero picture: a sample letter of demand on the firm's letterhead, signed and
 * stamped, with two notes pinned to it. Shows what the client ends up holding, not how the
 * system works. Always paper, so it reads the same in both themes.
 */
export function SignedLetter({ reference, recipient, amount, notes = [] }: { reference: string; recipient: string; amount: string; notes?: string[] }) {
  return (
    <figure className={styles.letterWrap} aria-label="A sample letter of demand, signed by a lawyer">
      <div className={styles.letter}>
        <header className={styles.letterHead}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a small static logo on paper */}
          <img src="/logo-mark.png" alt="" aria-hidden="true" />
          <div>
            <strong>Pandas LP</strong>
            <span>Legal practitioners · Victoria Island, Lagos</span>
          </div>
        </header>
        <div className={styles.letterRef}><span>{reference}</span><span>Sample</span></div>
        <p className={styles.letterTo}>To: {recipient}</p>
        <div className={styles.letterTitle}>Letter of demand</div>
        <p>Our client instructs us that you owe the sum of <b>{amount}</b>, being the balance due on the invoice attached to this letter.</p>
        <p>Take notice that unless the said sum is paid within fourteen (14) days, we have firm instructions to commence proceedings against you without further notice.</p>
        <div className={styles.letterSign}>
          <svg viewBox="0 0 160 48" aria-hidden="true" className={styles.letterSignature}>
            <path d="M6 34c10-18 18-26 22-22s-8 24-2 24 14-26 20-24-4 20 2 20 10-12 16-14 4 10 10 10 14-14 22-14 6 8 14 6 18-8 30-12" />
          </svg>
          <span>For: Pandas LP, Legal Practitioners</span>
        </div>
        <div className={styles.letterStamp} aria-hidden="true">
          <span>Reviewed</span>
          <strong>Signed</strong>
          <span>Pandas LP</span>
        </div>
      </div>
      {notes.map((n, i) => (
        <figcaption key={n} className={`${styles.letterNote} ${i % 2 ? styles.letterNoteAlt : ''}`.trim()}>
          <span aria-hidden="true">✓</span>{n}
        </figcaption>
      ))}
    </figure>
  )
}

export function AnnouncementBar({ label, text, href }: { label?: string; text: string; href?: string }) {
  return (
    <div className={styles.announce} role="region" aria-label="Announcement">
      <div className={styles.announceInner}>
        {label && <span className={styles.announceTag}>{label}</span>}
        {href ? <a href={href}>{text}</a> : <span>{text}</span>}
      </div>
    </div>
  )
}
