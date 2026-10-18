// Server-only. Drafts a brand borrower's demand letter with the EXISTING Small Claims agent in
// its staff ("lawyer intake") mode — the mode built for a Pandas LP lawyer relaying a client's
// facts. No new agent: the facts from the sheet row are relayed the same way a lawyer would,
// and the agent either drafts the letter or lists what it still needs under
// "OUTSTANDING QUESTIONS FOR YOUR CLIENT" (it is told never to guess a missing fact).

import { SMALL_CLAIMS_LAWYER_INTAKE_PROMPT } from './agents'
import { callClaude } from './claude'
import { instructionsFor } from './agentInstructions'
import { withDraftingInstructions } from './agentInstructionTargets'
import { buildCurrentDateContext } from './currentDateContext'
import { extractDocument, extractOutstandingQuestions, type DraftDocument } from './agentChatParsing'
import type { Borrower } from './brandRows'

export interface BrandForLetter {
  name: string
  address: string
  contactEmail: string
}

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** The message relayed to the agent, as a Pandas LP lawyer would describe the case. Pure. */
export function buildBrandFactsMessage(brand: BrandForLetter, borrower: Borrower, caseRef: string): string {
  const lines = [
    `Our client is ${brand.name} of ${brand.address}, a licensed lender. They have instructed Pandas LP to recover an unpaid loan from one of their borrowers. Everything below comes from the client's own loan records (their recovery sheet, client reference ${caseRef}).`,
    '',
    `- Debtor (the borrower): ${borrower.fullName}`,
    `- Debtor's address for service: ${borrower.addressForService}`,
    `- Debtor's phone: ${borrower.phone}`,
    `- Debtor's email: ${borrower.email}`,
    `- The loan: ${naira(borrower.loanAmount)}, disbursed to the debtor on ${longDate(borrower.loanDate)}.`,
    borrower.lastPaymentDate
      ? `- The debtor's last repayment was made on ${longDate(borrower.lastPaymentDate)}.`
      : '- The client has no record of any repayment by the debtor.',
    `- Amount now outstanding and due: ${naira(borrower.amountOutstanding)}.`,
    `- Evidence: the client holds the loan documents (loan agreement and repayment records), which are filed with Pandas LP under reference ${caseRef}.`,
    ...(borrower.notes ? [`- Additional notes from the client: ${borrower.notes}`] : []),
    '',
    `Delivery: Pandas LP will formally serve this letter on the debtor, so use Template B (the Pandas LP serves option).`,
    `The client's contact for this matter is ${brand.contactEmail}; no client phone number is needed for this matter.`,
    '',
    'Please draft the letter of demand for the outstanding sum now, in a single reply. If something essential to the letter is genuinely missing above, do not guess it — list it under OUTSTANDING QUESTIONS FOR YOUR CLIENT instead.',
  ]
  return lines.join('\n')
}

export type BrandDraftResult =
  | { ok: true; doc: DraftDocument }
  /** The agent needs more facts — these become the row's "Missing Documents" list. */
  | { ok: false; kind: 'needs_info'; questions: string[] }
  /** Something went wrong (API down, unparseable reply) — the row is retried on a later run. */
  | { ok: false; kind: 'error'; error: string }

export type BrandDrafter = (input: { brand: BrandForLetter; borrower: Borrower; caseRef: string; caseId: string | null }) => Promise<BrandDraftResult>

/** The real drafter: one call to Claude through lib/claude.ts (so cost is logged against the case). */
export const draftBrandLetter: BrandDrafter = async ({ brand, borrower, caseRef, caseId }) => {
  const result = await callClaude({
    route: 'brand.draft',
    // The agent's instructions are identical for every borrower, so they're one cached block;
    // today's date changes, so it comes after (see lib/claude.ts on caching). The lead lawyer's
    // small-claims drafting instructions (/manageai) end the cached block, as in /api/chat.
    system: [
      { text: withDraftingInstructions(SMALL_CLAIMS_LAWYER_INTAKE_PROMPT, await instructionsFor('small-claims')), cache: '1h' },
      { text: buildCurrentDateContext(new Date()) },
    ],
    messages: [{ role: 'user', content: buildBrandFactsMessage(brand, borrower, caseRef) }],
    maxTokens: 4096,
    caseId,
  })
  if (result.ok === false) return { ok: false, kind: 'error', error: result.error }

  const { doc } = extractDocument(result.text)
  if (doc) return { ok: true, doc }

  const questions = extractOutstandingQuestions(result.text)
  if (questions.length > 0) return { ok: false, kind: 'needs_info', questions }
  return { ok: false, kind: 'error', error: `The agent replied without a letter: ${result.text.slice(0, 300)}` }
}
