// Types and the shared setup sequence for a brand workspace. Kept apart from workspace.ts
// (which picks an implementation) so the implementations can import this without a cycle.

export interface BrandSetupInput {
  name: string
  code: string
  contactEmails: string[]
}

/**
 * How far a brand's Google setup has got. Each step's result is saved as soon as it succeeds
 * (see onProgress), so if Google fails halfway, "Retry setup" resumes instead of creating a
 * second folder or sheet.
 */
export interface BrandSetupProgress {
  driveFolderId: string | null
  documentsFolderId: string | null
  lettersFolderId: string | null
  sheetId: string | null
  sheetUrl: string | null
  sheetTabId: number | null
  sheetProtectedAt: string | null
  /** Contact emails the sheet AND both folders have already been shared with. */
  sharedWith: string[]
}

export interface BrandWorkspace {
  /** Which account owns the files ("fake" for the fake). */
  readonly kind: 'google' | 'fake'
  /**
   * Create (or finish creating) a brand's folder, Documents and Letters subfolders and sheet,
   * protect the app's columns, and share with the brand's named emails only — never by link.
   */
  setupBrand(
    brand: BrandSetupInput,
    progress: BrandSetupProgress,
    onProgress: (patch: Partial<BrandSetupProgress>) => Promise<void>,
  ): Promise<BrandSetupProgress>
  /** Take away one person's access to the sheet and both folders (a contact removed in Edit brand). */
  unshare(progress: BrandSetupProgress, email: string): Promise<void>
  /** Rename the brand's Drive folder and sheet after its name is edited. */
  rename(progress: BrandSetupProgress, brand: BrandSetupInput): Promise<void>
  /** Move the brand's folder (with its sheet and subfolders) to the Drive bin — recoverable for 30 days. */
  trash(progress: BrandSetupProgress): Promise<void>

  // ── Phase 2: the sync job ──

  /**
   * Every cell in columns A–Q of the brand's sheet, UNFORMATTED (numbers as numbers, real dates
   * as serial numbers), row 1 first. Trailing empty rows and cells may be missing.
   */
  readSheet(sheetId: string, tabId: number): Promise<SheetCell[][]>
  /**
   * Write cells by row number. Callers must have located the row by Case ID immediately before
   * (rows move when a brand sorts), and only ever write the Case ID column and the agent columns.
   */
  writeCells(sheetId: string, tabId: number, writes: CellWrite[]): Promise<void>
  /** Can the connected account open this Drive file or folder, and is there something in it? */
  checkDocument(fileId: string): Promise<{ ok: true } | { ok: false; reason: string }>
  /**
   * Upload (or, given existingFileId, replace the content of) a file in a folder; returns its
   * Drive link. Used for the brand's letters.
   */
  uploadFile(input: { folderId: string; name: string; mimeType: string; content: Buffer; existingFileId?: string | null }): Promise<{ id: string; url: string }>
}

export type SheetCell = string | number | boolean | null

/** One cell to write: 1-based row number and a column letter (A–Q). */
export interface CellWrite {
  row: number
  column: string
  value: string
}

/** The Drive names used for a brand, so setup and rename always agree. */
export const brandFolderName = (b: BrandSetupInput) => `${b.name} (${b.code})`
export const brandSheetName = (b: BrandSetupInput) => `${b.name} — Pandas LP Loan Recovery`

export function emptySetupProgress(): BrandSetupProgress {
  return {
    driveFolderId: null,
    documentsFolderId: null,
    lettersFolderId: null,
    sheetId: null,
    sheetUrl: null,
    sheetTabId: null,
    sheetProtectedAt: null,
    sharedWith: [],
  }
}

/** Runs the setup steps in order, skipping any already recorded in `progress`. Shared by both implementations. */
export async function runSetupSteps(
  steps: {
    createFolder(name: string, parentId: string | null): Promise<string>
    copyTemplate(name: string, parentId: string): Promise<{ id: string; url: string }>
    checkTemplate(sheetId: string): Promise<number>
    protectSheet(sheetId: string, tabId: number): Promise<void>
    share(fileId: string, email: string, role: 'writer' | 'reader'): Promise<void>
    rootFolderId: string | null
  },
  brand: BrandSetupInput,
  start: BrandSetupProgress,
  onProgress: (patch: Partial<BrandSetupProgress>) => Promise<void>,
): Promise<BrandSetupProgress> {
  const p: BrandSetupProgress = { ...start, sharedWith: [...start.sharedWith] }
  const save = async (patch: Partial<BrandSetupProgress>) => {
    Object.assign(p, patch)
    await onProgress(patch)
  }

  if (!p.driveFolderId) await save({ driveFolderId: await steps.createFolder(brandFolderName(brand), steps.rootFolderId) })
  if (!p.documentsFolderId) await save({ documentsFolderId: await steps.createFolder('Documents', p.driveFolderId) })
  if (!p.lettersFolderId) await save({ lettersFolderId: await steps.createFolder('Letters', p.driveFolderId) })
  if (!p.sheetId) {
    const sheet = await steps.copyTemplate(brandSheetName(brand), p.driveFolderId!)
    await save({ sheetId: sheet.id, sheetUrl: sheet.url })
  }
  if (p.sheetTabId === null) await save({ sheetTabId: await steps.checkTemplate(p.sheetId!) })
  if (!p.sheetProtectedAt) {
    await steps.protectSheet(p.sheetId!, p.sheetTabId!)
    await save({ sheetProtectedAt: new Date().toISOString() })
  }

  // The brand edits the sheet and uploads loan documents; it can only VIEW the letters
  // (so a drafted or approved letter can't be altered by the brand).
  for (const email of brand.contactEmails) {
    if (p.sharedWith.includes(email)) continue
    await steps.share(p.sheetId!, email, 'writer')
    await steps.share(p.documentsFolderId!, email, 'writer')
    await steps.share(p.lettersFolderId!, email, 'reader')
    await save({ sharedWith: [...p.sharedWith, email] })
  }
  return p
}
