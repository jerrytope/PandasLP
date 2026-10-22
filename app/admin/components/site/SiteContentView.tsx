'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { useAdminShell } from '../shell/AdminShellContext'
import PhotoPlaceholder from '@/components/ui/PhotoPlaceholder'
import {
  LIMITS,
  PHOTO_MAX_BYTES,
  PHOTO_SLOTS,
  PHOTO_SLOT_LABELS,
  type PhotoSlot,
  type SiteContent,
  type SiteContentKey,
} from '@/lib/siteContentSchema'
import styles from './SiteContentView.module.css'

type Changes = Record<string, { by: string | null; at: string }>

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; value?: unknown }> {
  const res = await authedFetch('/api/admin/site-content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, value: data.value } : { ok: false, error: data.error ?? 'Something went wrong.' }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function when(iso?: string) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) : ''
}

// Admin → Site content: the parts of the public website staff edit without a developer.
// Photos show as designed placeholder panels until one is uploaded. Numbers, quotes and the
// founder's note never show on the site until they are filled in AND switched on
// (lib/siteContentSchema.ts explains why).
export default function SiteContentView() {
  const { denyAccess, setTopbarMeta } = useAdminShell()
  const [content, setContent] = useState<SiteContent | null>(null)
  const [changes, setChanges] = useState<Changes>({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await authedFetch('/api/admin/site-content')
    if (res.status === 403) return denyAccess()
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error ?? 'Could not load the site content.')
    setContent(data.content)
    setChanges(data.changes ?? {})
  }, [denyAccess])

  useEffect(() => {
    load()
    setTopbarMeta('What visitors see on the public website')
  }, [load, setTopbarMeta])

  if (error) return <p role="alert" className={styles.error}>{error}</p>
  if (!content) return <p className={styles.muted}>Loading…</p>

  const save = async <K extends SiteContentKey>(key: K, value: SiteContent[K]) => {
    const result = await post({ key, value })
    if (result.ok) await load()
    return result
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>
        Changes show on the website within a minute. Numbers, client quotes and the founder&apos;s note stay hidden until you fill them in and switch them on:
        have the lead lawyer approve the wording first, as the rules on lawyers&apos; advertising apply to all of it.
      </p>

      <Photos content={content} changed={changes.photos} onChanged={load} />
      <Announcement value={content.announcement} changed={changes.announcement} onSave={(v) => save('announcement', v)} />
      <Stats value={content.stats} changed={changes.stats} onSave={(v) => save('stats', v)} />
      <Quotes value={content.quotes} changed={changes.quotes} onSave={(v) => save('quotes', v)} />
      <Founder value={content.founder} changed={changes.founder} onSave={(v) => save('founder', v)} />
    </div>
  )
}

// ----- Shared bits -----

function Panel({ title, hint, changed, children }: { title: string; hint: string; changed?: { by: string | null; at: string }; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <div>
          <h2>{title}</h2>
          <p className={styles.muted}>{hint}</p>
        </div>
        {changed && <span className={styles.changed}>Last changed {when(changed.at)}{changed.by ? ` by ${changed.by}` : ''}</span>}
      </header>
      {children}
    </section>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function useSaver<T>(initial: T, onSave: (v: T) => Promise<{ ok: boolean; error?: string }>) {
  const [value, setValue] = useState<T>(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  useEffect(() => setValue(initial), [initial])
  const dirty = JSON.stringify(value) !== JSON.stringify(initial)
  async function save() {
    setBusy(true)
    setMessage(null)
    const result = await onSave(value)
    setBusy(false)
    setMessage(result.ok ? { kind: 'ok', text: 'Saved.' } : { kind: 'error', text: result.error ?? 'Could not save.' })
  }
  const footer = (
    <div className={styles.footer}>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      {dirty && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setValue(initial)}>Undo changes</button>}
      {message && <span role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? styles.error : styles.ok}>{message.text}</span>}
    </div>
  )
  return { value, setValue, footer }
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className={styles.field}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  )
}

// ----- Photos -----

