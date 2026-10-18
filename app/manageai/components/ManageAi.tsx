'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, authedFetch } from '@/lib/supabaseClient'
import TargetPanel from './TargetPanel'
import type { TargetSummary } from './types'
import styles from './ManageAi.module.css'

const GROUPS: { key: TargetSummary['group']; title: string }[] = [
  { key: 'focus', title: 'Main agents' },
  { key: 'property-area', title: 'Property Law Agent: areas' },
  { key: 'other', title: 'Other agents' },
]

// The /manageai frame: sign-in check, the list of agents on the left, the chosen one on the right.
export default function ManageAi() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = searchParams.get('target')

  const [email, setEmail] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'denied' | 'error' | 'ready'>('loading')
  const [targets, setTargets] = useState<TargetSummary[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/')
      else setEmail(session.user.email ?? null)
    })
  }, [router])

  const load = useCallback(async () => {
    const res = await authedFetch('/api/manageai/instructions')
    if (res.status === 403 || res.status === 401) return setState('denied')
    if (!res.ok) return setState('error')
    const data = await res.json()
    setTargets(data.targets ?? [])
    setState('ready')
  }, [])

  useEffect(() => {
    if (email !== null) load()
  }, [email, load])

  function choose(target: string) {
    router.push(`/manageai?target=${encodeURIComponent(target)}`)
  }

  if (state === 'denied') {
    return (
      <main className={styles.message}>
        <h1>No access</h1>
        <p>This page is only for the people who manage the agents. If you should have access, ask for your email ({email ?? 'not signed in'}) to be added.</p>
        <Link href="/" className="btn btn-outline">Back to the site</Link>
      </main>
    )
  }
  if (state === 'error') {
    return (
      <main className={styles.message}>
        <h1>Something went wrong</h1>
        <p>The agents could not be loaded. Check the database is running and try again.</p>
        <button type="button" className="btn btn-outline" onClick={() => { setState('loading'); load() }}>Try again</button>
      </main>
    )
  }

  const current = targets.find((t) => t.target === selected) ?? null

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${current ? styles.sidebarHiddenMobile : ''}`}>
        <div className={styles.brand}>
          <Link href="/">Pandas LP</Link>
          <span>Manage the agents</span>
        </div>
        {state === 'loading' ? (
          <p className={styles.muted}>Loading…</p>
        ) : (
          GROUPS.map((g) => {
            const items = targets.filter((t) => t.group === g.key)
            if (items.length === 0) return null
            return (
              <nav key={g.key} className={styles.group} aria-label={g.title}>
                <h2>{g.title}</h2>
                {items.map((t) => (
                  <button
                    key={t.target}
                    type="button"
                    className={`${styles.item} ${t.target === selected ? styles.itemActive : ''}`}
                    aria-current={t.target === selected ? 'page' : undefined}
                    onClick={() => choose(t.target)}
                  >
                    <span className={styles.itemName}>{t.name}</span>
                    <span className={styles.itemMeta}>
                      {t.live?.hasText ? `v${t.live.version} live` : 'No instructions yet'}
                      {t.hasDraft && <span className="badge badge-warning badge-sm">Draft</span>}
                      {t.signOff && <span className="badge badge-green badge-sm">Signed off</span>}
                    </span>
                  </button>
                ))}
              </nav>
            )
          })
        )}
        <p className={styles.signedIn}>Signed in as {email}</p>
      </aside>

      <main className={styles.content}>
        {current ? (
          <>
            <button type="button" className={`btn btn-ghost btn-sm ${styles.backMobile}`} onClick={() => router.push('/manageai')}>← All agents</button>
            <TargetPanel key={current.target} target={current.target} onChanged={load} />
          </>
        ) : (
          <div className={styles.intro}>
            <h1>How the agents draft documents</h1>
            <p>Choose an agent on the left. For each one you can:</p>
            <ul>
              <li><strong>Write drafting instructions</strong> in plain English. They are added to what the agent is already told, and they take priority on how documents are worded and laid out.</li>
              <li><strong>Test</strong> your draft in a practice chat before any client sees it.</li>
              <li><strong>Publish</strong>. Every published version is kept for good, and any earlier one can be restored.</li>
              <li><strong>Read real conversations</strong> to see how the agent drafted for actual clients.</li>
              <li><strong>Sign off</strong> an agent once you are satisfied with it.</li>
            </ul>
            <p className={styles.muted}>Prices, fee rules and the calculators (notice periods, rent limits and so on) are set in the code and can&apos;t be changed here. If one is wrong, tell the developer.</p>
          </div>
        )}
      </main>
    </div>
  )
}
