'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, AlertTriangle, ExternalLink, FolderOpen, Plus, RefreshCw, Link2, Pencil, Trash2 } from 'lucide-react'
import { authedFetch } from '@/lib/supabaseClient'
import { formatKobo } from '@/lib/money'
import { BRAND_CASE_STATUS_LABELS, type BrandCaseStatus } from '@/lib/brandSheet'
import { useAdminShell } from '../shell/AdminShellContext'
import BrandSyncPanel from './BrandSyncPanel'
import BrandBorrowers from './BrandBorrowers'
import BrandBilling from './BrandBilling'

interface BrandRow {
  id: string
  name: string
  code: string
  address: string | null
  contact_emails: string[]
  per_letter_fee_kobo: number
  sheet_url: string | null
  drive_folder_id: string | null
  setup_completed_at: string | null
  last_synced_at: string | null
  last_sync_error: string | null
  active: boolean
  case_counts: Partial<Record<BrandCaseStatus, number>>
  open_flags: number
}

interface GoogleState {
  connected: boolean
  accountEmail: string | null
  lastError: string | null
  configured: boolean
  missing: string[]
  fake: boolean
}

const EMPTY_FORM = { name: '', code: '', address: '', contactEmails: '', perLetterFeeNaira: '' }

// Admin → Brands: connect the firm's Google Drive, create brands (each gets its own sheet and
// folder, shared only with the brand's named emails), and see each brand's pipeline.
export default function BrandsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { denyAccess, setTopbarMeta } = useAdminShell()

  const [brands, setBrands] = useState<BrandRow[]>([])
  const [google, setGoogle] = useState<GoogleState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  // Outcome of the Google sign-in round trip (see app/api/admin/google/callback), shown once.
  useEffect(() => {
    const outcome = searchParams.get('google')
    if (!outcome) return
    if (outcome === 'connected') setNotice('Google Drive connected.')
    else setError(searchParams.get('message') || 'Could not connect Google Drive.')
    router.replace('/admin?section=brands')
  }, [searchParams, router])

  async function load() {
    setLoading(true)
    try {
      const res = await authedFetch('/api/admin/brands')
      if (res.status === 403) return denyAccess()
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Failed to load brands.')
      setBrands(data.brands ?? [])
      setGoogle(data.google ?? null)
      setTopbarMeta(`${(data.brands ?? []).length} brands`)
    } catch {
      setError('Network error while loading brands.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connectGoogle() {
    setConnecting(true)
    setError('')
    try {
      const res = await authedFetch('/api/admin/google/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start Google sign-in.')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  async function createBrand(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await authedFetch('/api/admin/brands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not create the brand.')
        return
      }
      setForm(EMPTY_FORM)
      setShowForm(false)
      if (data.setup?.ok) setNotice(`${form.code.toUpperCase()} created — its sheet and folder are ready and shared.`)
      else setError(`Brand saved, but the Google setup didn't finish: ${data.setup?.error ?? 'unknown error'}. Fix the cause, then press "Retry setup".`)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function retrySetup(brandId: string) {
    setRetryingId(brandId)
    setError('')
    try {
      const res = await authedFetch('/api/admin/brands', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandId, action: 'retrySetup' }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Setup failed again.')
      else setNotice('Setup finished.')
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setRetryingId(null)
    }
  }

  // Edit brand: name, contacts, fee, active. Sharing in Drive is updated to match on the server.
  async function saveBrand(brandId: string, edit: EditForm): Promise<boolean> {
    setError('')
    setNotice('')
    try {
      const res = await authedFetch('/api/admin/brands', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandId, action: 'update', ...edit }),
      })
      const data = await res.json()
      await load()
      if (!res.ok) {
        setError(data.error || 'Could not save the brand.')
        // A 502 means the edit itself was saved and only Google lagged behind, so close the form.
        return res.status === 502
      }
      setNotice('Brand updated.')
      return true
    } catch {
      setError('Network error. Please try again.')
      return false
    }
  }

  async function removeBrand(brandId: string, code: string): Promise<void> {
    setError('')
    setNotice('')
    try {
      const res = await authedFetch(`/api/admin/brands?brandId=${encodeURIComponent(brandId)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Could not delete the brand.')
      else setNotice(`${code} deleted. Its Drive folder is in the bin for 30 days if you need it back.`)
      await load()
    } catch {
      setError('Network error. Please try again.')
    }
  }

  const canCreate = Boolean(google?.fake || (google?.configured && google?.connected))

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {error && (
        <div role="alert" className="card" style={{ borderColor: 'var(--danger)', padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: 'var(--danger)', fontSize: 14, flex: 1 }}>{error}</span>
          <button type="button" className="btn btn-sm" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      {notice && (
        <div role="status" className="card" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <span style={{ fontSize: 14, flex: 1 }}>{notice}</span>
          <button type="button" className="btn btn-sm" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}

      {/* Google Drive connection */}
      {google && <GoogleCard google={google} connecting={connecting} onConnect={connectGoogle} />}

      {/* Sheet sync: schedule, last run and "Sync now" */}
      {canCreate && brands.length > 0 && <BrandSyncPanel onSynced={load} />}

      {/* Brand list */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <span className="label-mono">Lenders</span>
          <p style={{ color: 'var(--text-2)', fontSize: 13, margin: '4px 0 0' }}>
            Each brand gets its own Google Sheet and folder, shared only with the emails you list.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowForm((v) => !v)}
          disabled={!canCreate}
          title={canCreate ? undefined : 'Connect Google Drive first'}
        >
          <Plus size={14} aria-hidden="true" style={{ marginRight: 6 }} />
          New brand
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={createBrand} style={{ display: 'grid', gap: 14, padding: '20px 22px' }}>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="brand-name">Brand name</label>
              <input id="brand-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="LAPO Microfinance Bank" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="brand-code">Code (Case ID prefix)</label>
              <input
                id="brand-code"
                className="input"
                required
                maxLength={8}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}
                placeholder="LAPO"
              />
              <small style={{ color: 'var(--text-3)', fontSize: 12 }}>
                Case IDs will look like {form.code || 'LAPO'}-0001. Can’t be changed later.
              </small>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="brand-fee">Fee per approved letter (₦)</label>
              <input
                id="brand-fee"
                className="input"
                required
                inputMode="decimal"
                value={form.perLetterFeeNaira}
                onChange={(e) => setForm({ ...form, perLetterFeeNaira: e.target.value.replace(/[^0-9.]/g, '') })}
                placeholder="5000"
              />
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="brand-address">Registered address (appears in every demand letter)</label>
            <input
              id="brand-address"
              className="input"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="18 Idowu Taylor Street, Victoria Island, Lagos"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="brand-emails">Contact emails (the only people the sheet is shared with)</label>
            <input
              id="brand-emails"
              className="input"
              required
              value={form.contactEmails}
              onChange={(e) => setForm({ ...form, contactEmails: e.target.value })}
              placeholder="recoveries@lender.com, ops.manager@lender.com"
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Creating sheet and folder…' : 'Create brand'}
            </button>
          </div>
        </form>
      )}

      {loading && brands.length === 0 ? (
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading brands…</p>
      ) : brands.length === 0 ? (
        <div className="card" style={{ padding: '28px 22px', textAlign: 'center', color: 'var(--text-2)', fontSize: 14 }}>
          No brands yet.{canCreate ? ' Create the first one with “New brand”.' : ' Connect Google Drive above to get started.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {brands.map((b) => (
            <BrandCard
              key={b.id}
              brand={b}
              retrying={retryingId === b.id}
              onRetry={() => retrySetup(b.id)}
              onSave={(edit) => saveBrand(b.id, edit)}
              onDelete={() => removeBrand(b.id, b.code)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GoogleCard({ google, connecting, onConnect }: { google: GoogleState; connecting: boolean; onConnect: () => void }) {
  if (google.fake) {
    return (
      <div className="card" style={{ padding: '14px 18px', fontSize: 14, color: 'var(--text-2)' }}>
        <strong style={{ color: 'var(--text-1)' }}>Test mode:</strong> GOOGLE_FAKE_WORKSPACE is on, so brands get pretend sheets and
        folders that exist only in this server’s memory. Turn it off to use your real Google Drive.
      </div>
    )
  }
  if (!google.configured) {
    return (
      <div className="card" style={{ padding: '16px 18px', borderLeft: '3px solid var(--warning)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 14 }}>
          <AlertTriangle size={16} style={{ color: 'var(--warning)' }} aria-hidden="true" />
          Google Drive isn’t set up yet
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '6px 0 0', lineHeight: 1.6 }}>
          Add these to <code>.env.local</code> (and Vercel), then restart: {google.missing.join(', ')}. The setup steps are in CLAUDE.md under “Brand sheets”.
        </p>
      </div>
    )
  }
  return (
    <div
      className="card"
      style={{
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        borderLeft: `3px solid ${google.connected && !google.lastError ? 'var(--accent)' : 'var(--warning)'}`,
      }}
    >
      <Link2 size={18} style={{ color: 'var(--accent)' }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 220, fontSize: 14 }}>
        {google.connected ? (
          <>
            <strong>Google Drive connected</strong> as {google.accountEmail}. Brand sheets and folders are created in this account.
            {google.lastError && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 4 }}>{google.lastError}</div>}
          </>
        ) : (
          <>
            <strong>Connect Google Drive</strong> — sign in once with the account that should own every brand sheet (ideally the firm’s account).
          </>
        )}
      </div>
      <button type="button" className={`btn btn-sm ${google.connected ? '' : 'btn-primary'}`} onClick={onConnect} disabled={connecting}>
        {connecting ? 'Opening Google…' : google.connected ? 'Reconnect' : 'Connect Google Drive'}
      </button>
    </div>
  )
}

interface EditForm {
  name: string
  address: string
  contactEmails: string
  perLetterFeeNaira: string
  active: boolean
}

function BrandCard({
  brand,
  retrying,
  onRetry,
  onSave,
  onDelete,
}: {
  brand: BrandRow
  retrying: boolean
  onRetry: () => void
  onSave: (edit: EditForm) => Promise<boolean>
  onDelete: () => Promise<void>
}) {
  const total = Object.values(brand.case_counts).reduce((s, n) => s + (n ?? 0), 0)
  const ready = Boolean(brand.setup_completed_at)
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const [showBorrowers, setShowBorrowers] = useState(false)
  const [showBilling, setShowBilling] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmCode, setConfirmCode] = useState('')
  const [edit, setEdit] = useState<EditForm>(() => toEditForm(brand))

  function startEdit() {
    setEdit(toEditForm(brand))
    setMode('edit')
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const done = await onSave(edit)
    setBusy(false)
    if (done) setMode('view')
  }

  async function confirmDelete() {
    setBusy(true)
    await onDelete()
    setBusy(false)
    setMode('view')
    setConfirmCode('')
  }

  return (
    <div className="card" style={{ padding: '16px 20px', display: 'grid', gap: 12, opacity: brand.active ? 1 : 0.75 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 16 }}>{brand.name}</strong>
            <span className="badge" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{brand.code}</span>
            {!brand.active && <span className="badge">Inactive — not syncing</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
            {formatKobo(brand.per_letter_fee_kobo)} per approved letter · Shared with {brand.contact_emails.join(', ')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {brand.sheet_url && (
            <a className="btn btn-sm" href={brand.sheet_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} aria-hidden="true" style={{ marginRight: 6 }} />
              Sheet
            </a>
          )}
          {brand.drive_folder_id && !brand.drive_folder_id.startsWith('fake-') && (
            <a className="btn btn-sm" href={`https://drive.google.com/drive/folders/${brand.drive_folder_id}`} target="_blank" rel="noopener noreferrer">
              <FolderOpen size={13} aria-hidden="true" style={{ marginRight: 6 }} />
              Folder
            </a>
          )}
          {!ready && (
            <button type="button" className="btn btn-sm btn-primary" onClick={onRetry} disabled={retrying}>
              <RefreshCw size={13} aria-hidden="true" style={{ marginRight: 6 }} />
              {retrying ? 'Retrying…' : 'Retry setup'}
            </button>
          )}
          {mode === 'view' && (
            <>
              <button type="button" className="btn btn-sm" onClick={startEdit} aria-label={`Edit ${brand.name}`}>
                <Pencil size={13} aria-hidden="true" style={{ marginRight: 6 }} />
                Edit
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setMode('delete')} aria-label={`Delete ${brand.name}`}>
                <Trash2 size={13} aria-hidden="true" style={{ marginRight: 6, color: 'var(--danger)' }} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {brand.last_sync_error && (
        <div style={{ fontSize: 13, color: 'var(--danger)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          {brand.last_sync_error}
        </div>
      )}

      {mode === 'edit' && (
        <form onSubmit={submitEdit} style={{ display: 'grid', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor={`edit-name-${brand.id}`}>Brand name</label>
              <input id={`edit-name-${brand.id}`} className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor={`edit-code-${brand.id}`}>Code</label>
              <input id={`edit-code-${brand.id}`} className="input" value={brand.code} disabled />
              <small style={{ color: 'var(--text-3)', fontSize: 12 }}>Can’t change: it’s in every Case ID.</small>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor={`edit-fee-${brand.id}`}>Fee per approved letter (₦)</label>
              <input
                id={`edit-fee-${brand.id}`}
                className="input"
                required
                inputMode="decimal"
                value={edit.perLetterFeeNaira}
                onChange={(e) => setEdit({ ...edit, perLetterFeeNaira: e.target.value.replace(/[^0-9.]/g, '') })}
              />
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor={`edit-address-${brand.id}`}>Registered address (appears in every demand letter)</label>
            <input
              id={`edit-address-${brand.id}`}
              className="input"
              required
              value={edit.address}
              onChange={(e) => setEdit({ ...edit, address: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor={`edit-emails-${brand.id}`}>Contact emails</label>
            <input
              id={`edit-emails-${brand.id}`}
              className="input"
              required
              value={edit.contactEmails}
              onChange={(e) => setEdit({ ...edit, contactEmails: e.target.value })}
            />
            <small style={{ color: 'var(--text-3)', fontSize: 12 }}>
              Anyone you remove loses access to the sheet and folders; anyone you add gets an invite.
            </small>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
            Active — the sheet is checked on every sync. Untick to pause a brand without deleting anything.
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm" onClick={() => setMode('view')} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      )}

      {mode === 'delete' && (
        <div role="alertdialog" aria-label={`Delete ${brand.name}`} style={{ display: 'grid', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          {total > 0 ? (
            <>
              <p style={{ margin: 0, fontSize: 14 }}>
                <strong>{brand.code} has {total} borrower{total === 1 ? '' : 's'} on record, so it can’t be deleted</strong> — their
                letters and history are legal records. Deactivate it instead: it stops syncing but everything is kept.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-sm" onClick={() => setMode('view')}>Cancel</button>
                {brand.active && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      const done = await onSave({ ...toEditForm(brand), active: false })
                      setBusy(false)
                      if (done) setMode('view')
                    }}
                  >
                    {busy ? 'Deactivating…' : 'Deactivate instead'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 14 }}>
                This removes <strong>{brand.name}</strong> from the app and moves its Google Drive folder (sheet, Documents and
                Letters) to the bin, where Google keeps it for 30 days. The people it was shared with lose access.
              </p>
              <label htmlFor={`confirm-${brand.id}`} style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Type <strong style={{ fontFamily: 'var(--font-mono)' }}>{brand.code}</strong> to confirm
              </label>
              <input
                id={`confirm-${brand.id}`}
                className="input"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.toUpperCase())}
                autoComplete="off"
                style={{ maxWidth: 220 }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-sm" onClick={() => { setMode('view'); setConfirmCode('') }} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' }}
                  disabled={busy || confirmCode !== brand.code}
                  onClick={confirmDelete}
                >
                  {busy ? 'Deleting…' : `Delete ${brand.code}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
        <span className="badge">{total} borrower{total === 1 ? '' : 's'}</span>
        {(Object.keys(BRAND_CASE_STATUS_LABELS) as BrandCaseStatus[])
          .filter((s) => brand.case_counts[s])
          .map((s) => (
            <span key={s} className="badge">
              {BRAND_CASE_STATUS_LABELS[s]}: {brand.case_counts[s]}
            </span>
          ))}
        {brand.open_flags > 0 && (
          <span className="badge" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            {brand.open_flags} change{brand.open_flags === 1 ? '' : 's'} to review
          </span>
        )}
        {!ready && <span className="badge" style={{ color: 'var(--warning)' }}>Setup incomplete</span>}
        {!brand.address && (
          <span className="badge" style={{ color: 'var(--warning)' }}>No address — letters can’t be drafted (Edit to add)</span>
        )}
        {ready && (
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }}
            onClick={() => setShowBorrowers((v) => !v)}
            aria-expanded={showBorrowers}
          >
            {showBorrowers ? 'Hide borrowers' : 'Show borrowers'}
          </button>
        )}
        {ready && (
          <button
            type="button"
            className="btn btn-sm"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setShowBilling((v) => !v)}
            aria-expanded={showBilling}
          >
            {showBilling ? 'Hide billing' : 'Billing'}
          </button>
        )}
      </div>

      {showBilling && <BrandBilling brandId={brand.id} />}
      {showBorrowers && <BrandBorrowers brandId={brand.id} />}
    </div>
  )
}

function toEditForm(brand: BrandRow): EditForm {
  return {
    name: brand.name,
    address: brand.address ?? '',
    contactEmails: brand.contact_emails.join(', '),
    perLetterFeeNaira: String(brand.per_letter_fee_kobo / 100),
    active: brand.active,
  }
}