function Photos({ content, changed, onChanged }: { content: SiteContent; changed?: { by: string | null; at: string }; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<PhotoSlot | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [alts, setAlts] = useState(() => Object.fromEntries(PHOTO_SLOTS.map((s) => [s, content.photos[s].alt])) as Record<PhotoSlot, string>)

  useEffect(() => setAlts(Object.fromEntries(PHOTO_SLOTS.map((s) => [s, content.photos[s].alt])) as Record<PhotoSlot, string>), [content.photos])

  async function upload(slot: PhotoSlot, file: File) {
    setMessage(null)
    if (file.size > PHOTO_MAX_BYTES) return setMessage({ kind: 'error', text: 'That photo is over 3 MB. Export it as a JPG about 2000px wide and try again.' })
    setBusy(slot)
    const result = await post({ action: 'photo', slot, fileBase64: await fileToBase64(file) })
    setBusy(null)
    if (!result.ok) return setMessage({ kind: 'error', text: result.error ?? 'Upload failed.' })
    setMessage({ kind: 'ok', text: `${PHOTO_SLOT_LABELS[slot].title}: photo uploaded.` })
    await onChanged()
  }

  async function savePhotos(next: SiteContent['photos'], text: string) {
    const result = await post({ key: 'photos', value: next })
    setMessage(result.ok ? { kind: 'ok', text } : { kind: 'error', text: result.error ?? 'Could not save.' })
    if (result.ok) await onChanged()
  }

  return (
    <Panel title="Photos" hint="Real photos of the firm. Until one is uploaded, the website shows a designed placeholder panel in its place." changed={changed}>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? styles.error : styles.ok}>{message.text}</p>}
      <div className={styles.photoGrid}>
        {PHOTO_SLOTS.map((slot) => {
          const photo = content.photos[slot]
          return (
            <div key={slot} className={styles.photoCard}>
              <div className={styles.photoFrame}>
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={photo.alt || PHOTO_SLOT_LABELS[slot].title} />
                ) : (
                  <PhotoPlaceholder label={PHOTO_SLOT_LABELS[slot].title} />
                )}
              </div>
              <strong>{PHOTO_SLOT_LABELS[slot].title}</strong>
              <span className={styles.hint}>{PHOTO_SLOT_LABELS[slot].hint}</span>
              <Field label="Describe the photo (for screen readers)">
                <input
                  className="input"
                  value={alts[slot]}
                  maxLength={LIMITS.shortText}
                  onChange={(e) => setAlts({ ...alts, [slot]: e.target.value })}
                  placeholder="e.g. A Pandas LP lawyer reviewing a Notice to Quit"
                />
              </Field>
              <div className={styles.footer}>
                <label className={`btn btn-outline btn-sm ${styles.upload}`}>
                  {busy === slot ? 'Uploading…' : photo.url ? 'Replace photo' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) upload(slot, f)
                    }}
                  />
                </label>
                {alts[slot] !== photo.alt && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => savePhotos({ ...content.photos, [slot]: { ...photo, alt: alts[slot] } }, 'Description saved.')}>Save description</button>
                )}
                {photo.url && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => savePhotos({ ...content.photos, [slot]: { ...photo, url: null } }, 'Photo removed; the placeholder shows again.')}>Remove</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ----- Announcement bar -----

function Announcement({ value: initial, changed, onSave }: { value: SiteContent['announcement']; changed?: { by: string | null; at: string }; onSave: (v: SiteContent['announcement']) => Promise<{ ok: boolean; error?: string }> }) {
  const { value, setValue, footer } = useSaver(initial, onSave)
  return (
    <Panel title="Announcement bar" hint="The thin line above the menu on every public page. Keep it short and dated by what it says." changed={changed}>
      <Toggle checked={value.enabled} onChange={(enabled) => setValue({ ...value, enabled })} label="Show on the website" />
      <div className={styles.row}>
        <Field label="Tag"><input className="input" value={value.label} maxLength={24} onChange={(e) => setValue({ ...value, label: e.target.value })} placeholder="New" /></Field>
        <Field label="Text"><input className="input" value={value.text} maxLength={LIMITS.shortText} onChange={(e) => setValue({ ...value, text: e.target.value })} /></Field>
        <Field label="Link" hint="A page on this site (/property-law) or a full https:// address."><input className="input" value={value.href} onChange={(e) => setValue({ ...value, href: e.target.value })} /></Field>
      </div>
      {footer}
    </Panel>
  )
}

// ----- Numbers -----

function Stats({ value: initial, changed, onSave }: { value: SiteContent['stats']; changed?: { by: string | null; at: string }; onSave: (v: SiteContent['stats']) => Promise<{ ok: boolean; error?: string }> }) {
  const { value, setValue, footer } = useSaver(initial, onSave)
  const setItem = (n: number, patch: Partial<SiteContent['stats']['items'][number]>) =>
    setValue({ ...value, items: value.items.map((it, i) => (i === n ? { ...it, ...patch } : it)) })
  return (
    <Panel title="Numbers" hint="Real, measured figures only, each saying exactly what it counts. Hidden until switched on." changed={changed}>
      <Toggle checked={value.enabled} onChange={(enabled) => setValue({ ...value, enabled })} label="Show on the website" />
      <Field label='True "as of"' hint="e.g. October 2026. Shown next to the numbers."><input className="input" value={value.asOf} maxLength={40} onChange={(e) => setValue({ ...value, asOf: e.target.value })} /></Field>
      {value.items.map((item, n) => (
        <div key={n} className={styles.item}>
          <div className={styles.row}>
            <Field label="Figure"><input className="input" value={item.value} maxLength={24} onChange={(e) => setItem(n, { value: e.target.value })} placeholder="140" /></Field>
            <Field label="Label"><input className="input" value={item.label} maxLength={80} onChange={(e) => setItem(n, { label: e.target.value })} placeholder="Letters of demand served" /></Field>
          </div>
          <Field label="Exactly what it counts"><input className="input" value={item.definition} maxLength={240} onChange={(e) => setItem(n, { definition: e.target.value })} placeholder="Letters marked served in our records since launch" /></Field>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setValue({ ...value, items: value.items.filter((_, i) => i !== n) })}>Remove this number</button>
        </div>
      ))}
      {value.items.length < LIMITS.stats && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setValue({ ...value, items: [...value.items, { value: '', label: '', definition: '' }] })}>Add a number</button>
      )}
      {footer}
    </Panel>
  )
}

