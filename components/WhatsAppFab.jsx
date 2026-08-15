'use client'

import { trackEvent } from '@/lib/analytics'

const WHATSAPP_NUMBER = '2348118080189'
const PREFILLED_MESSAGE = 'Hello Pandas LP, I want to ask about recovering a debt.'

// Marketing pages only (homepage, blog) — never rendered on /agent/* routes, where it would
// compete with the live interview. See app/page.jsx, app/blog/page.tsx, app/blog/[slug]/page.tsx.
export default function WhatsAppFab() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILLED_MESSAGE)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-fab"
      aria-label="Chat with Pandas LP on WhatsApp"
      onClick={() => trackEvent('whatsapp_click', { source: typeof window !== 'undefined' ? window.location.pathname : undefined })}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4c-4.37 0-7.93 3.55-7.93 7.92 0 1.4.36 2.76 1.06 3.96L4 20l4.24-1.11a7.9 7.9 0 0 0 3.8.97h.01c4.37 0 7.93-3.55 7.93-7.92a7.87 7.87 0 0 0-2.38-5.62Zm-5.55 12.2h-.01a6.58 6.58 0 0 1-3.35-.92l-.24-.14-2.5.66.67-2.44-.16-.25a6.57 6.57 0 0 1-1.01-3.51c0-3.64 2.96-6.6 6.6-6.6a6.56 6.56 0 0 1 4.67 1.94 6.56 6.56 0 0 1 1.93 4.67c0 3.64-2.96 6.6-6.6 6.6Zm3.62-4.94c-.2-.1-1.17-.58-1.35-.64-.18-.07-.31-.1-.45.1-.13.2-.51.64-.62.77-.12.13-.23.15-.42.05-.2-.1-.83-.31-1.58-.98a5.9 5.9 0 0 1-1.1-1.36c-.11-.2-.01-.3.09-.4.09-.1.2-.24.3-.36.1-.12.13-.2.2-.34.06-.13.03-.25-.02-.35-.05-.1-.45-1.08-.61-1.48-.16-.39-.33-.33-.45-.34l-.38-.01c-.13 0-.35.05-.53.25-.18.2-.7.68-.7 1.66s.72 1.93.82 2.06c.1.13 1.42 2.17 3.44 3.04.48.21.86.33 1.15.42.48.15.92.13 1.27.08.39-.06 1.17-.48 1.34-.94.16-.46.16-.86.11-.94-.05-.09-.18-.14-.38-.24Z"
          fill="currentColor"
        />
      </svg>
    </a>
  )
}
