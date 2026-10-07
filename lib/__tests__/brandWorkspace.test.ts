import { describe, it, expect, beforeEach } from 'vitest'
import { FakeGoogleDrive } from '../google/fakeWorkspace'
import { emptySetupProgress, type BrandSetupProgress } from '../google/workspaceTypes'
import { encryptSecret, decryptSecret, signState, verifyState } from '../google/tokenCrypto'

const brand = { name: 'Lender Ltd', code: 'LEND', contactEmails: ['ops@lender.ng', 'ceo@lender.ng'] }

describe('brand workspace setup (fake Google)', () => {
  let drive: FakeGoogleDrive
  let saved: BrandSetupProgress
  const onProgress = async (patch: Partial<BrandSetupProgress>) => {
    saved = { ...saved, ...patch }
  }

  beforeEach(() => {
    drive = new FakeGoogleDrive()
    saved = emptySetupProgress()
  })

  it('creates a folder, Documents and Letters subfolders and a protected sheet', async () => {
    const result = await drive.workspace().setupBrand(brand, saved, onProgress)
    const folders = [...drive.files.values()].filter((f) => f.kind === 'folder').map((f) => f.name)
    expect(folders).toEqual(['Lender Ltd (LEND)', 'Documents', 'Letters'])
    expect(drive.files.get(result.sheetId!)?.protectedTab).toBe(0)
    expect(result.sheetProtectedAt).not.toBeNull()
  })

  it('shares only with the named emails: sheet and Documents as editors, Letters view-only', async () => {
    const r = await drive.workspace().setupBrand(brand, saved, onProgress)
    for (const email of brand.contactEmails) {
      expect(drive.files.get(r.sheetId!)?.permissions[email]).toBe('writer')
      expect(drive.files.get(r.documentsFolderId!)?.permissions[email]).toBe('writer')
      expect(drive.files.get(r.lettersFolderId!)?.permissions[email]).toBe('reader')
    }
    expect(Object.keys(drive.files.get(r.sheetId!)!.permissions).sort()).toEqual([...brand.contactEmails].sort())
    expect(r.sharedWith).toEqual(brand.contactEmails)
  })

  it('resumes after a failure without creating a second folder or sheet', async () => {
    drive.failNext = 'protectSheet'
    await expect(drive.workspace().setupBrand(brand, saved, onProgress)).rejects.toThrow()
    // Folders and the sheet copy were saved as they succeeded...
    expect(saved.sheetId).not.toBeNull()
    expect(saved.sheetProtectedAt).toBeNull()
    const filesBefore = drive.files.size

    // ...so the retry only does what's left.
    const result = await drive.workspace().setupBrand(brand, saved, onProgress)
    expect(drive.files.size).toBe(filesBefore)
    expect(result.sheetProtectedAt).not.toBeNull()
    expect(result.sharedWith).toEqual(brand.contactEmails)
  })

  it('a retry after a sharing failure only shares with the people still missing', async () => {
    drive.failNext = 'share'
    await expect(drive.workspace().setupBrand(brand, saved, onProgress)).rejects.toThrow()
    expect(saved.sharedWith).toEqual([])
    const result = await drive.workspace().setupBrand(brand, saved, onProgress)
    expect(result.sharedWith).toEqual(brand.contactEmails)
  })
})

describe('editing and deleting a brand (fake Google)', () => {
  it('removing a contact takes away their access everywhere, and only theirs', async () => {
    const drive = new FakeGoogleDrive()
    const ws = drive.workspace()
    const p = await ws.setupBrand(brand, emptySetupProgress(), async () => {})
    await ws.unshare(p, 'ops@lender.ng')
    for (const id of [p.sheetId!, p.documentsFolderId!, p.lettersFolderId!]) {
      expect(drive.files.get(id)?.permissions['ops@lender.ng']).toBeUndefined()
      expect(drive.files.get(id)?.permissions['ceo@lender.ng']).toBeDefined()
    }
  })

  it('renames the folder and sheet, keeping the code', async () => {
    const drive = new FakeGoogleDrive()
    const ws = drive.workspace()
    const p = await ws.setupBrand(brand, emptySetupProgress(), async () => {})
    await ws.rename(p, { ...brand, name: 'Lender Bank' })
    expect(drive.files.get(p.driveFolderId!)?.name).toBe('Lender Bank (LEND)')
    expect(drive.files.get(p.sheetId!)?.name).toBe('Lender Bank — Pandas LP Loan Recovery')
  })

  it('delete moves the brand folder to the bin rather than destroying it', async () => {
    const drive = new FakeGoogleDrive()
    const ws = drive.workspace()
    const p = await ws.setupBrand(brand, emptySetupProgress(), async () => {})
    await ws.trash(p)
    expect(drive.files.get(p.driveFolderId!)?.trashed).toBe(true)
    expect(drive.files.has(p.driveFolderId!)).toBe(true)
  })
})

describe('token encryption and OAuth state', () => {
  beforeEach(() => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64)
  })

  it('round-trips a refresh token and never stores it in plain text', () => {
    const enc = encryptSecret('1//refresh-token')
    expect(enc).not.toContain('refresh-token')
    expect(decryptSecret(enc)).toBe('1//refresh-token')
  })

  it('rejects a tampered ciphertext', () => {
    const [iv, tag, ct] = encryptSecret('secret').split('.')
    const tampered = [iv, tag, Buffer.from('other').toString('base64url') + ct.slice(7)].join('.')
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('accepts its own state, and rejects a forged or expired one', () => {
    const now = Date.now()
    const state = signState('staff@pandaslp.com.ng', now)
    expect(verifyState(state, now)).toBe('staff@pandaslp.com.ng')
    expect(verifyState(state, now + 11 * 60 * 1000)).toBeNull()
    const [payload] = state.split('.')
    expect(verifyState(`${payload}.forged`, now)).toBeNull()
  })

  it('refuses a missing or malformed encryption key', () => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'too-short'
    expect(() => encryptSecret('x')).toThrow(/64 hex/)
  })
})
