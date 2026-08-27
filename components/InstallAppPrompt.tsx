'use client'

import { useEffect, useState } from 'react'
import { trackEvent } from '@/lib/analytics'

// Chrome/Edge/Android fire this; it's not in lib.dom.d.ts.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
  interface Navigator {
    standalone?: boolean
  }
}

const DISMISS_KEY = 'pandas_install_dismissed'

// Marketing pages only (homepage) — mirrors WhatsAppFab's placement. Shows Chrome/Edge/Android's
// real install prompt when available; iOS Safari never fires beforeinstallprompt, so it gets
// manual "Add to Home Screen" instructions instead.
export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === 'true') return

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
    if (isStandalone) return

    function onBeforeInstallPrompt(e: BeforeInstallPromptEvent) {
      e.preventDefault()
      setDeferredPrompt(e)
      setPlatform('android')
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    let iosTimer: number | undefined
    if (/iphone|ipad|ipod/i.test(window.navigator.userAgent)) {
      // Delay so it doesn't compete with first paint / other onboarding UI.
      iosTimer = window.setTimeout(() => {
        setPlatform('ios')
        setVisible(true)
      }, 2500)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      if (iosTimer) window.clearTimeout(iosTimer)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, 'true')
    trackEvent('install_prompt_dismissed', { platform })
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    trackEvent('install_prompt_clicked')
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    trackEvent('install_prompt_outcome', { outcome })
    setDeferredPrompt(null)
    setVisible(false)
    if (outcome !== 'accepted') localStorage.setItem(DISMISS_KEY, 'true')
  }

  if (!visible || !platform) return null

  return (
    <div className="install-prompt" role="dialog" aria-label="Install Pandas LP">
      <button className="install-prompt-close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
      {platform === 'ios' ? (
        <p className="install-prompt-text">
          <strong>Install Pandas LP</strong> — tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        </p>
      ) : (
        <>
          <p className="install-prompt-text">
            <strong>Install Pandas LP</strong> for quick, one-tap access.
          </p>
          <button className="install-prompt-btn" onClick={handleInstall}>
            Install
          </button>
        </>
      )}
    </div>
  )
}
