// Server-only. Creating a brand and building its Google workspace. The admin routes in
// app/api/admin/brands/ are thin wrappers around this.

import { supabaseAdmin } from './supabaseAdmin'
import { isValidBrandCode } from './brandSheet'
import { getBrandWorkspace, type BrandSetupProgress } from './google/workspace'

export interface BrandInput {
  name: string
  code: string
  /** Named in every demand letter: "solicitors of [name] of [address]". */
  address: string
  contactEmails: string[]
  perLetterFeeKobo: number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_CONTACTS = 10

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** The editable fields, shared by "New brand" and "Edit brand". */
function parseBrandFields(b: Record<string, unknown>): Parsed<Omit<BrandInput, 'code'>> {
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const address = typeof b.address === 'string' ? b.address.trim().replace(/\s+/g, ' ') : ''
  const rawEmails = Array.isArray(b.contactEmails)
    ? b.contactEmails
    : typeof b.contactEmails === 'string'
      ? b.contactEmails.split(/[,;\s]+/)
      : []
  const contactEmails = [...new Set(rawEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean))]
  // Number('') is 0 in JavaScript, so an empty field must be caught before converting.
  const rawFee = b.perLetterFeeNaira
  const fee = typeof rawFee === 'number' ? rawFee : typeof rawFee === 'string' && rawFee.trim() !== '' ? Number(rawFee) : NaN

  if (!name || name.length > 120) return { ok: false, error: 'Enter the brand’s name (up to 120 characters).' }
  if (address.length < 10 || address.length > 300) return { ok: false, error: 'Enter the brand’s registered address — it appears in every demand letter.' }
  if (contactEmails.length === 0) return { ok: false, error: 'Add at least one contact email to share the sheet with.' }
  if (contactEmails.length > MAX_CONTACTS) return { ok: false, error: `At most ${MAX_CONTACTS} contact emails.` }
  const badEmail = contactEmails.find((e) => !EMAIL_RE.test(e))
  if (badEmail) return { ok: false, error: `"${badEmail}" is not a valid email address.` }
  if (!Number.isFinite(fee) || fee < 0 || fee > 10_000_000) return { ok: false, error: 'Enter the fee per approved letter in naira.' }

  return { ok: true, value: { name, address, contactEmails, perLetterFeeKobo: Math.round(fee * 100) } }
}

/** Validates and normalises the "New brand" form. Pure, so it's unit-tested. */
export function parseBrandInput(body: unknown): Parsed<BrandInput> {
  const b = (body ?? {}) as Record<string, unknown>
  const code = typeof b.code === 'string' ? b.code.trim().toUpperCase() : ''
  const fields = parseBrandFields(b)
  if (fields.ok === false) return fields
  if (!isValidBrandCode(code)) return { ok: false, error: 'Brand code must be 2–8 capital letters, e.g. LAPO. It becomes the Case ID prefix.' }
  return { ok: true, value: { ...fields.value, code } }
}

export interface BrandUpdate extends Omit<BrandInput, 'code'> {
  active: boolean
}

/**
 * Validates the "Edit brand" form. The code is deliberately not editable: it is the prefix of
 * every Case ID already issued, in the sheet and in letters.
 */
export function parseBrandUpdate(body: unknown): Parsed<BrandUpdate> {
  const b = (body ?? {}) as Record<string, unknown>
  const fields = parseBrandFields(b)
  if (fields.ok === false) return fields
  if (typeof b.active !== 'boolean') return { ok: false, error: 'Missing active flag.' }
  return { ok: true, value: { ...fields.value, active: b.active } }
}

function progressOf(brand: BrandRow): BrandSetupProgress {
  return {
    driveFolderId: brand.drive_folder_id,
    documentsFolderId: brand.documents_folder_id,
    lettersFolderId: brand.letters_folder_id,
    sheetId: brand.sheet_id,
    sheetUrl: brand.sheet_url,
    sheetTabId: brand.sheet_tab_id,
    sheetProtectedAt: brand.sheet_protected_at,
    sharedWith: brand.shared_with ?? [],
  }
}

/** True once any part of the brand's Google workspace exists. */
function hasDriveFiles(p: BrandSetupProgress): boolean {
  return Boolean(p.driveFolderId || p.documentsFolderId || p.lettersFolderId || p.sheetId)
}

type BrandRow = {
  id: string
  name: string
  code: string
  contact_emails: string[]
  drive_folder_id: string | null
  documents_folder_id: string | null
  letters_folder_id: string | null
  sheet_id: string | null
  sheet_url: string | null
  sheet_tab_id: number | null
  sheet_protected_at: string | null
  shared_with: string[]
}

const PROGRESS_COLUMNS: Record<keyof BrandSetupProgress, keyof BrandRow> = {
  driveFolderId: 'drive_folder_id',
  documentsFolderId: 'documents_folder_id',
  lettersFolderId: 'letters_folder_id',
  sheetId: 'sheet_id',
  sheetUrl: 'sheet_url',
  sheetTabId: 'sheet_tab_id',
  sheetProtectedAt: 'sheet_protected_at',
  sharedWith: 'shared_with',
}

/**
 * Builds (or finishes building) a brand's folder and sheet in the connected Google Drive.
 * Each finished step is saved straight away, so running this again after a failure resumes
 * rather than duplicating anything. Errors are stored on the brand for the admin to see.
 */
