'use client'

import { createContext, useContext } from 'react'

// Shared by every page under app/admin/ (see app/admin/layout.tsx). The layout does the
// one signed-in check for the whole admin and hands the result down here, so pages no
// longer each repeat their own supabase.auth.getSession() redirect.
export interface AdminShellContextValue {
  userId: string
  userEmail: string | null
  /** Short note shown in the top bar next to the section title, e.g. "12 cases loaded". */
  setTopbarMeta: (meta: string | null) => void
  /**
   * Call when an /api/admin/* route answers 403. Whether someone is staff is only ever
   * decided by the server (lib/adminAuth.ts); the shell then hides the menu and shows the
   * "Access Restricted" screen instead of the panel.
   */
  denyAccess: () => void
}

export const AdminShellContext = createContext<AdminShellContextValue | null>(null)

export function useAdminShell(): AdminShellContextValue {
  const ctx = useContext(AdminShellContext)
  if (!ctx) throw new Error('useAdminShell must be used inside app/admin/layout.tsx')
  return ctx
}
