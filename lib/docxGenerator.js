// The internal-review counterpart to pdfGenerator.js.
//
// pdfGenerator.js builds the PDF a CLIENT eventually receives. This builds the same letter as
// a real .docx that only ever reaches Pandas LP's own staff — never watermarked, because it
// isn't a preview of anything, it's the reviewer's actual working copy, opened in Word and
// edited directly before a stamped/signed final gets uploaded (upload-reviewed-document) or the
// case gets marked reviewed. It reaches staff two ways, both wired to the same builder below:
//   - buildDemandLetterDocxBuffer: attached server-side to the "new order" alert the moment a
//     case is paid for (app/api/verify-payment/route.ts)
//   - downloadDemandLetterDocx: the admin dashboard's "Download DOCX" button on any paid case
//     (app/admin/page.tsx) — replaces the watermarked PDF download once status is 'paid',
//     since a paid-but-unreviewed letter is exactly the thing a reviewer needs to open and edit,
//     not a read-only sample stamped "not for filing"
//
// Shares isTitleLine/normalizeForPdf/splitBoldSegments with pdfGenerator.js on purpose: the two
// formats parsing the same **bold** markup and title-line rule differently would mean a phrase
// renders bold in the client's PDF but not in the reviewer's Word doc, for no reason anyone
// looking at either file could tell.

import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, BorderStyle, Footer } from 'docx'
import { PANDAS_LOGO_DATA_URI, PANDAS_LOGO_WIDTH, PANDAS_LOGO_HEIGHT } from './logoData.js'
import { isTitleLine, normalizeForPdf, splitBoldSegments } from './pdfGenerator.js'

const BRAND_ACCENT = '182A3A'
const BRAND_GRAY = '6E6E6E'

const LOGO_HEIGHT = 44
const LOGO_WIDTH = LOGO_HEIGHT * (PANDAS_LOGO_WIDTH / PANDAS_LOGO_HEIGHT)

// A base64 string (rather than a Node Buffer) is what keeps this module isomorphic — ImageRun
// accepts either, but Buffer.from doesn't exist in a browser bundle, and this same function
// runs from both a server route (email attachment) and the admin dashboard (browser download).
function logoImageData() {
  return PANDAS_LOGO_DATA_URI.split(',')[1] ?? PANDAS_LOGO_DATA_URI
}

function letterheadParagraphs() {
  return [
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new ImageRun({ type: 'png', data: logoImageData(), transformation: { width: LOGO_WIDTH, height: LOGO_HEIGHT } }),
        new TextRun({ text: '   Pandas', bold: true, size: 30, color: '0A0A0A' }),
        new TextRun({ text: 'LP', bold: true, size: 30, color: BRAND_ACCENT }),
      ],
    }),
    new Paragraph({
      spacing: { after: 2 },
      children: [new TextRun({ text: 'Licensed Legal Practitioners, Lagos, Nigeria', size: 19, color: BRAND_GRAY })],
    }),
    new Paragraph({
      spacing: { after: 8 },
      children: [new TextRun({ text: '3B Elegba Festival Drive, Oniru, Lagos State', size: 17, color: BRAND_GRAY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 10 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: BRAND_ACCENT, space: 6 } },
      children: [
        new TextRun({
          text: 'DEBT RECOVERY   |   TENANCY & PROPERTY   |   CONTRACTS & AGREEMENTS   |   BUSINESS REGISTRATION',
          bold: true, size: 16, color: BRAND_ACCENT,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 220 },
      children: [new TextRun({ text: 'Date: _______________________', size: 21 })],
    }),
  ]
}

/** One paragraph per body line, reusing the exact **bold** parsing and title-line rule the
    client-facing PDF uses (see pdfGenerator.js) so the two formats never silently disagree
    about what's bold or what's a heading. */
function bodyParagraphs(bodyText) {
  const paragraphs = []
  const rawLines = normalizeForPdf(bodyText).split('\n')

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim()

    // Same meta-instruction strip as the PDF path — belongs in the chat, not the letter.
    if (trimmed.startsWith('NOTE TO SENDER') || trimmed.startsWith('[Date to be inserted')) continue

    if (trimmed === '') {
      paragraphs.push(new Paragraph({ text: '', spacing: { after: 90 } }))
      continue
    }

    if (isTitleLine(trimmed)) {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 200 },
        children: [new TextRun({ text: trimmed, bold: true, size: 25 })],
      }))
      continue
    }

    const runs = splitBoldSegments(rawLine).map(
      (seg) => new TextRun({ text: seg.text, bold: seg.bold, size: 21 }),
    )
    paragraphs.push(new Paragraph({ spacing: { after: 130 }, children: runs }))
  }

  return paragraphs
}

function footer() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D8D2C8', space: 8 } },
        children: [
          new TextRun({
            text: 'Pandas LP  ·  pandaslegalpractitioners@gmail.com  ·  +234 811 808 0189  ·  pandaslp.com.ng',
            size: 15, color: BRAND_GRAY,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'INTERNAL REVIEW COPY — not for filing or service', size: 14, italics: true, color: 'B8860B' })],
      }),
    ],
  })
}

// Never watermarked (nobody but staff ever sees this file), and always built fresh from
// document_body — there is no "staff-uploaded" override the way upload-reviewed-document has
// for the final PDF, because the whole point of this file is to BE the thing a reviewer edits
// before that upload happens.
function buildDocument(bodyText) {
  return new Document({
    sections: [
      {
        properties: {},
        footers: { default: footer() },
        children: [...letterheadParagraphs(), ...bodyParagraphs(bodyText)],
      },
    ],
  })
}

/** Server-side (Node route) use — email-attached to the new-order alert. See
    app/api/verify-payment/route.ts. */
export async function buildDemandLetterDocxBuffer(bodyText) {
  return Packer.toBuffer(buildDocument(bodyText))
}

/** Browser use — triggers an actual file download the same way pdfGenerator.js's
    downloadTextDocument does for the PDF, just via docx's Packer.toBlob instead of jsPDF's
    own .save(). Called directly from a click handler (see app/admin/page.tsx) — browsers only
    allow a triggered download inside a real user gesture, not from a background effect. */
export async function downloadDemandLetterDocx(title, bodyText) {
  const blob = await Packer.toBlob(buildDocument(bodyText))
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.docx`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'document.docx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
