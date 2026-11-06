import { describe, expect, it } from 'vitest'
import { Packer } from 'docx'
import { buildCourtForm } from '../courtFormDocx.js'
import { docxToText, documentXmlToText, identifyForm, splitIntoForms, PAGE_BREAK } from '../courtFormImport'
import { evidencePath, isPathForCase } from '../evidence'

const SCA1 = 'FORM SCA 1\nSMALL CLAIMS COURT\nLETTER OF DEMAND\nI hereby claim from you the sum of ₦850,000, being the balance for goods.'
const SCA2 = "FORM SCA 2\n[AFFIX THE CLAIMANT'S PASSPORT PHOTOGRAPH HERE]\nIN THE MAGISTRATES' COURT OF LAGOS STATE (SMALL CLAIMS)\nCOMPLAINT FORM (TO ACCOMPANY FORM SCA 3)\nINTEREST: ₦50,767 — edited in Google Docs"
const SCA3 = 'FORM SCA 3\nSUMMONS\nTotal: ₦1,100,767'
const S84 = 'CERTIFICATE OF IDENTIFICATION IN COMPLIANCE WITH SECTION 84 OF THE EVIDENCE ACT 2011 (AS AMENDED)\nI, Ada Obi, the Claimant & deponent'

describe('forms edited in Google Docs come back into the tab', () => {
  it('reads our own Word pack back, form by form', async () => {
    const docx = await Packer.toBuffer(buildCourtForm([SCA1, SCA2, SCA3, S84].join(`\n${PAGE_BREAK}\n`)))
    const ab = docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength) as ArrayBuffer
    const { forms, unrecognised } = splitIntoForms(await docxToText(ab))
    expect(forms.map((f) => f.kind)).toEqual(['demand_form', 'complaint', 'summons', 's84_certificate'])
    expect(forms[1].body).toContain('INTEREST: ₦50,767 — edited in Google Docs')
    expect(forms[3].body).toContain('the Claimant & deponent')
    expect(unrecognised).toEqual([])
  })

  it('keeps a manual page break inside a form with that form', () => {
    const { forms } = splitIntoForms(`${SCA3}\n${PAGE_BREAK}\ncontinued text of the summons\n${PAGE_BREAK}\nFORM SCA 3A\nSUMMARY JUDGMENT`)
    expect(forms.map((f) => f.kind)).toEqual(['summons', 'summary_judgment'])
    expect(forms[0].body).toContain('continued text of the summons')
  })

  it('tells the summons apart from the complaint form that mentions it, and 3A from 3B', () => {
    expect(identifyForm(SCA2)).toBe('complaint')
    expect(identifyForm('FORM SCA 3B\nAFFIDAVIT IN SUPPORT')).toBe('sj_affidavit')
    expect(identifyForm('Form SCC 2\nCOMPLAINT FORM')).toBe('complaint')
    expect(identifyForm('EXHIBIT LIST\nExhibit A')).toBe('exhibits')
    expect(identifyForm('Dear Sir')).toBeNull()
  })

  it('reads Google Docs page breaks, tabs and entities', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>FORM SCA 1</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">A &amp; B</w:t><w:tab/><w:t>&#8358;5</w:t></w:r></w:p><w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:t>FORM SCA 2</w:t></w:r></w:p></w:body></w:document>'
    const text = documentXmlToText(xml)
    expect(text).toContain('A & B    ₦5')
    expect(splitIntoForms(text).forms.map((f) => f.kind)).toEqual(['demand_form', 'complaint'])
  })

  it('rejects a file that is not a Word document', async () => {
    await expect(docxToText(new TextEncoder().encode('%PDF-1.7').buffer as ArrayBuffer)).rejects.toThrow(/Microsoft Word \(\.docx\)/)
  })
})

describe('client evidence storage paths', () => {
  it('keeps each file in its own case folder', () => {
    expect(evidencePath('case-1', 'WhatsApp Image 2026-10-04 at 10.12.png', 123)).toBe('case-1/123-WhatsApp_Image_2026-10-04_at_10.12.png')
    expect(isPathForCase('case-1/123-x.png', 'case-1')).toBe(true)
    expect(isPathForCase('case-2/123-x.png', 'case-1')).toBe(false)
    expect(isPathForCase('case-1/../case-2/x.png', 'case-1')).toBe(false)
  })
})
