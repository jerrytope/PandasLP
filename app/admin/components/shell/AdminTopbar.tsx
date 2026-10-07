'use client'

import { Menu } from 'lucide-react'
import styles from './AdminShell.module.css'

interface AdminTopbarProps {
  title: string
  meta: string | null
  menuOpen: boolean
  onOpenMenu: () => void
}

export default function AdminTopbar({ title, meta, menuOpen, onOpenMenu }: AdminTopbarProps) {
  return (
    <header className={styles.topbar}>
      <button
        type="button"
        className={styles.menuButton}
        onClick={onOpenMenu}
        aria-label="Open menu"
        aria-controls="admin-sidebar"
        aria-expanded={menuOpen}
      >
        <Menu size={20} strokeWidth={2} aria-hidden="true" />
      </button>
      <h1 className={styles.topbarTitle}>{title}</h1>
      {meta && <span className={styles.topbarMeta}>{meta}</span>}
    </header>
  )
}
