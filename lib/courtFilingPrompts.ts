// Instructions for the AI drafts in the Court filing tab. The form layouts follow the Small
// Claims Practice Direction 2023 (Forms 1 to 9A); the Lagos filing pack (SCA 1, 2, 3, 3A, 3B, the
// Section 84 certificate and the exhibit list) follows the printed Lagos forms as filed in a 2025
// claim, and the house style from the firm's own corrections to its first generated pack
// (Suliyat v Funsimfol, October 2026): dotted lines for unknown particulars, party names in
// capitals, money with kobo and in words, one set of exhibit marks across the pack, lettered
// sub-paragraphs in the affidavit. Every draft is checked, completed, dated and signed by a
// practitioner before anything is filed; the model never dates a document.

import { formLabel, rulesFor, type DocKind } from './courtFiling'
import { DELTA_SCC1_TEMPLATE, DELTA_SCC9_TEMPLATE, DELTA_SCC9A_TEMPLATE } from './deltaForms'

const DOTS = '……………………………'
const BLANK_DATE = '……day of……………20……'

export function courtFilingSystem(state: string): string {
  const r = rulesFor(state)
  const f = (n: number | string) => formLabel(state, n)
  const pack = r.summaryJudgment
    ? `${f(1)} (the letter of demand, filled from the demand already served), ${f(2)} (the complaint form, with the claimant's passport photograph, signed or thumb-printed), ${f(3)} (the summons, completed by the claimant and issued by the registry), ${f('3A')} (application for summary judgment) with ${f('3B')} (affidavit in support, sworn before the Commissioner for Oaths at the registry), copies of every document the claim relies on as exhibits, and a certificate of identification under section 84 of the Evidence Act 2011 for every document printed from a phone or computer (e-mails, e-receipts, bank statements, messages)`
    : `${f(1)} (the letter of demand, filled from the demand already served), ${f(2)} (the complaint form, signed or thumb-printed), ${f(3)} (the summons particulars), copies of every document the claim relies on as exhibits, and a certificate of identification under section 84 of the Evidence Act 2011 for every document printed from a phone or computer`
  return `You assist a Nigerian law firm, Pandas LP, with Small Claims Court proceedings in ${r.name} State. You prepare drafts for a licensed legal practitioner to check, complete and sign. You never file anything.

THE PRACTICE DIRECTION (Small Claims 2023) — apply it exactly:
- Art. 2: a claim may be brought where a claimant or defendant resides or carries on business in the state, or the cause of action arose there; it must be a liquidated money demand not exceeding ₦${r.claimLimit.toLocaleString()} excluding interest and costs; and the claimant must already have served a letter of demand. The firm serves its own demand letter first; ${f(1)} is filled in at filing from that demand. The action starts with the Complaint Form (${f(2)}); the summons (${f(3)}) issues once the registrar is satisfied.
- THE FILING PACK, filed together at the registry: ${pack}. The registry stamps and paginates the bundle with the claim number and assesses the fees.
- Art. 5: the court bailiff serves the summons${r.summaryJudgment ? `, the complaint form and the summary judgment application` : ''} within 7 days of filing and files an affidavit of service (${f(6)})${r.affidavitOfServiceDays ? ` within ${r.affidavitOfServiceDays} days of service` : ''} or of non-service (${f(4)}). If service fails, the claimant applies for substituted service by motion ex parte (${f(7)}); substituted service may be by pasting at the last known address, registered post, or verified e-mail, WhatsApp, Instagram, Facebook, Telegram or similar; SMS is for hearing notices only. The application needs an affidavit confirming the defendant's identity, addresses, phone numbers and electronic accounts, and may attach previous correspondence as proof the address or account is the defendant's.
- Art. 6–7: the defendant files a defence, admission or counterclaim (${f(5)}) within 7 days of service, including the day of service; a defendant who files nothing may be held to have admitted the claim. The claimant may reply within 5 days of service of the defence and counterclaim; no pleadings after reply.
- Art. 8: if the claimant appears and the defendant does not, with proof of service, the court hears the claim and enters judgment as far as the claimant proves it.
- Art. 9: at the first appearance the court refers the parties to mediation (Multi-Door Courthouse) for up to 7 days; settlement can be entered as a consent judgment; otherwise a preliminary hearing gives directions (timetable, witness lists, evidence, narrowing the issues); hearing runs day to day, one adjournment at most, concluded within 30 days of the first hearing.
- Art. 10–11: parties may represent themselves; a partner, company secretary or principal officer represents a firm or company. Parties testify, tender documents and may call witnesses.
- Art. 12–13: judgment within 14 days of the end of hearing; whole proceeding not more than 60 working days. Unpaid judgments are enforced like Magistrates' Court money orders; a garnishee order is sought by motion ex parte (${f(9)}) with an affidavit (${f('9A')}) giving the judgment debtor's name and address, the judgment and amount still due, any unpaid instalments, the garnishee's name and address and, for a bank, the branch and account number (or confirmation to the best of the creditor's belief that the garnishee is within jurisdiction and holds the debtor's money), anyone else claiming the money, and any other garnishee applications for the same debt.
- Art. 14: appeal by ${f(8)} within 14 days of judgment.

HOW TO READ THE LAYOUTS:
- Text inside «…» is an instruction to you. Replace the whole «…», brackets included, with what it describes. Never copy «…» or any of the words inside it into the draft.
- Everything outside «…» is printed form wording: reproduce it exactly, in the same order.

THE MATERIAL, IN ORDER OF AUTHORITY:
1. PARTIES — the particulars to use on every form, exactly as given.
2. CLAIM FIGURES — the sum, interest, costs and total, worked out by the system. Copy them exactly; never recalculate, round or restate them differently. Follow any NOTE FOR THE DRAFTER, but never copy it.
3. EVIDENCE ON FILE — the documents. A LAWYER'S NOTE is authoritative. Take every date, amount, account name and number and reference from the evidence, exactly as it shows them (e.g. each transfer on its own date for its own amount), and name the document that shows each fact.
4. FORMS ALREADY DRAFTED — keep consistent with them (exhibit marks, wording of the particulars).
5. The interview, the served demand letter and the filing record.
Where the material conflicts, follow the higher item, and add a short note for the practitioner at the very end of the draft, under the heading PRACTITIONER NOTES, saying what differs (for example a payee name on a bank statement that differs from the defendant's name). Omit that heading when there is nothing to note.

HOUSE STYLE FOR EVERY DRAFT:
- Use only facts in the material. Never invent a name, address, amount, date, document, account number or event.
- A particular that is not known (a "(not known)" in PARTIES) is left as a dotted line "${DOTS}" — never "Not known" and never a bracketed placeholder. Use a bracketed placeholder in capitals only for something the practitioner must supply that is not a party's particular, e.g. [MAKE, MODEL AND SERIAL NUMBER].
- Telephone and e-mail on one line: "+2348012345678; e-mail: name@example.com", with a dotted line for whichever is not known.
- A company defendant is named as in PARTIES; if a contact person is known, add "(Attention: Mr …)" after the name on the TO and FOR SERVICE lines only.
- In the BETWEEN block of every form, write both party names in CAPITALS.
- Money: always with the naira sign and kobo, e.g. ₦600,000.00. Where a layout asks for the amount in words, give it in brackets, e.g. ₦600,000.00 (Six Hundred Thousand Naira).
- Dates of past events in words, e.g. 3 November 2025. Never write a date for the document itself: leave the form's own date lines exactly as printed ("${BLANK_DATE}").
- The claimant signs ${f(1)}, ${f(2)}${r.summaryJudgment ? `, ${f('3A')}, ${f('3B')}` : ''} and the Section 84 certificate personally, so write them in the claimant's own voice ("I"), never as the firm. The firm may be mentioned as "my solicitors, Pandas LP".
- Every form opens with its own heading as the layout shows; the court heading is "${r.courtHeading}". The person suing is the ${r.party === 'CLAIMANT' ? 'Claimant' : 'Plaintiff'}.
- Plain text only: no markdown, no asterisks, no # headings. Headings in capitals on their own lines. Labels in capitals followed by a colon (e.g. WORK ADDRESS:).
- Plain, formal Nigerian legal English. Accurate and complete; no padding.`
}

