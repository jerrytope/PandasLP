// Client evidence (screenshots, receipts, PDFs) is kept, always. The browser uploads the
// original file straight to the private "case-evidence" bucket with a one-time signed upload
// URL (app/api/evidence/upload), so a large phone photo never has to pass through a serverless
// function body (Vercel rejects bodies over ~4.5 MB). /api/extract then records the file
// against the case BEFORE the AI reads it, so a failed read never loses the file.

export const EVIDENCE_BUCKET = 'case-evidence'
// Documents the AI can read, and videos (e.g. proof of service) that are kept but not read.
export const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp']
export const EVIDENCE_TYPES = [...DOCUMENT_TYPES, ...VIDEO_TYPES]
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_EVIDENCE_BYTES = 50 * 1024 * 1024 // the bucket's own limit, set for videos
export const EVIDENCE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.3gp'
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp'

export const isVideo = (type: string) => VIDEO_TYPES.includes(type)
export const maxBytesFor = (type: string) => (isVideo(type) ? MAX_EVIDENCE_BYTES : MAX_DOCUMENT_BYTES)
export const sizeLimitText = (type: string) => (isVideo(type) ? '50 MB' : '10 MB')

export function evidencePath(caseId: string, filename: string, now = Date.now()): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file'
  return `${caseId}/${now}-${safe}`
}

// A path handed back by the browser must sit inside that case's own folder.
export function isPathForCase(path: string, caseId: string): boolean {
  return path.startsWith(`${caseId}/`) && !path.includes('..') && path.length < 300
}
