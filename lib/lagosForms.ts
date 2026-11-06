// Lagos State Small Claims: Forms SCA 2 (complaint), SCA 3 (summons), SCA 3A (application for
// summary judgment) and SCA 3B (affidavit in support), word for word as printed in the Lagos
// State Magistrates' Courts Law Practice Direction on Small Claims 2023, with the printed form's
// misprints corrected at the firm's instruction: "THUMB PRINT" (printed "THUMP"), "If you
// require" ("If require"), "REGISTRY THIS" ("THIS THIS"), "mark" ("remark"), and the stray
// quotation mark and asterisk before "blind" in the jurats.
//
// The case particulars are filled in here, from the filing record, never retyped by the AI:
// names, addresses, telephone and e-mail, the figures, and the claim number and hearing date
// once the registry has issued them. The only free text is the complaint summary (SCA 2) and
// paragraph 6 of the affidavit (SCA 3B), which the AI drafts and fillLagosForm inserts. Every
// "Dated" line stays blank as printed: the claimant or registry dates each form.

import { claimFigures, interestWording, naira, nairaWithWords, type FilingFacts, type Party } from './courtFiling'

const COURT = "IN THE MAGISTRATES' COURT OF LAGOS STATE (SMALL CLAIMS)"
const DOTS = '……………………………'
const LONG_DOTS = '……………………………………………………'

export type LagosFormKind = 'complaint' | 'summons' | 'summary_judgment' | 'sj_affidavit'
export const LAGOS_FORM_KINDS: LagosFormKind[] = ['complaint', 'summons', 'summary_judgment', 'sj_affidavit']

export function isLagosForm(kind: string, state: string | null | undefined): kind is LagosFormKind {
  return state === 'lagos' && (LAGOS_FORM_KINDS as string[]).includes(kind)
}

// The two forms with a narrative part the AI drafts; the summons and the application are
// filled entirely from the record.
export function lagosNarrativeNeeded(kind: LagosFormKind): boolean {
  return kind === 'complaint' || kind === 'sj_affidavit'
}

export interface LagosFormInput {
  facts: FilingFacts
  // Fallbacks from the case when the filing facts lack them.
  clientPhone?: string | null
  clientEmail?: string | null
  debtorPhone?: string | null
  registry?: string | null // e.g. "Ikeja"
  claimNumber?: string | null
  firstHearingAt?: string | null // ISO date and time, once the registry has fixed it
  filedAt?: string | null // interest is worked out to the filing date, or today before filing
}

const val = (s?: string | null) => (s ?? '').toString().trim()
const or = (s?: string | null, dots = DOTS) => val(s) || dots

function contact(p: Party | undefined, phone?: string | null, email?: string | null): string {
  const ph = val(p?.phone) || val(phone)
  const em = val(p?.email) || val(email)
  return `${ph || DOTS}; e-mail: ${em || DOTS}`
}

// The address a document is served at: a company's work address, otherwise the home address.
function serviceAddress(p: Party | undefined): string {
  return val(p?.workAddress) || val(p?.residentialAddress) || DOTS
}

// "Acme Limited (Attention: Mr John Bello)" -> "ACME LIMITED" for the BETWEEN block.
function titleName(p: Party | undefined): string {
  const n = val(p?.name).replace(/\s*\((attention|attn)[^)]*\)\s*$/i, '')
  return n ? n.toUpperCase() : DOTS
}

function hearing(iso?: string | null): { day: string; month: string; year: string; time: string } {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return { day: '…………', month: '…………', year: '……', time: '…………' }
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Africa/Lagos' })
  const month = d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'Africa/Lagos' })
  const year = d.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Africa/Lagos' }).slice(2)
  const hasTime = iso!.length > 10
  const time = hasTime ? d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' }) : '…………'
  return { day: ordinal(Number(day)), month, year, time }
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'
  return `${n}${s}`
}

