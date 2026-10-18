'use client'

import { Suspense } from 'react'
import ManageAi from './components/ManageAi'

// /manageai: where the lead lawyer (and the owner) decide how each agent drafts its documents.
// Who may use it is decided by the server on every /api/manageai/* call (AI_MANAGER_EMAILS,
// lib/adminAuth.ts). Suspense because the page reads ?target= with useSearchParams().
export default function ManageAiPage() {
  return (
    <Suspense fallback={null}>
      <ManageAi />
    </Suspense>
  )
}
