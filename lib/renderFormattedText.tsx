import type { ReactNode } from 'react'

// Renders **bold** markers the same way lib/pdfGenerator.js interprets them for the PDF,
// as real React elements (not dangerouslySetInnerHTML) — document_body is AI-generated from
// user-supplied case facts, so it must never be treated as trusted HTML.
export function renderFormattedText(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}
