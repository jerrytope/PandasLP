// Server-only. Connects the firm's own Google account once (OAuth), then hands out short-lived
// access tokens for the Drive/Sheets calls in lib/google/googleWorkspace.ts.
//
// Why OAuth and not a service account: Google no longer gives service accounts their own Drive
// storage, so a service account cannot own files in an ordinary Google Drive. Every brand sheet
// and folder is therefore created AS the connected account and owned by it.

import { supabaseAdmin } from '../supabaseAdmin'
import { decryptSecret, encryptSecret } from './tokenCrypto'

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
]

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

/** The env vars the real Google connection needs, and which of them are missing. */
export function googleConfigStatus(): { configured: boolean; missing: string[] } {
  const required = [
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_BRANDS_ROOT_FOLDER_ID',
    'GOOGLE_SHEET_TEMPLATE_ID',
    'GOOGLE_TOKEN_ENCRYPTION_KEY',
  ]
  const missing = required.filter((k) => !process.env[k])
  return { configured: missing.length === 0, missing }
}

export function googleRedirectUri(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return `${site.replace(/\/$/, '')}/api/admin/google/callback`
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    // offline + consent: Google only returns a refresh token on a fresh consent, and the sync
    // job needs one because nobody is signed in when it runs.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export class GoogleAuthError extends Error {
  /** True when the stored connection is no longer usable and someone must reconnect. */
  readonly needsReconnect: boolean
  constructor(message: string, needsReconnect = false) {
    super(message)
    this.name = 'GoogleAuthError'
    this.needsReconnect = needsReconnect
  }
}

/** Swaps the one-time code from Google's redirect for tokens, and works out whose account it is. */
export async function exchangeCodeForConnection(code: string): Promise<{ email: string; refreshToken: string; scopes: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.access_token) {
    throw new GoogleAuthError(`Google refused the sign-in: ${data?.error_description ?? data?.error ?? res.status}`)
  }
  if (!data.refresh_token) {
    throw new GoogleAuthError('Google did not return a refresh token. Remove "Pandas LP" from your Google account’s third-party access, then connect again.')
  }
  const granted: string = data.scope ?? ''
  const missingScopes = GOOGLE_SCOPES.filter((s) => s.startsWith('https://') && !granted.includes(s))
  if (missingScopes.length > 0) {
    throw new GoogleAuthError('Drive and Sheets access were not both granted. Connect again and tick every permission.')
  }

  const who = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${data.access_token}` } })
  const info = await who.json().catch(() => null)
  if (!who.ok || !info?.email) throw new GoogleAuthError('Could not read the connected Google account’s email.')

  return { email: info.email, refreshToken: data.refresh_token, scopes: granted }
}

export async function saveGoogleConnection(conn: { email: string; refreshToken: string; scopes: string }, connectedBy: string) {
  const { error } = await supabaseAdmin.from('google_connection').upsert({
    id: 1,
    account_email: conn.email,
    refresh_token_encrypted: encryptSecret(conn.refreshToken),
    scopes: conn.scopes,
    connected_by: connectedBy,
    connected_at: new Date().toISOString(),
    last_error: null,
    last_error_at: null,
  })
  if (error) throw new Error(`Could not save the Google connection: ${error.message}`)
  cachedToken = null
}

export interface GoogleConnectionStatus {
  connected: boolean
  accountEmail: string | null
  connectedAt: string | null
  lastError: string | null
}

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const { data } = await supabaseAdmin
    .from('google_connection')
    .select('account_email, connected_at, last_error')
    .eq('id', 1)
    .maybeSingle()
  return {
    connected: Boolean(data),
    accountEmail: data?.account_email ?? null,
    connectedAt: data?.connected_at ?? null,
    lastError: data?.last_error ?? null,
  }
}

// Access tokens last an hour; reuse one across calls in the same server instance.
let cachedToken: { token: string; expiresAt: number; accountEmail: string } | null = null

/** A valid access token for the connected account (refreshing it if needed), plus whose it is. */
export async function getGoogleAccessToken(): Promise<{ token: string; accountEmail: string }> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return { token: cachedToken.token, accountEmail: cachedToken.accountEmail }
  }

  const { data: conn } = await supabaseAdmin
    .from('google_connection')
    .select('account_email, refresh_token_encrypted')
    .eq('id', 1)
    .maybeSingle()
  if (!conn) throw new GoogleAuthError('Google Drive is not connected. Go to Admin → Brands → Connect Google Drive.', true)

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      refresh_token: decryptSecret(conn.refresh_token_encrypted),
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.access_token) {
    // invalid_grant = revoked, password changed, or the OAuth app was left in "Testing" (7-day tokens).
    const needsReconnect = data?.error === 'invalid_grant'
    const message = needsReconnect
      ? 'Google access has expired or was revoked. Reconnect Google Drive in Admin → Brands.'
      : `Could not refresh Google access: ${data?.error_description ?? data?.error ?? res.status}`
    await supabaseAdmin.from('google_connection').update({ last_error: message, last_error_at: new Date().toISOString() }).eq('id', 1)
    throw new GoogleAuthError(message, needsReconnect)
  }

  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000, accountEmail: conn.account_email }
  return { token: cachedToken.token, accountEmail: conn.account_email }
}