// The parties block every form opens with.
function title(s: string): string {
  const r = rulesFor(s)
  return `CLAIM NO: ${DOTS}

BETWEEN:
«CLAIMANT'S FULL NAME IN CAPITALS» ${DOTS} ${r.party}
AND
«DEFENDANT'S FULL NAME IN CAPITALS, without any Attention line» ${DOTS} DEFENDANT`
}

const LAYOUTS: Record<Exclude<DocKind, 'facts'>, (state: string) => string> = {
  demand_form: (s) => s === 'delta' ? `Fill in the LETTER OF DEMAND, Form SCC 1, exactly as prescribed by the Delta State Practice Direction on Small Claims 2023. It records the demand served on the defendant: the same sum and particulars, in the claimant's own voice. Reproduce this layout word for word; change only what is inside «», and keep "SIR/MADAM" as printed:

${DELTA_SCC1_TEMPLATE}` : `Fill in the LETTER OF DEMAND form (${formLabel(s, 1)}) for filing. It records the demand the firm already served: the same sum and particulars, now in the claimant's own voice. Reproduce this layout:

${formLabel(s, 1).toUpperCase()}
SMALL CLAIMS COURT
LETTER OF DEMAND

FROM: «claimant's full name»
WORK ADDRESS: «or a dotted line»
RESIDENTIAL ADDRESS: «or a dotted line»
TELEPHONE NO(S) AND E-MAIL: «phone; e-mail»

TO: «defendant's full name, with "(Attention: …)" if a contact person is known»
WORK ADDRESS: «or a dotted line»
RESIDENTIAL ADDRESS: «or a dotted line»
TELEPHONE NO(S) AND E-MAIL: «phone; e-mail»

«"SIR," if the addressee is a named man, "MADAM," if a named woman, otherwise "SIR/MADAM,"»

DEMAND:
I hereby claim from you the sum of «the SUM CLAIMED from the CLAIM FIGURES, figures then words in brackets», being «one complete sentence of particulars: what the money was for, when it was paid or fell due, and the defendant's promise and failure — for example "the balance of the loan of ₦300,000.00 I made to you on 18 May 2022, which you undertook to repay by 19 May 2022 but have failed and refused to pay despite my repeated demands"».

Unless you comply with this demand within fourteen (14) days after receipt of this letter, summons will be issued against you in the Small Claims Court.

${DOTS}${DOTS}
${rulesFor(s).party}'S SIGNATURE`,

  complaint: (s) => {
    const P = rulesFor(s).party
    const Pc = P[0] + P.slice(1).toLowerCase()
    return `Fill in the COMPLAINT FORM (${formLabel(s, 2)}). Reproduce this layout exactly:

${formLabel(s, 2).toUpperCase()}
${rulesFor(s).courtHeading}
COMPLAINT FORM (TO ACCOMPANY ${formLabel(s, 3).toUpperCase()})

NB: 1. Please fill out the form legibly.
2. Attach copies of the documents (contracts, receipts, expert's report if applicable) etc. upon which the claim is based.
3. Submit this form to the Registry of Small Claims.

A. PARTICULARS OF ${P}(S)
FULL NAME: «»
WORK ADDRESS: «»
RESIDENTIAL ADDRESS: «»
TELEPHONE NO.(S) & E-MAIL ADDRESS: «phone; e-mail: …»
Attach a list of other ${Pc}(s) (if more than one) with the required particulars.

B. PARTICULARS OF DEFENDANT(S)
FULL NAME: «»
WORK ADDRESS: «»
RESIDENTIAL ADDRESS: «»
TELEPHONE NO.(S) & E-MAIL ADDRESS: «phone; e-mail: …»

C. PARTICULARS OF CLAIM(S)
TOTAL SUM CLAIMED: «the SUM CLAIMED figure only, without the words»
INTEREST: «the INTEREST line from the CLAIM FIGURES, word for word»
COSTS: «the COSTS line from the CLAIM FIGURES, word for word»
TOTAL: «the TOTAL line from the CLAIM FIGURES, word for word»
Attach a list of other Defendant(s) (if more than one) with the required particulars.

SUMMARISE YOUR COMPLAINT AND STATE THE STEPS YOU HAVE TAKEN TO RECOVER THE CLAIM:
«Short first-person paragraphs, as the ${P.toLowerCase()} would tell it, in this order: (1) who the defendant is and what was agreed; (2) every payment or the debt, each with its exact date, amount and how it was paid, taken from the evidence (e.g. "On 3 November 2025 I transferred ₦400,000.00 and ₦100,000.00 from my Access Bank account to the defendant's account, and on 6 November 2025 a further ₦100,000.00"), naming the document that shows it ("a copy of my bank statement is attached"); (3) what the defendant promised or agreed; (4) every step taken to recover — complaints, calls, messages, the responses received; (5) the firm's letter of demand: its reference, the date and manner of service, and that it is attached; (6) that nothing has been paid; (7) the costs incurred, ending with a sentence seeking judgment for the sum claimed together with interest and costs. 200–350 words.»

${DOTS}${DOTS}          ${DOTS}
${P}'S SIGNATURE / THUMB PRINT                 DATE

«Only if the material says the ${P.toLowerCase()} is blind or cannot read, add the form's jurat: "FORM OF JURAT (If applicable)" with its printed wording. Otherwise add nothing here.»`
  },

  summons: (s) => {
    const r = rulesFor(s)
    const P = r.party[0] + r.party.slice(1).toLowerCase()
    return `Fill in the SUMMONS (${formLabel(s, 3)}). The claimant completes it and the registry issues it: leave the claim number, court fees, hearing date and "Dated at" lines blank as printed. Reproduce this layout:

${formLabel(s, 3).toUpperCase()}
${r.courtHeading}
SUMMONS
(TO BE SERVED ON THE DEFENDANT WITHIN 7 DAYS OF FILING)

${title(s)}

The ${P} claims: «the debt figure» (the debt) with «if the CLAIM FIGURES state an interest amount: "interest amounting to ₦…"; otherwise: "interest at …% per annum from the date the sum fell due until judgment"», and costs.
Debt (particulars are attached): «the debt figure» being «the same particulars as Form ${formLabel(s, 1).replace(/^Form /, '')}'s demand, in the third person (the Claimant / the Defendant)».
Court Fees: ${DOTS}
Costs: «the COSTS line from the CLAIM FIGURES».
Total: «the TOTAL line from the CLAIM FIGURES, word for word».

To: «defendant's full name, with "(Attention: …)" if a contact person is known»
«the defendant's address for service — the work address for a company — over as many short lines as it needs»

1. You are hereby summoned to appear personally before this Court on the ${BLANK_DATE} at ………… to admit or deny your liability for the above-mentioned claim.
2. If you admit or deny liability, or have a counterclaim, you are advised to complete and return ${formLabel(s, 5)} to the Registry of the Small Claims Court within 7 days after the service of this Summons, including the day of service. If you require a longer time for payment, you should still complete the form of ADMISSION as in ${formLabel(s, 5)}.
3. (a) Take Notice that if you fail to appear in Court on the hearing date after a Summons has been served on you, judgment may be obtained against you by the ${P}.
(b) Money payable in terms of a judgment or Order of Court may be paid directly to the Judgment Creditor.
(c) The Judgment Debtor shall notify the Judgment Creditor fully and correctly within 7 days after he has changed his place of work, employment, or residence.

Dated at ${DOTS} this ${BLANK_DATE}`
  },

  summary_judgment: (s) => `Fill in the APPLICATION FOR SUMMARY JUDGMENT (${formLabel(s, '3A')}), filed with the complaint and summons. Reproduce this layout:

${formLabel(s, '3A').toUpperCase()}
${rulesFor(s).courtHeading}
SUMMARY JUDGMENT
(TO BE SERVED ON THE DEFENDANT WITHIN 7 DAYS OF FILING)

${title(s)}

APPLICATION FOR SUMMARY JUDGMENT

TAKE NOTICE that this Honourable Court shall be moved on the ${BLANK_DATE} at 9 O'clock in the forenoon or so soon thereafter as the Claimant may be heard praying for an Order:
1. Entering Summary Judgment against the Defendant in the sum of «the SUM CLAIMED from the CLAIM FIGURES, figures then words in brackets — the debt only» plus interest and costs.
2. And for such order(s) the Court may deem fit to make.

Dated this ${BLANK_DATE}

${DOTS}${DOTS}
CLAIMANT'S SIGNATURE
ADDRESS: «claimant's residential address, or work address if that is the only one known»
TELEPHONE NO: «claimant's phone, or a dotted line»
E-MAIL: «claimant's e-mail, or a dotted line»

FOR SERVICE ON
DEFENDANT'S NAME: «with "(Attention: …)" if a contact person is known»
ADDRESS: «defendant's address for service»
TELEPHONE NO: «defendant's phone, or a dotted line»
E-MAIL: «defendant's e-mail, or a dotted line»`,

  sj_affidavit: (s) => {
    const r = rulesFor(s)
    const st = r.name === 'Other state' ? '[STATE]' : r.name
    return `Fill in the AFFIDAVIT IN SUPPORT OF APPLICATION FOR SUMMARY JUDGMENT (${formLabel(s, '3B')}), sworn by the claimant before the Commissioner for Oaths at the registry. Keep paragraphs 1 to 5 and 7 word for word. Reproduce this layout:

${formLabel(s, '3B').toUpperCase()}
${r.courtHeading}
IN THE «the magisterial district from the Registry recorded in the material, in capitals (e.g. IKEJA); a dotted line if none» MAGISTERIAL DISTRICT
HOLDEN AT «the same place in capitals, or a dotted line»

${title(s)}

AFFIDAVIT IN SUPPORT OF APPLICATION FOR SUMMARY JUDGMENT

I, «claimant's full name» of «claimant's residential address», ${st} State do hereby make an oath and state as follows:
1. I am the Claimant in this case.
2. The Defendant is indebted to me in the sum of «the SUM CLAIMED figure» and I verily believe that the Defendant has no defence whatsoever to my claim.
3. Notwithstanding the issuance of a Letter of Demand, Defendant failed to liquidate his indebtedness to me.
4. I have also issued a Complaint Form and caused a Summons to be issued against the Defendant.
5. Notwithstanding the service of the foregoing on the Defendant, he has failed to liquidate his indebtedness to me.
6. The indebtedness arose on account of the following:
«Lettered sub-paragraphs (a), (b), (c)… in the first person, one fact each, in date order:
- the arrangement with the defendant and what was agreed;
- each payment or the debt with its exact date, amount, method and reference, taken from the evidence;
- what the defendant promised or agreed (e.g. to refund);
- the demands, calls and messages, and the defendant's responses or silence;
- the firm's letter of demand: reference, date and manner of service, and that nothing has been paid;
- a sub-paragraph beginning "In support of this application, I rely on the following documents, which are exhibited:" listing each exhibit with the exact mark and description used in the EXHIBIT LIST already drafted (e.g. "Exhibit A: …"); if there is no exhibit list yet, mark the documents A, B, C… in date order;
- a sub-paragraph beginning "By reason of the foregoing, I claim against the Defendant:" with (i) the debt, (ii) the interest, using the INTEREST line from the CLAIM FIGURES, and (iii) the costs, using the COSTS line.»
It will be in the interest of justice if this application is granted.
7. I depose to this Affidavit conscientiously, believing all the depositions contained here to be true and correct by the Oaths Law of ${st} State.

${DOTS}${DOTS}
DEPONENT

SWORN TO AT THE ${r.courtHeading.replace(/^IN THE /, '')} REGISTRY THIS ${BLANK_DATE}

BEFORE ME

${DOTS}${DOTS}
COMMISSIONER FOR OATHS`
  },

  s84_certificate: (s) => `Draft the CERTIFICATE OF IDENTIFICATION IN COMPLIANCE WITH SECTION 84 OF THE EVIDENCE ACT 2011 (AS AMENDED), which accompanies every exhibit printed from a phone or computer. It is given by the person who printed the documents: the claimant unless the material says otherwise. Reproduce this layout:

${rulesFor(s).courtHeading}

CERTIFICATE OF IDENTIFICATION IN COMPLIANCE WITH SECTION 84 OF THE EVIDENCE ACT 2011 (AS AMENDED)

I, «name of the person who printed the documents», «their role, e.g. the Claimant», hereby state that I printed the following documents using the electronic device, the particulars of which are contained in the schedule hereunder:
«a numbered list of every exhibit printed from a phone or computer, each with its exhibit mark from the EXHIBIT LIST and enough detail to identify it — e.g. "1. Exhibit A — Statement of account of Access Bank account no. 1709035131 in the name of the Claimant for 1 January to 31 December 2025, showing the transfers to the Defendant of 3 and 6 November 2025". Include only documents that exist in the evidence.»

I also certify as follows:
a.) That the contents of the document attached to this certificate emanated from the electronic device described in the schedule hereunder.
b.) That the document was produced by the afore-described electronic device during a period over which the said computer was used regularly to store or process data and information for the purposes of activities regularly carried on over that period.
c.) That over that period there was regularly supplied to the afore-described computer in the ordinary course of those activities, information of the kind contained in the statement or of the kind from which the information so contained is derived.
d.) That throughout the material part of that period the afore-described computer was operating properly or, if not, that in any respect in which it was not operating properly or out of operation during that part of that period, it is not such as to affect the production of the document or the accuracy of its contents.
e.) That the information contained in the document reproduces or is derived from information supplied to the computer in the ordinary course of those activities.

SCHEDULE
DEVICE: «make, model and serial number from the practitioner's information, or [MAKE, MODEL AND SERIAL NUMBER]»
OPERATING SYSTEM: «from the practitioner's information, or [OPERATING SYSTEM, e.g. WINDOWS 11 / ANDROID 14]»
APPLICATION SOFTWARE: «from the practitioner's information, or [APPLICATION USED, e.g. BANKING APP / WEB BROWSER]»
PRINTER: «make, model and serial number, or [MAKE, MODEL AND SERIAL NUMBER]»

Dated ${BLANK_DATE}

${DOTS}${DOTS}
«name of the person who printed the documents»
«their role, e.g. Claimant»`,

  exhibits: (s) => `Prepare the EXHIBIT LIST AND BUNDLE ORDER. This is drafted first: every other form in the pack uses the exhibit marks you set here, so mark them carefully. Reproduce this layout:

${rulesFor(s).courtHeading}
«the registry in capitals followed by REGISTRY, e.g. "IKEJA REGISTRY", if the Registry is recorded; otherwise omit this line»

${title(s)}

EXHIBIT LIST AND BUNDLE ORDER

EXHIBIT LIST
«One entry for each document that exists in the EVIDENCE ON FILE or is described in the material (the firm's served letter of demand always exists). Mark them Exhibit A, B, C… in date order of the documents. Never create an exhibit for a document that is not there. Each entry in exactly this shape:
Exhibit A
Document: (what it is, e.g. "Statement of account of Access Bank account no. 1709035131 (Claimant), 1 January to 31 December 2025")
Date or reference: (the exact dates, amounts and references the document shows, e.g. each transfer on its own line)
What it proves: (one sentence)
Section 84: ("Covered — printed from a phone or computer" or "Not needed — physical document", from the lawyer's note where given)»

DOCUMENTS STILL TO OBTAIN
«Documents the claim would benefit from that are not on file (e.g. a written proof of service of the demand letter, the agreement, receipts), one line each with why. Omit this heading if there are none.»

SECTION 84 CERTIFICATE
«One short paragraph: which exhibits it must cover, by mark, and that it is signed by whoever printed them.»

BUNDLE ORDER
The registry will stamp and paginate the entire bundle with the claim number. Present the documents in this order:
«a numbered list: ${formLabel(s, 2)} (with the claimant's passport photograph and signature); each exhibit by mark and short name, in order; the Section 84 certificate; ${formLabel(s, 1)}; ${formLabel(s, 3)}${rulesFor(s).summaryJudgment ? `; ${formLabel(s, '3A')}; ${formLabel(s, '3B')} (to be sworn before the Commissioner for Oaths at the registry)` : ''}»`,


  substituted_service: (s) => `Draft the MOTION EX PARTE for SUBSTITUTED SERVICE (${formLabel(s, 7)}) and the SUPPORTING AFFIDAVIT required by Art. 5(7)(i). Layout:

${formLabel(s, 7).toUpperCase()}
${rulesFor(s).courtHeading}
IN THE ……………………… MAGISTERIAL DISTRICT
HOLDEN AT ………………………
CLAIM NO: [CLAIM NUMBER]
BETWEEN: ... PLAINTIFF/APPLICANT
AND: ... DEFENDANT/RESPONDENT
MOTION EX-PARTE
BROUGHT PURSUANT TO THE MAGISTRATES' COURT (CIVIL PROCEDURE) RULES AND UNDER THE INHERENT JURISDICTION OF THE COURT
TAKE NOTICE that the Honourable Court will be moved on the……day of……………20…… at 9 o'clock in the forenoon or so soon thereafter as the Claimant/Applicant may be heard, praying for:
An Order granting leave to serve the Summons on the Defendant by substituted means, to wit: (the means supported by the material — pasting at the last known address, and/or the defendant's verified e-mail / WhatsApp / other account, stating each).
AND FOR SUCH ORDER OR ORDERS as the Court may deem fit.
Dated……day of……………20……
……………………… Claimant's signature

Then: AFFIDAVIT IN SUPPORT, numbered paragraphs, deposed by [DEPONENT'S NAME], covering: who the deponent is; the claim and filing; that the bailiff was unable to serve (with the reason recorded); the defendant's identity, last known postal/physical address, e-mail, phone number(s), and the electronic accounts the defendant uses and how the deponent knows they are the defendant's (previous correspondence, attached as an exhibit if it exists); and a request for the order. End with the jurat ("Sworn to at the Small Claims Court Registry this……day of……………20…… Before Me, Commissioner for Oaths").`,

  reply: () => `Draft the CLAIMANT'S REPLY to the defendant's defence and/or counterclaim (Art. 7(6): to be filed within 5 days of service of the defence; no pleadings after reply). Take the defence summary provided, answer each point in numbered paragraphs, rely only on the facts and documents in the material, and where the defence raises something the material does not answer, write a bracketed note for the practitioner rather than inventing a response. If there is a counterclaim, deal with it under its own heading. Use the case title block (court, claim number, parties) at the top and a signature block at the end.`,

  hearing_pack: (s) => `Prepare a HEARING PACK for the practitioner and client, covering Art. 9–11:
1. CASE SUMMARY: the claim in five lines, and the sum claimed.
2. CLAIMANT'S STATEMENT: a first-person outline of the evidence the claimant (or the company's principal officer, Art. 10) will give, in the order it happened, each point tied to a document.
3. DOCUMENT BUNDLE INDEX: numbered list of documents to tender, each with what it proves.
4. WITNESS LIST: who can confirm what, from the material only; mark gaps.
5. ISSUES: what the defence disputes (if a defence was filed) and how the evidence answers it.
6. SETTLEMENT POSITION: points for mediation (Art. 9(1), up to 7 days), including instalment terms the client might accept, marked for the client's instructions.
7. CHECKLIST for the day: proof of service of the summons (${formLabel(s, 6)}), originals of documents, ID for the principal officer if a company.`,

  settlement: (s) => `Draft TERMS OF SETTLEMENT for the parties to sign and present to the court for a consent judgment (Art. 9(2)). Include: the case title (court, claim number, parties); the sum agreed in full and final settlement; payment terms (lump sum or instalments with amounts and frequency — use placeholders where the client has not instructed); what happens on default (the whole outstanding balance becomes due and the claimant may enforce); costs; that the parties ask the court to enter judgment on these terms; signature blocks for both parties and witnesses. ${rulesFor(s).name} Small Claims Court.`,

  garnishee: (s) => s === 'delta' ? `Fill in the GARNISHEE MOTION EX PARTE, Form SCC 9, and the AFFIDAVIT IN SUPPORT, Form SCC 9A, exactly as prescribed by the Delta State Practice Direction on Small Claims 2023 (Article 13(3)). The claimant is the judgment creditor, the defendant the judgment debtor, and the garnishee is the bank holding the judgment debtor's account: take its name, branch and account number from facts.debtorBank or the evidence (for example the bank statement showing the payment), and leave a dotted line for anything not shown. The judgment sum and date come from the filing record (judgment_sum, judgment_at); if either is missing, leave a dotted line. Reproduce both forms word for word, changing only what is inside «», with a line containing only ===PAGE BREAK=== between them:

${DELTA_SCC9_TEMPLATE}

===PAGE BREAK===

${DELTA_SCC9A_TEMPLATE}` : `Draft the GARNISHEE MOTION EX PARTE (${formLabel(s, 9)}) and the AFFIDAVIT IN SUPPORT (${formLabel(s, '9A')}), following these layouts:

${formLabel(s, 9).toUpperCase()}
${rulesFor(s).courtHeading}
IN THE ……………………… MAGISTERIAL DISTRICT
HOLDEN AT ………………………
CLAIM NO: [CLAIM NUMBER]
BETWEEN: [JUDGMENT CREDITOR] ... JUDGMENT CREDITOR
AND: [JUDGMENT DEBTOR] ... JUDGMENT DEBTOR
AND: [GARNISHEE] ... GARNISHEE(S)
MOTION EX-PARTE
SECTIONS 83 AND 84 OF THE SHERIFFS AND CIVIL PROCESS ACT AND ORDER IV RULE 1(2), ORDER VIII RULES 3(1), (2), 4, 5 AND 8 OF THE JUDGMENT (ENFORCEMENT) RULES AND UNDER THE INHERENT JURISDICTION OF THIS COURT
TAKE NOTICE that this Honourable Court shall be moved on the……day of……………20…… at 9 o'clock in the forenoon or so soon thereafter, praying for:
1. An Order attaching the funds standing to the credit of the judgment debtor in the custody of the garnishee(s) to the outstanding judgment sum of ₦... ("the judgment debt").
2. An Order directing the garnishee(s) to appear within fourteen (14) days of service of the order to show cause why an order should not be made for payment to the judgment creditor of the judgment debt or so much as will satisfy it.
3. An Order directing the garnishee(s) to disclose on oath, by affidavit filed within eight (8) days of service of the order, the funds standing to the credit of the judgment debtor as at the date of service.
And for such order or orders as the Court may deem fit.
Dated……day of……………20……
……………………… Judgment Creditor's signature

${formLabel(s, '9A').toUpperCase()} — AFFIDAVIT IN SUPPORT
Numbered paragraphs by the judgment creditor: (1) I am the judgment creditor; (2) the judgment debtor's name and address; (3) the date judgment was entered and the sum, and any instalments due and unpaid; (4) the garnishee's name and address and the funds held — for a bank, the branch and account number if known; (5) to the best of my knowledge or belief the garnishee is within jurisdiction and holds money to the credit of the judgment debtor; (6) no other person claims the money (or who does); (7) no other garnishee application for the same judgment debt; (8) the oath clause. Jurat: "SWORN TO at the Small Claims Court Registry ……… this……day of……………20…… BEFORE ME, COMMISSIONER FOR OATHS".`,
}

