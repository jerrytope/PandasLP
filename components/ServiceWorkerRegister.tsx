'use client'

import { useEffect } from 'react'

// Registers public/sw.js — required for Chrome's PWA installability criteria (a fetch-handling
// service worker must be registered). See that file for why it deliberately does almost
// nothing. Renders nothing; this is a side-effect-only component.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
