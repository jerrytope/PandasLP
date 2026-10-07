// What the app needs from Google for a brand, as one interface with two implementations:
//   - googleWorkspace.ts: the real thing (Drive + Sheets REST APIs, as the connected account)
//   - fakeWorkspace.ts:   in memory, for tests and for local development without Google
// Callers get one through getBrandWorkspace() and never talk to Google directly.

import { googleConfigStatus } from './oauth'
import { isProduction } from '../appEnv'
import { createGoogleWorkspace } from './googleWorkspace'
import { getFakeWorkspace } from './fakeWorkspace'
import type { BrandWorkspace } from './workspaceTypes'

export type { BrandWorkspace, BrandSetupInput, BrandSetupProgress } from './workspaceTypes'
export { emptySetupProgress } from './workspaceTypes'

export class WorkspaceNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Google Drive isn't set up yet. Missing environment variables: ${missing.join(', ')}.`)
    this.name = 'WorkspaceNotConfiguredError'
  }
}

/**
 * The real Google workspace when it's configured. GOOGLE_FAKE_WORKSPACE=true swaps in the
 * in-memory fake (local development only — it is refused in production).
 */
export function getBrandWorkspace(): BrandWorkspace {
  if (process.env.GOOGLE_FAKE_WORKSPACE === 'true' && !isProduction()) {
    return getFakeWorkspace()
  }
  const status = googleConfigStatus()
  if (!status.configured) throw new WorkspaceNotConfiguredError(status.missing)
  return createGoogleWorkspace()
}
