export const CASE_DOCUMENT_BUCKET = 'case-documents'

export function reviewedDocumentPath(caseId: string): string {
  return `reviewed/${caseId}.pdf`
}

export function servedDocumentPath(accessToken: string): string {
  return `served/${accessToken}.pdf`
}
