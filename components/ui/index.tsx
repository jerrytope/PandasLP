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

/** How a matter moves: numbered steps, each with what the AI does and what the lawyer checks. */
export function Pipeline({ steps }: { steps: { title: string; ai: string; lawyer: string }[] }) {
  return (
    <ol className={styles.pipeline}>
      {steps.map((s) => (
        <li key={s.title} className={styles.pipelineStep}>
          <h3>{s.title}</h3>
          <p className={styles.pipelineRole}><b>The agent</b>{s.ai}</p>
          <p className={styles.pipelineRole}><b>The lawyer</b>{s.lawyer}</p>
        </li>
      ))}
    </ol>
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
