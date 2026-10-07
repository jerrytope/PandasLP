// Server-only. The real brand workspace: Google Drive v3 + Sheets v4 REST APIs, called with
// plain fetch (like lib/claude.ts and lib/paystackVerify.ts) as the connected Google account.

import { AGENT_COLUMNS, BRAND_CASE_STATUS_VALUES, BRAND_SHEET_HEADERS, columnIndex, validateHeaders } from '../brandSheet'
import { getGoogleAccessToken } from './oauth'
import { brandFolderName, brandSheetName, runSetupSteps, type BrandWorkspace } from './workspaceTypes'

const DRIVE = 'https://www.googleapis.com/drive/v3'
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export class GoogleApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GoogleApiError'
    this.status = status
  }
}

async function gfetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const { token } = await getGoogleAccessToken()
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = data?.error?.message ?? `Google returned ${res.status}`
    throw new GoogleApiError(res.status, message)
  }
  return data as T
}

/** A1-notation prefix for a tab, looked up by its numeric id (tabs can be renamed by the brand). */
async function tabPrefix(sheetId: string, tabId: number): Promise<string> {
  const meta = await gfetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    `${SHEETS}/${sheetId}?fields=sheets.properties(sheetId,title)`,
  )
  const tab = meta.sheets?.find((s) => s.properties.sheetId === tabId)?.properties
  if (!tab) throw new GoogleApiError(404, 'The brand’s tab is missing from its sheet — was it deleted?')
  return `'${tab.title.replace(/'/g, "''")}'!`
}

/**
 * Day-first dates and Lagos time. A sheet in the default US locale turns a typed "10/06/2026"
 * into 6 October, and the wrong date would end up in a demand letter.
 */
