// In-memory stand-in for Google, for unit tests and local development without a Google account
// (GOOGLE_FAKE_WORKSPACE=true). Same setup steps as the real one (runSetupSteps), so tests
// exercise the real resume/skip logic. Nothing here persists across server restarts.

import { randomUUID } from 'crypto'
import { BRAND_SHEET_HEADERS } from '../brandSheet'
import { brandFolderName, brandSheetName, runSetupSteps, type BrandWorkspace, type SheetCell } from './workspaceTypes'

export interface FakeFile {
  id: string
  name: string
  kind: 'folder' | 'sheet' | 'file'
  parentId: string | null
  /** email -> role; there is no "anyone with the link" in the fake either. */
  permissions: Record<string, 'writer' | 'reader'>
  trashed?: boolean
  /** Sheets only: row 0 is the header row. */
  rows?: SheetCell[][]
  protectedTab?: number
  /** Uploaded files only. */
  content?: Buffer
}

const COLUMN_LETTERS = BRAND_SHEET_HEADERS.map((_, i) => String.fromCharCode(65 + i))

export class FakeGoogleDrive {
  files = new Map<string, FakeFile>()
  /** Set to make the named step throw once, to test resuming a half-finished setup. */
  failNext: 'createFolder' | 'copyTemplate' | 'protectSheet' | 'share' | 'writeCells' | 'uploadFile' | null = null
  /** Every write made to any sheet, in order — lets tests assert nothing was written twice. */
  writeLog: { sheetId: string; row: number; column: string; value: string }[] = []

  private maybeFail(step: NonNullable<FakeGoogleDrive['failNext']>) {
    if (this.failNext === step) {
      this.failNext = null
      throw new Error(`Fake Google failure in ${step}`)
    }
  }

  // ── Test helpers: act like the brand typing into its sheet ──

  /** Put a row into a sheet, by 1-based row number, from header → value pairs. */
  setRow(sheetId: string, rowNumber: number, values: Partial<Record<(typeof BRAND_SHEET_HEADERS)[number], SheetCell>>) {
    const rows = this.sheet(sheetId).rows!
    while (rows.length < rowNumber) rows.push([])
    rows[rowNumber - 1] = BRAND_SHEET_HEADERS.map((h) => values[h] ?? '')
  }

  /** The value of one cell, by 1-based row and header name. */
  cell(sheetId: string, rowNumber: number, header: (typeof BRAND_SHEET_HEADERS)[number]): SheetCell {
    return this.sheet(sheetId).rows![rowNumber - 1]?.[BRAND_SHEET_HEADERS.indexOf(header)] ?? ''
  }

  /** Sort data rows (not the header) the way a brand might, to prove rows aren't tracked by number. */
  reverseDataRows(sheetId: string) {
    const rows = this.sheet(sheetId).rows!
    rows.splice(1, rows.length - 1, ...rows.slice(1).reverse())
  }

  /** A file in the brand's Documents folder, for the Documents Link column. */
  addDocument(parentId: string, name = 'loan-agreement.pdf'): string {
    const id = `fakedoc${randomUUID().replace(/-/g, '')}`
    this.files.set(id, { id, name, kind: 'file', parentId, permissions: {} })
    return id
  }

  private sheet(sheetId: string): FakeFile {
    const f = this.files.get(sheetId)
    if (!f?.rows) throw new Error(`Fake: no sheet ${sheetId}`)
    return f
  }

  workspace(): BrandWorkspace {
    return {
      kind: 'fake',
      setupBrand: (brand, progress, onProgress) =>
        runSetupSteps(
          {
            rootFolderId: null,
            createFolder: async (name, parentId) => {
              this.maybeFail('createFolder')
              const id = `fake-folder-${randomUUID()}`
              this.files.set(id, { id, name, kind: 'folder', parentId, permissions: {} })
              return id
            },
            copyTemplate: async (name, parentId) => {
              this.maybeFail('copyTemplate')
              const id = `fake-sheet-${randomUUID()}`
              this.files.set(id, { id, name, kind: 'sheet', parentId, permissions: {}, rows: [[...BRAND_SHEET_HEADERS]] })
              return { id, url: `https://docs.google.com/spreadsheets/d/${id}/edit` }
            },
            checkTemplate: async () => 0,
            protectSheet: async (sheetId, tabId) => {
              this.maybeFail('protectSheet')
              const f = this.files.get(sheetId)
              if (f) f.protectedTab = tabId
            },
            share: async (fileId, email, role) => {
              this.maybeFail('share')
              const f = this.files.get(fileId)
              if (!f) throw new Error(`Fake: no file ${fileId}`)
              f.permissions[email] = role
            },
          },
          brand,
          progress,
          onProgress,
        ),
      unshare: async (progress, email) => {
        for (const id of [progress.sheetId, progress.documentsFolderId, progress.lettersFolderId]) {
          const f = id ? this.files.get(id) : undefined
          if (f) delete f.permissions[email]
        }
      },
      rename: async (progress, brand) => {
        const folder = progress.driveFolderId ? this.files.get(progress.driveFolderId) : undefined
        if (folder) folder.name = brandFolderName(brand)
        const sheet = progress.sheetId ? this.files.get(progress.sheetId) : undefined
        if (sheet) sheet.name = brandSheetName(brand)
      },
      trash: async (progress) => {
        const id = progress.driveFolderId ?? progress.sheetId
        const f = id ? this.files.get(id) : undefined
        if (f) f.trashed = true
      },

      readSheet: async (sheetId) => this.sheet(sheetId).rows!.map((r) => [...r]),

      writeCells: async (sheetId, _tabId, writes) => {
        this.maybeFail('writeCells')
        const rows = this.sheet(sheetId).rows!
        for (const w of writes) {
          const col = COLUMN_LETTERS.indexOf(w.column)
          if (col < 0) throw new Error(`Fake: bad column ${w.column}`)
          while (rows.length < w.row) rows.push([])
          const row = rows[w.row - 1]
          while (row.length <= col) row.push('')
          row[col] = w.value
          this.writeLog.push({ sheetId, row: w.row, column: w.column, value: w.value })
        }
      },

      checkDocument: async (fileId) => {
        const f = this.files.get(fileId)
        if (!f) return { ok: false, reason: 'Pandas LP can’t open it — upload the documents to the brand’s Documents folder, or share them with Pandas LP' }
        if (f.trashed) return { ok: false, reason: 'the file is in the Drive bin' }
        if (f.kind === 'folder' && ![...this.files.values()].some((c) => c.parentId === fileId && !c.trashed)) {
          return { ok: false, reason: 'the linked folder is empty' }
        }
        return { ok: true }
      },

      uploadFile: async ({ folderId, name, content, existingFileId }) => {
        this.maybeFail('uploadFile')
        const existing = existingFileId ? this.files.get(existingFileId) : undefined
        if (existing) {
          existing.name = name
          existing.content = content
          return { id: existing.id, url: `https://drive.google.com/file/d/${existing.id}/view` }
        }
        const id = `fakefile${randomUUID().replace(/-/g, '')}`
        this.files.set(id, { id, name, kind: 'file', parentId: folderId, permissions: {}, content })
        return { id, url: `https://drive.google.com/file/d/${id}/view` }
      },
    }
  }
}

// One shared fake per server process for local development.
let devDrive: FakeGoogleDrive | null = null
export function getFakeDrive(): FakeGoogleDrive {
  devDrive ??= new FakeGoogleDrive()
  return devDrive
}
export function getFakeWorkspace(): BrandWorkspace {
  return getFakeDrive().workspace()
}