// What the AI is asked for, for the two forms with a narrative part. The reply is inserted
// as it comes; these instructions keep it to the part of the form it belongs in.
export function lagosNarrativeInstruction(kind: LagosFormKind): string {
  if (kind === 'complaint') {
    return `Write ONLY the text that goes under "SUMMARISE YOUR COMPLAINT AND STATE THE STEPS YOU HAVE TAKEN TO RECOVER THE CLAIM:" on Form SCA 2. The rest of the form (headings, particulars, figures, signature block) is filled in by the system: do not write any of it.

Short first-person paragraphs, as the claimant would tell it, in this order: (1) who the defendant is and what was agreed; (2) every payment or the debt, each with its exact date, amount and how it was paid, taken from the evidence (e.g. "On 3 November 2025 I transferred ₦400,000.00 from my Access Bank account to the defendant's account"), naming the document that shows it ("a copy of my bank statement is attached"); (3) what the defendant promised or agreed; (4) every step taken to recover: complaints, calls, messages and the responses received; (5) the letter of demand from my solicitors, Pandas LP: its reference, the date and manner of service, and that it is attached; (6) that nothing has been paid; (7) a closing sentence seeking judgment for the sum claimed together with interest and costs. Use the figures exactly as in the CLAIM FIGURES. 200 to 350 words. Plain text, no heading, no signature, no date.

If anything in the material conflicts, add a line containing only PRACTITIONER NOTES after the summary, then the notes. Otherwise end after the summary.`
  }
  return `Write ONLY the lettered sub-paragraphs that complete paragraph 6 ("The indebtedness arose on account of:") of Form SCA 3B. Paragraphs 1 to 5 and 7, the heading, the parties and the jurat are filled in by the system: do not write any of them.

Lettered sub-paragraphs (a), (b), (c)… each on its own line, in the first person, one fact each, in date order:
- the arrangement with the defendant and what was agreed;
- each payment or the debt with its exact date, amount, method and reference, taken from the evidence;
- what the defendant promised or agreed (e.g. to refund);
- the demands, calls and messages, and the defendant's responses or silence;
- the letter of demand from my solicitors, Pandas LP: reference, date and manner of service, and that nothing has been paid;
- a sub-paragraph beginning "In support of this application, I rely on the following documents, which are exhibited:" listing each exhibit with the exact mark and description used in the EXHIBIT LIST already drafted (e.g. "Exhibit A: …"); if there is no exhibit list yet, mark the documents A, B, C… in date order;
- a sub-paragraph beginning "By reason of the foregoing, I claim against the Defendant:" with (i) the debt, (ii) the interest, using the INTEREST line from the CLAIM FIGURES, and (iii) the costs, using the COSTS line;
- a final sub-paragraph: "It will be in the interest of justice if this application is granted."
Plain text, no heading, no signature, no date.

If anything in the material conflicts, add a line containing only PRACTITIONER NOTES after the sub-paragraphs, then the notes. Otherwise end after the sub-paragraphs.`
}