export async function runBrandSetup(brandId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: brand, error } = await supabaseAdmin.from('brands').select('*').eq('id', brandId).single<BrandRow>()
  if (error || !brand) return { ok: false, error: 'Brand not found.' }

  const progress = progressOf(brand)

  try {
    const workspace = getBrandWorkspace()
    await workspace.setupBrand(
      { name: brand.name, code: brand.code, contactEmails: brand.contact_emails },
      progress,
      async (patch) => {
        const update: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(patch)) update[PROGRESS_COLUMNS[key as keyof BrandSetupProgress]] = value
        const { error: saveErr } = await supabaseAdmin.from('brands').update(update).eq('id', brandId)
        if (saveErr) throw new Error(`Could not save setup progress: ${saveErr.message}`)
      },
    )
    await supabaseAdmin
      .from('brands')
      .update({ setup_completed_at: new Date().toISOString(), last_sync_error: null })
      .eq('id', brandId)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Brand setup failed for ${brand.code}:`, message)
    await supabaseAdmin.from('brands').update({ last_sync_error: `Setup: ${message}` }).eq('id', brandId)
    return { ok: false, error: message }
  }
}

/**
 * Saves an edit, then brings Google in line with it: a removed contact loses access to the
 * sheet and both folders, a new one is invited, and a new name renames the folder and sheet.
 * The database change is kept even if Google fails; the error is shown on the brand and the
 * Google part is retried by saving again or pressing "Retry setup".
 */
export async function updateBrand(brandId: string, upd: BrandUpdate): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: brand, error } = await supabaseAdmin.from('brands').select('*').eq('id', brandId).single<BrandRow>()
  if (error || !brand) return { ok: false, status: 404, error: 'Brand not found.' }

  const { error: saveErr } = await supabaseAdmin
    .from('brands')
    .update({ name: upd.name, address: upd.address, contact_emails: upd.contactEmails, per_letter_fee_kobo: upd.perLetterFeeKobo, active: upd.active })
    .eq('id', brandId)
  if (saveErr) return { ok: false, status: 500, error: 'Could not save the brand.' }

  const progress = progressOf(brand)
  if (!hasDriveFiles(progress)) return { ok: true } // nothing in Drive yet; setup will use the new details

  try {
    const workspace = getBrandWorkspace()
    const removed = progress.sharedWith.filter((e) => !upd.contactEmails.includes(e))
    for (const email of removed) {
      await workspace.unshare(progress, email)
      progress.sharedWith = progress.sharedWith.filter((e) => e !== email)
      await supabaseAdmin.from('brands').update({ shared_with: progress.sharedWith }).eq('id', brandId)
    }
    if (upd.name !== brand.name) await workspace.rename(progress, { name: upd.name, code: brand.code, contactEmails: upd.contactEmails })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabaseAdmin.from('brands').update({ last_sync_error: `Edit: ${message}` }).eq('id', brandId)
    return { ok: false, status: 502, error: `Saved, but Google Drive was not fully updated: ${message}` }
  }

  // Invites anyone newly added (and finishes any setup step still missing).
  const setup = await runBrandSetup(brandId)
  if (setup.ok === false) return { ok: false, status: 502, error: `Saved, but Google Drive was not fully updated: ${setup.error}` }
  return { ok: true }
}

/**
 * Deletes a brand that never had any borrowers. Its Drive folder goes to the bin (Google keeps
 * it 30 days). A brand with borrowers can only be deactivated: its cases, letters and audit
 * log are legal records and must not disappear with it.
 */
export async function deleteBrand(brandId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: brand, error } = await supabaseAdmin.from('brands').select('*').eq('id', brandId).single<BrandRow>()
  if (error || !brand) return { ok: false, status: 404, error: 'Brand not found.' }

  const [{ count: borrowers }, { count: matters }] = await Promise.all([
    // Test-key borrowers (the API sandbox) are not records; they go with the brand.
    supabaseAdmin.from('brand_cases').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).eq('is_test', false),
    supabaseAdmin.from('cases').select('id', { count: 'exact', head: true }).eq('brand_id', brandId),
  ])
  if ((borrowers ?? 0) > 0 || (matters ?? 0) > 0) {
    return { ok: false, status: 409, error: `${brand.code} has borrowers on record, so it can’t be deleted. Deactivate it instead (Edit → Active off).` }
  }

  const progress = progressOf(brand)
  if (hasDriveFiles(progress)) {
    try {
      await getBrandWorkspace().trash(progress)
    } catch (err) {
      // Keep the brand so the delete can be retried, rather than leaving its files orphaned in Drive.
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, status: 502, error: `Could not move the brand’s Drive folder to the bin, so nothing was deleted: ${message}` }
    }
  }

  await supabaseAdmin.from('brand_change_flags').delete().eq('brand_id', brandId)
  const { data: testDocs } = await supabaseAdmin.from('brand_case_documents').select('storage_path, brand_cases!inner(brand_id)').eq('brand_cases.brand_id', brandId)
  if (testDocs?.length) await supabaseAdmin.storage.from('case-evidence').remove(testDocs.map((d) => d.storage_path))
  await supabaseAdmin.from('brand_cases').delete().eq('brand_id', brandId).eq('is_test', true)
  const { error: delErr } = await supabaseAdmin.from('brands').delete().eq('id', brandId)
  if (delErr) return { ok: false, status: 500, error: `Drive folder is in the bin, but the brand could not be removed: ${delErr.message}` }
  return { ok: true }
}
