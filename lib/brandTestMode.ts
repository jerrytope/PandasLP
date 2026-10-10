// Server-only. Phase 5C of plans/phase-5-api-intake.md: the brand API's test mode (the sandbox).
//
// Borrowers sent with a TEST key are checked exactly like live ones (lib/brandApi.ts), but then
// nothing real happens: no AI call (a fixed SAMPLE letter instead), no lawyer, no serving, no
// email to anyone, no bill, nothing in the Action Queue. Instead they walk the whole journey on
// their own, one step per scheduled run (every 15 minutes) once 5 minutes have passed:
//
//   new → letter_drafted → lawyer_approved → served → day7_sent → day14_sent (awaiting decision) → closed
//
// Each step is logged the same way a real one is, so the database queues the same webhook
// (to the brand's TEST address). A developer who doesn't want to wait calls
// POST /borrowers/{id}/advance with the test key to take the next step at once.
//
// Live keys: a brand only gets one once its integration has passed with the test key
// (testModeProgress). Staff can override that with a written reason.

import { supabaseAdmin } from './supabaseAdmin'
import { checkBorrower } from './brandRows'
import { toSheetRow } from './brandApiInput'
import { buildTextDocumentBuffer } from './pdfGenerator.js'
import { CASE_FIELDS, logEvent, setStatus, type BrandCaseRecord } from './brandStore'
import type { BrandCaseStatus, BrandSheetHeader } from './brandSheet'

/** How long a test borrower stays on each step before the scheduled run moves it on. */
export const TEST_STEP_MS = 5 * 60_000

/** The next step of the test journey from each status (missing_documents waits for the brand). */
const NEXT_STEP: Partial<Record<BrandCaseStatus, BrandCaseStatus>> = {
  new: 'letter_drafted',
  letter_drafted: 'lawyer_approved',
  lawyer_approved: 'served',
  served: 'day7_sent',
  day7_sent: 'day14_sent',
  day14_sent: 'closed',
}

export type AdvanceResult = { ok: true; from: BrandCaseStatus; to: BrandCaseStatus } | { ok: false; reason: string }

/** Moves one test borrower one step on, logging it as the real step would be (so the webhook goes out). */
export async function advanceTestBorrower(c: BrandCaseRecord, now: Date): Promise<AdvanceResult> {
  if (!c.is_test) return { ok: false, reason: 'Only test borrowers move on by themselves.' }
  const to = NEXT_STEP[c.status]
  if (!to) {
    return {
      ok: false,
      reason: c.status === 'missing_documents' ? 'This borrower is waiting for missing documents: resend the loan or add a note.' : `The test journey has ended ("${c.status}").`,
    }
  }
  // Claimed first: only if nobody (another run, a resubmission, a note) touched it since it was
  // read. Every update changes updated_at (a database trigger), so of two callers only one wins.
  const { data: won } = await supabaseAdmin
    .from('brand_cases')
    .update({ claimed_at: now.toISOString() })
    .eq('id', c.id)
    .eq('status', c.status)
    .eq('updated_at', c.updated_at)
    .select('id')
  if (!won?.length) return { ok: false, reason: 'This borrower has just moved on. Fetch it again.' }

  const from = c.status
  const at = now.toISOString()
  if (from === 'new') {
    // The same checks as a live borrower gets before drafting.
    const checked = checkBorrower(toSheetRow((c.borrower ?? {}) as Record<BrandSheetHeader, string>), { documentsStored: true })
    const missing = checked.ok === false ? [...checked.missing] : []
    const { count } = await supabaseAdmin.from('brand_case_documents').select('id', { count: 'exact', head: true }).eq('brand_case_id', c.id)
    if (!count) missing.push('Documents (send at least one: the loan agreement or statement)')
    if (missing.length) {
      await setStatus(c, 'missing_documents', { missing_items: missing, claimed_at: null })
      await logEvent(c, 'missing_documents', { missing, test: true })
      return { ok: true, from, to: 'missing_documents' }
    }
    await setStatus(c, 'letter_drafted', { last_error: null })
  } else if (from === 'letter_drafted') {
    // Never billable: billable_at stays empty, so billing can't pick it up.
    await setStatus(c, 'lawyer_approved')
    await logEvent(c, 'lawyer_approved', { reviewer: 'test mode', billable: false, test: true })
  } else if (from === 'lawyer_approved') {
    await setStatus(c, 'served', { served_at: at })
  } else if (from === 'served') {
    await setStatus(c, 'day7_sent', { day7_sent_at: at })
  } else if (from === 'day7_sent') {
    await setStatus(c, 'day14_sent', { day14_sent_at: at, awaiting_brand_decision_at: at })
    await logEvent(c, 'awaiting_brand_decision', { test: true })
  } else if (from === 'day14_sent') {
    await setStatus(c, 'closed')
    await logEvent(c, 'outcome', { outcome: 'closed', note: 'Test journey finished.', test: true })
  }
  return { ok: true, from, to }
}

