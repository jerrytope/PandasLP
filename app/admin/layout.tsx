'use client'

import { Suspense, type ReactNode } from 'react'
import AdminShell from './components/shell/AdminShell'

// Wraps every page under /admin (the panel itself and /admin/health) in the same sidebar
// layout. Suspense is required because the shell reads the URL's ?section= with
// useSearchParams().
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  )
}