export function draftInstruction(kind: DocKind, state: string): string {
  if (kind === 'facts') {
    return `From the material, extract the facts the court forms need. Reply with ONLY a JSON object, no other text, in this shape (omit a field you cannot find; never guess):
{"claimant":{"name":"","workAddress":"","residentialAddress":"","phone":"","email":""},
 "defendant":{"name":"","workAddress":"","residentialAddress":"","phone":"","email":"","otherContacts":""},
 "amount":0,
 "dueDate":"",
 "particulars":"",
 "stepsTaken":"",
 "documents":[""],
 "causeOfActionState":"",
 "debtorBank":{"bank":"","branch":"","accountNumber":"","accountName":""}}
"amount" is the liquidated sum outstanding in naira as a number, excluding interest and costs. "dueDate" is the date the sum fell due for payment, as YYYY-MM-DD, only if the material states it (interest runs from it). Interest and costs are set by the firm, not extracted. "particulars" is one or two sentences on what the debt is for. "stepsTaken" lists recovery steps already taken, including the letter of demand. "documents" lists the documents that exist in the material, including those in EVIDENCE ON FILE. For a company, its registered or head office address is the workAddress, and a contact person goes in brackets after the name, e.g. "Acme Limited (Attention: Mr. John Bello)". Take phone numbers and e-mails from anywhere in the material, including the served demand letter and the evidence. Write "dueDate" only if the material states when payment fell due or was promised; never infer it. "debtorBank" is the bank account the claimant paid the money into (bank, branch, account number, account name), only as the material shows it, for example on a bank statement or transfer receipt; it is used to enforce a judgment against the debtor's bank.`
  }
  return LAYOUTS[kind](state)
}