// Splits the AI's reply into the narrative and any notes for the practitioner, and strips
// anything it should not have written (markdown, a repeated heading).
export function splitNarrative(text: string): { narrative: string; notes: string } {
  const clean = text
    .replace(/\r/g, '')
    .replace(/\*\*|__|^#+\s*/gm, '')
    .replace(/^\s*SUMMARISE YOUR COMPLAINT[^\n]*\n/i, '')
    .replace(/^\s*6\.\s*The indebtedness arose on account of[^\n]*\n/i, '')
    .trim()
  const at = clean.search(/^\s*PRACTITIONER NOTES\s*:?\s*$/m)
  if (at < 0) return { narrative: clean, notes: '' }
  return { narrative: clean.slice(0, at).trim(), notes: clean.slice(at).replace(/^\s*PRACTITIONER NOTES\s*:?\s*/i, '').trim() }
}

// The form, filled. `narrative` is the AI's text for SCA 2 and SCA 3B (ignored for the others).
export function fillLagosForm(kind: LagosFormKind, input: LagosFormInput, narrative = ''): string {
  const { facts } = input
  const c = facts.claimant
  const d = facts.defendant
  const fig = claimFigures(facts, input.filedAt ?? undefined)
  const claimNo = or(input.claimNumber)
  const between = `BETWEEN:\n${titleName(c)} ${DOTS} CLAIMANT\nAND\n${titleName(d)} ${DOTS} DEFENDANT`
  const sum = fig.sum > 0 ? fig.sum : 0

  if (kind === 'complaint') {
    return `FORM SCA 2
${COURT}
COMPLAINT FORM (TO ACCOMPANY FORM SCA 3)

NB: 1. Please fill out the form legibly.
2. Attach copies of the documents (contracts, receipts, expert's report if applicable) etc. upon which the claim is based.
3. Submit this form to the Registry of Small Claims.

A. PARTICULARS OF CLAIMANT(S)
FULL NAME: ${or(c?.name)}
WORK ADDRESS: ${or(c?.workAddress)}
RESIDENTIAL ADDRESS: ${or(c?.residentialAddress)}
TELEPHONE NO.(S) & E-MAIL ADDRESS: ${contact(c, input.clientPhone, input.clientEmail)}
Attach a list of other Claimant(s) (if more than one) with the required particulars.

B. PARTICULARS OF DEFENDANT(S)
FULL NAME: ${or(d?.name)}
WORK ADDRESS: ${or(d?.workAddress)}
RESIDENTIAL ADDRESS: ${or(d?.residentialAddress)}
TELEPHONE NO.(S) & E-MAIL ADDRESS: ${contact(d, input.debtorPhone)}

C. PARTICULARS OF CLAIM(S)
TOTAL SUM CLAIMED: ${sum ? nairaWithWords(sum) : DOTS}
INTEREST: ${sum ? interestWording(fig) : DOTS}
COSTS: ${naira(fig.costs)}, being ${fig.costsNote}
OTHERS: ${DOTS}
Attach a list of other Defendant(s) (if more than one) with the required particulars.

SUMMARISE YOUR COMPLAINT AND STATE THE STEPS YOU HAVE TAKEN TO RECOVER THE CLAIM:
${narrative.trim() || LONG_DOTS}

${DOTS}${DOTS}          ${DOTS}
CLAIMANT'S SIGNATURE/ THUMB PRINT                 DATE

FORM OF JURAT (If applicable)
Where the Commissioner has read the Affidavit to the Deponent.
SWORN at ${LONG_DOTS}
This ………… day of ………… before me, I have first truly distinctly and audibly read over the contents of this affidavit to the deponent who is blind (or illiterate) and explained the nature and contents of the exhibits therein referred to in the ${DOTS} language when he appeared perfectly to understand the same and made his mark (or signature) thereto in my presence.

${DOTS}${DOTS}
COMMISSIONER FOR OATHS`
  }

  if (kind === 'summons') {
    const h = hearing(input.firstHearingAt)
    const addr = serviceAddress(d).split(/,\s*/).filter(Boolean)
    return `FORM SCA 3
${COURT}
SUMMONS
(TO BE SERVED ON THE DEFENDANT WITHIN 7 DAYS OF FILING)

CLAIM NO: ${claimNo}

${between}

The Claimant claims:
Debt (particulars are attached): ${sum ? naira(sum) : DOTS}
Court Fees: ${DOTS}
Costs: ${naira(fig.costs)}
Total: ₦${DOTS}

To: ${or(d?.name)}
${addr.length ? addr.join(',\n') : DOTS}

1. You are hereby summoned to appear personally before this Court on the ${h.day} day of ${h.month} 20${h.year} at ${h.time} to admit or deny your liability for the above-mentioned claim.
2. If you admit or deny liability, or have a counterclaim, you are advised to complete and return Form SCA 5 to the Registry of the Small Claims Court within 7 days after the service of this Summons, including the day of service. If you require a longer time for payment, you should still complete the form of ADMISSION as in Form SCA 5.
3. (a) Take Notice that if you fail to appear in Court on the hearing date after a Summons has been served on you, judgment may be obtained against you by the Claimant.
(b) Money payable in terms of a judgment or Order of Court may be paid directly to the Judgment Creditor.
(c) The Judgment Debtor shall notify the Judgment Creditor fully and correctly within 7 days after he has changed his place of work, employment, or residence.

Dated at ${DOTS} this ………… day of ………… 20……

REGISTRAR OF COURT`
  }

  if (kind === 'summary_judgment') {
    const h = hearing(input.firstHearingAt)
    return `FORM SCA 3A
${COURT}
SUMMARY JUDGMENT
(TO BE SERVED ON THE DEFENDANT WITHIN 7 DAYS OF FILING)

CLAIM NO: ${claimNo}

${between}

APPLICATION FOR SUMMARY JUDGMENT

TAKE NOTICE that this Honourable Court shall be moved on the ${h.day} day of ${h.month} 20${h.year} at 9 O'clock in the forenoon or so soon thereafter as the Claimant may be heard praying for an Order:
1. Entering Summary Judgment against the Defendant in the sum of [${sum ? naira(sum) : '₦' + DOTS}] plus interest and costs.
2. And for such order(s) the Court may deem fit to make.

Dated this ………… day of ………… 20……

${DOTS}${DOTS}
CLAIMANT'S SIGNATURE
ADDRESS: ${or(val(c?.residentialAddress) || val(c?.workAddress))}
TELEPHONE NO: ${or(val(c?.phone) || val(input.clientPhone))}
E-MAIL: ${or(val(c?.email) || val(input.clientEmail))}

FOR SERVICE ON
DEFENDANT'S NAME: ${or(d?.name)}
ADDRESS: ${serviceAddress(d)}
TELEPHONE NO: ${or(val(d?.phone) || val(input.debtorPhone))}
E-MAIL: ${or(d?.email)}`
  }

  // sj_affidavit — SCA 3B
  const district = val(input.registry).toUpperCase()
  return `FORM SCA 3B
${COURT}
IN THE ${district || DOTS} MAGISTERIAL DISTRICT
HOLDEN AT ${district || DOTS}

CLAIM NO: ${claimNo}

${between}

AFFIDAVIT IN SUPPORT OF APPLICATION FOR SUMMARY JUDGMENT

I, [${or(c?.name)}] of [${or(val(c?.residentialAddress) || val(c?.workAddress))}] Lagos State do hereby make an oath and state as follows.
1. I am the Claimant in this case.
2. The Defendant is indebted to me in the sum of [${sum ? naira(sum) : '₦' + DOTS}] and I verily believe that the Defendant has no defence whatsoever to my claim.
3. Notwithstanding the issuance of a Letter of Demand, Defendant failed to liquidate his indebtedness to me.
4. I have also issued a Complaint Form and caused a Summons to be issued against the Defendant.
5. Notwithstanding the service of the foregoing on the Defendant, he has failed to liquidate his indebtedness to me.
6. The indebtedness arose on account of:
${narrative.trim() || LONG_DOTS}
7. I depose to this Affidavit conscientiously, believing all the depositions contained here to be true and correct by the Oaths Law of Lagos State.

${DOTS}${DOTS}
DEPONENT

SWORN TO AT THE MAGISTRATES' COURT OF LAGOS STATE, (SMALL CLAIMS) REGISTRY THIS ………… DAY OF ………… 20……

BEFORE ME

COMMISSIONER FOR OATHS

FORM OF JURAT (If applicable)
Where the Commissioner has read the Affidavit to the Deponent.
SWORN at ${DOTS} in ${DOTS} this ………… day of ………… before me,
I have first truly distinctly and audibly read over the contents of this affidavit to the deponent who is blind (or illiterate) and explained the nature and contents of the exhibits therein referred to in the ${DOTS} language when he appeared perfectly to understand the same and made his mark (or signature) thereto in my presence.

${DOTS}${DOTS}
COMMISSIONER FOR OATHS`
}

// The printed lines every filled form must still contain, word for word.
export const LAGOS_FIXED_LINES: Record<LagosFormKind, string[]> = {
  complaint: [
    'FORM SCA 2', COURT, 'COMPLAINT FORM (TO ACCOMPANY FORM SCA 3)',
    'A. PARTICULARS OF CLAIMANT(S)', 'B. PARTICULARS OF DEFENDANT(S)', 'C. PARTICULARS OF CLAIM(S)',
    'TOTAL SUM CLAIMED:', 'INTEREST:', 'COSTS:', 'OTHERS:',
    'SUMMARISE YOUR COMPLAINT AND STATE THE STEPS YOU HAVE TAKEN TO RECOVER THE CLAIM:',
    "CLAIMANT'S SIGNATURE/ THUMB PRINT", 'FORM OF JURAT (If applicable)',
  ],
  summons: [
    'FORM SCA 3', COURT, 'SUMMONS', '(TO BE SERVED ON THE DEFENDANT WITHIN 7 DAYS OF FILING)',
    'The Claimant claims:', 'Debt (particulars are attached):', 'Court Fees:', 'Costs:', 'Total: ₦',
    'to admit or deny your liability for the above-mentioned claim.', 'REGISTRAR OF COURT',
  ],
  summary_judgment: [
    'FORM SCA 3A', COURT, 'SUMMARY JUDGMENT', 'APPLICATION FOR SUMMARY JUDGMENT',
    "at 9 O'clock in the forenoon or so soon thereafter as the Claimant may be heard praying for an Order:",
    '2. And for such order(s) the Court may deem fit to make.', "CLAIMANT'S SIGNATURE", 'FOR SERVICE ON',
  ],
  sj_affidavit: [
    'FORM SCA 3B', COURT, 'AFFIDAVIT IN SUPPORT OF APPLICATION FOR SUMMARY JUDGMENT',
    '1. I am the Claimant in this case.',
    '3. Notwithstanding the issuance of a Letter of Demand, Defendant failed to liquidate his indebtedness to me.',
    '6. The indebtedness arose on account of:', 'DEPONENT', 'BEFORE ME', 'COMMISSIONER FOR OATHS',
  ],
}