/** The scheduled run: every test borrower that has waited long enough takes its next step (optionally one brand's). */
export async function advanceTestBorrowers(now = new Date(), brandId?: string): Promise<{ advanced: number }> {
  let q = supabaseAdmin
    .from('brand_cases')
    .select(CASE_FIELDS)
    .eq('is_test', true)
    .eq('source', 'api')
    .in('status', Object.keys(NEXT_STEP))
    .lte('updated_at', new Date(now.getTime() - TEST_STEP_MS).toISOString())
    .order('updated_at', { ascending: true })
    .limit(200)
  if (brandId) q = q.eq('brand_id', brandId)
  const { data } = await q
  let advanced = 0
  for (const c of (data ?? []) as BrandCaseRecord[]) {
    try {
      if ((await advanceTestBorrower(c, now)).ok) advanced++
    } catch (err) {
      console.error(`Test borrower ${c.case_ref} could not move on:`, err)
    }
  }
  return { advanced }
}

/** The fixed SAMPLE letter a test borrower gets instead of an AI-drafted one. */
export function sampleLetterPdf(c: { case_ref: string; borrower: Record<string, string> | null }, brandName: string): Buffer {
  const b = c.borrower ?? {}
  const body = [
    '**SAMPLE: NOT A REAL LETTER.** Pandas LP test mode. Nothing has been sent to anyone.',
    '',
    `Our Ref: ${c.case_ref}`,
    '',
    `Dear ${b['Borrower Full Name'] || 'Sir/Madam'},`,
    '',
    `This sample stands in for the letter of demand a lawyer would approve for ${brandName}. A real letter sets out the loan of ₦${b['Loan Amount'] || '…'} taken on ${b['Loan Date'] || '…'}, demands the ₦${b['Amount Outstanding'] || '…'} outstanding within 14 days of service, and explains what happens if it is not paid.`,
    '',
    'With a live key, this is where the approved letter (and, once served, the stamped copy) is returned.',
    '',
    'Pandas LP',
  ].join('\n')
  return buildTextDocumentBuffer('SAMPLE Letter of Demand', body, { watermark: true })
}

export interface TestModeProgress {
  submitted: boolean
  journeyFinished: boolean
  letterPulled: boolean
  webhookDelivered: boolean
  passed: boolean
}

/**
 * Has the brand's integration worked end to end with the test key? A test borrower sent, one
 * that reached Day 14, the letter fetched with the test key, and a test update delivered.
 */
export async function testModeProgress(brandId: string): Promise<TestModeProgress> {
  const [submitted, finished, letter, webhook] = await Promise.all([
    supabaseAdmin.from('brand_cases').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).eq('is_test', true),
    supabaseAdmin.from('brand_cases').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).eq('is_test', true).not('awaiting_brand_decision_at', 'is', null),
    supabaseAdmin.from('brand_api_requests').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).eq('mode', 'test').eq('status', 200).like('path', '%/letter'),
    supabaseAdmin.from('brand_webhook_deliveries').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).eq('is_test', true).eq('status', 'delivered').neq('event', 'ping'),
  ])
  const p = {
    submitted: Boolean(submitted.count),
    journeyFinished: Boolean(finished.count),
    letterPulled: Boolean(letter.count),
    webhookDelivered: Boolean(webhook.count),
  }
  return { ...p, passed: p.submitted && p.journeyFinished && p.letterPulled && p.webhookDelivered }
}