export async function setDayFirstLocale(sheetId: string) {
  await gfetch(`${SHEETS}/${sheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ updateSpreadsheetProperties: { properties: { locale: 'en_GB', timeZone: 'Africa/Lagos' }, fields: 'locale,timeZone' } }],
    }),
  })
}

export function createGoogleWorkspace(): BrandWorkspace {
  return {
    kind: 'google',

    async readSheet(sheetId, tabId) {
      const range = encodeURIComponent(`${await tabPrefix(sheetId, tabId)}A1:Q`)
      const data = await gfetch<{ values?: (string | number | boolean)[][] }>(
        `${SHEETS}/${sheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&majorDimension=ROWS`,
      )
      return data.values ?? []
    },

    async writeCells(sheetId, tabId, writes) {
      if (writes.length === 0) return
      const prefix = await tabPrefix(sheetId, tabId)
      // RAW so the sheet stores exactly what we wrote (no date or number re-interpretation).
      await gfetch(`${SHEETS}/${sheetId}/values:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: writes.map((w) => ({ range: `${prefix}${w.column}${w.row}`, values: [[w.value]] })),
        }),
      })
    },

    async checkDocument(fileId) {
      let file: { mimeType: string; trashed: boolean }
      try {
        file = await gfetch(`${DRIVE}/files/${encodeURIComponent(fileId)}?fields=mimeType,trashed`)
      } catch (err) {
        if (err instanceof GoogleApiError && (err.status === 404 || err.status === 403)) {
          return { ok: false, reason: 'Pandas LP can’t open it — upload the documents to the brand’s Documents folder, or share them with Pandas LP' }
        }
        throw err
      }
      if (file.trashed) return { ok: false, reason: 'the file is in the Drive bin' }
      if (file.mimeType === FOLDER_MIME) {
        const q = encodeURIComponent(`'${fileId}' in parents and trashed = false`)
        const list = await gfetch<{ files?: { id: string }[] }>(`${DRIVE}/files?q=${q}&pageSize=1&fields=files(id)`)
        if (!list.files?.length) return { ok: false, reason: 'the linked folder is empty' }
      }
      return { ok: true }
    },

    async uploadFile({ folderId, name, mimeType, content, existingFileId }) {
      const body = new Uint8Array(content)
      if (existingFileId) {
        // Replace the content in place, so the Letter Link the brand already has keeps working.
        const updated = await gfetch<{ id: string; webViewLink: string }>(
          `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=media&fields=id,webViewLink`,
          { method: 'PATCH', headers: { 'content-type': mimeType }, body },
        )
        await gfetch(`${DRIVE}/files/${encodeURIComponent(existingFileId)}?fields=id`, { method: 'PATCH', body: JSON.stringify({ name }) })
        return { id: updated.id, url: updated.webViewLink }
      }
      const boundary = `pandaslp${Date.now().toString(36)}`
      const head = `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId] })}\r\n--${boundary}\r\ncontent-type: ${mimeType}\r\n\r\n`
      const tail = `\r\n--${boundary}--`
      const multipart = Buffer.concat([Buffer.from(head, 'utf8'), Buffer.from(body), Buffer.from(tail, 'utf8')])
      const created = await gfetch<{ id: string; webViewLink: string }>(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
        { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body: new Uint8Array(multipart) },
      )
      return { id: created.id, url: created.webViewLink }
    },

    async setupBrand(brand, progress, onProgress) {
      const { accountEmail } = await getGoogleAccessToken()

      return runSetupSteps(
        {
          rootFolderId: process.env.GOOGLE_BRANDS_ROOT_FOLDER_ID ?? null,

          async createFolder(name, parentId) {
            const folder = await gfetch<{ id: string }>(`${DRIVE}/files?fields=id`, {
              method: 'POST',
              body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
            })
            return folder.id
          },

          async copyTemplate(name, parentId) {
            const templateId = process.env.GOOGLE_SHEET_TEMPLATE_ID ?? ''
            const copy = await gfetch<{ id: string; webViewLink: string }>(
              `${DRIVE}/files/${encodeURIComponent(templateId)}/copy?fields=id,webViewLink`,
              { method: 'POST', body: JSON.stringify({ name, parents: [parentId] }) },
            )
            return { id: copy.id, url: copy.webViewLink }
          },

          // The copy must have exactly the fixed headers, or the sync could never match columns.
          async checkTemplate(sheetId) {
            const meta = await gfetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
              `${SHEETS}/${sheetId}?fields=sheets.properties(sheetId,title)`,
            )
            const first = meta.sheets?.[0]?.properties
            if (!first) throw new GoogleApiError(400, 'The template sheet has no tabs.')
            const range = encodeURIComponent(`'${first.title.replace(/'/g, "''")}'!A1:Q1`)
            const values = await gfetch<{ values?: string[][] }>(`${SHEETS}/${sheetId}/values/${range}`)
            const check = validateHeaders(values.values?.[0] ?? [])
            if (check.ok === false) throw new GoogleApiError(400, `The template sheet is wrong. ${check.error}`)
            await setDayFirstLocale(sheetId)
            return first.sheetId
          },

          // Header row, Case ID column and the six agent columns: only the owner account may
          // edit them. Status also gets a dropdown of the allowed values.
          async protectSheet(sheetId, tabId) {
            const owner = { users: [accountEmail] }
            const agentStart = columnIndex(AGENT_COLUMNS[0])
            const requests = [
              {
                addProtectedRange: {
                  protectedRange: {
                    range: { sheetId: tabId, startRowIndex: 0, endRowIndex: 1 },
                    description: 'Header row — managed by Pandas LP',
                    editors: owner,
                  },
                },
              },
              {
                addProtectedRange: {
                  protectedRange: {
                    range: { sheetId: tabId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
                    description: 'Case ID — assigned by Pandas LP',
                    editors: owner,
                  },
                },
              },
              {
                addProtectedRange: {
                  protectedRange: {
                    range: { sheetId: tabId, startRowIndex: 1, startColumnIndex: agentStart, endColumnIndex: BRAND_SHEET_HEADERS.length },
                    description: 'Updated by Pandas LP only — use the Notes column for updates',
                    editors: owner,
                  },
                },
              },
              {
                setDataValidation: {
                  range: { sheetId: tabId, startRowIndex: 1, startColumnIndex: columnIndex('Status'), endColumnIndex: columnIndex('Status') + 1 },
                  rule: {
                    condition: { type: 'ONE_OF_LIST', values: BRAND_CASE_STATUS_VALUES.map((v) => ({ userEnteredValue: v })) },
                    strict: true,
                    showCustomUi: true,
                  },
                },
              },
            ]
            await gfetch(`${SHEETS}/${sheetId}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) })
          },

          // A named person only — "anyone with the link" is never used anywhere in the app.
          async share(fileId, email, role) {
            await gfetch(`${DRIVE}/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=true&fields=id`, {
              method: 'POST',
              body: JSON.stringify({ type: 'user', role, emailAddress: email }),
            })
          },
        },
        brand,
        progress,
        onProgress,
      )
    },

    async unshare(progress, email) {
      const target = email.toLowerCase()
      for (const fileId of [progress.sheetId, progress.documentsFolderId, progress.lettersFolderId]) {
        if (!fileId) continue
        const list = await gfetch<{ permissions?: { id: string; emailAddress?: string; role: string }[] }>(
          `${DRIVE}/files/${encodeURIComponent(fileId)}/permissions?fields=permissions(id,emailAddress,role)`,
        )
        for (const perm of list.permissions ?? []) {
          // Never remove the owner, even if someone typed the firm's own address as a contact.
          if (perm.emailAddress?.toLowerCase() !== target || perm.role === 'owner') continue
          await gfetch(`${DRIVE}/files/${encodeURIComponent(fileId)}/permissions/${perm.id}`, { method: 'DELETE' }).catch((err) => {
            // Already gone is fine; anything else is a real failure.
            if (!(err instanceof GoogleApiError && err.status === 404)) throw err
          })
        }
      }
    },

    async rename(progress, brand) {
      if (progress.driveFolderId) {
        await gfetch(`${DRIVE}/files/${encodeURIComponent(progress.driveFolderId)}?fields=id`, {
          method: 'PATCH',
          body: JSON.stringify({ name: brandFolderName(brand) }),
        })
      }
      if (progress.sheetId) {
        await gfetch(`${DRIVE}/files/${encodeURIComponent(progress.sheetId)}?fields=id`, {
          method: 'PATCH',
          body: JSON.stringify({ name: brandSheetName(brand) }),
        })
      }
    },

    // Bin, not permanent delete: Google keeps it for 30 days, so a mistaken delete can be undone in Drive.
    async trash(progress) {
      const ids = progress.driveFolderId ? [progress.driveFolderId] : [progress.sheetId].filter((x): x is string => Boolean(x))
      for (const id of ids) {
        await gfetch(`${DRIVE}/files/${encodeURIComponent(id)}?fields=id`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) }).catch((err) => {
          if (!(err instanceof GoogleApiError && err.status === 404)) throw err
        })
      }
    },
  }
}