// ----- Client quotes -----

function Quotes({ value: initial, changed, onSave }: { value: SiteContent['quotes']; changed?: { by: string | null; at: string }; onSave: (v: SiteContent['quotes']) => Promise<{ ok: boolean; error?: string }> }) {
  const { value, setValue, footer } = useSaver(initial, onSave)
  type Q = SiteContent['quotes']['items'][number]
  const setItem = (n: number, patch: Partial<Q>) => setValue({ ...value, items: value.items.map((q, i) => (i === n ? { ...q, ...patch } : q)) })
  return (
    <Panel title="Client quotes" hint="Only with the client's written permission. Hidden until switched on." changed={changed}>
      <Toggle checked={value.enabled} onChange={(enabled) => setValue({ ...value, enabled })} label="Show on the website" />
      {value.items.map((q, n) => (
        <div key={n} className={styles.item}>
          <Field label="What they said"><textarea className="input" rows={3} value={q.quote} maxLength={LIMITS.longText} onChange={(e) => setItem(n, { quote: e.target.value })} /></Field>
          <div className={styles.row}>
            <Field label="Name"><input className="input" value={q.name} maxLength={80} onChange={(e) => setItem(n, { name: e.target.value })} /></Field>
            <Field label="Role and company"><input className="input" value={q.role} maxLength={120} onChange={(e) => setItem(n, { role: e.target.value })} placeholder="Director, Ade Logistics" /></Field>
          </div>
          {[0, 1].map((m) => {
            const metric = q.metrics[m] ?? { value: '', label: '' }
            const setMetric = (patch: Partial<typeof metric>) => {
              const metrics = [0, 1].map((i) => (i === m ? { ...metric, ...patch } : q.metrics[i] ?? { value: '', label: '' }))
              setItem(n, { metrics })
            }
            return (
              <div key={m} className={styles.row}>
                <Field label={`Result ${m + 1}: figure (optional)`}><input className="input" value={metric.value} maxLength={24} onChange={(e) => setMetric({ value: e.target.value })} placeholder="₦2.4m" /></Field>
                <Field label="What it shows"><input className="input" value={metric.label} maxLength={80} onChange={(e) => setMetric({ label: e.target.value })} placeholder="recovered in 3 weeks" /></Field>
              </div>
            )
          })}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setValue({ ...value, items: value.items.filter((_, i) => i !== n) })}>Remove this quote</button>
        </div>
      ))}
      {value.items.length < LIMITS.quotes && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setValue({ ...value, items: [...value.items, { quote: '', name: '', role: '', metrics: [] }] })}>Add a quote</button>
      )}
      {footer}
    </Panel>
  )
}

// ----- Founder's note -----

function Founder({ value: initial, changed, onSave }: { value: SiteContent['founder']; changed?: { by: string | null; at: string }; onSave: (v: SiteContent['founder']) => Promise<{ ok: boolean; error?: string }> }) {
  const { value, setValue, footer } = useSaver(initial, onSave)
  return (
    <Panel title="Founder's note" hint="A short note in the founder's own words, shown with the founder portrait. Hidden until switched on." changed={changed}>
      <Toggle checked={value.enabled} onChange={(enabled) => setValue({ ...value, enabled })} label="Show on the website" />
      <div className={styles.row}>
        <Field label="Name"><input className="input" value={value.name} maxLength={80} onChange={(e) => setValue({ ...value, name: e.target.value })} /></Field>
        <Field label="Title"><input className="input" value={value.title} maxLength={120} onChange={(e) => setValue({ ...value, title: e.target.value })} placeholder="Founder and Principal" /></Field>
      </div>
      <Field label="The note"><textarea className="input" rows={5} value={value.note} maxLength={LIMITS.noteText} onChange={(e) => setValue({ ...value, note: e.target.value })} /></Field>
      {footer}
    </Panel>
  )
}
