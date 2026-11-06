export const runtime = 'nodejs'
// A full affidavit or exhibit list with the whole case file can take over a minute to draft.
export const maxDuration = 120

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { callClaude } from '@/lib/claude'
import { DOC_KINDS, claimFigures, claimFiguresText, deadlinesFor, docTitle, packKinds, type DocKind, type FilingFacts, type FilingRow, type Party } from '@/lib/courtFiling'
import { courtFilingSystem, draftInstruction } from '@/lib/courtFilingPrompts'
import { parseEvidenceText } from '@/lib/evidenceNote'
import { fillLagosForm, isLagosForm, lagosNarrativeInstruction, lagosNarrativeNeeded, splitNarrative } from '@/lib/lagosForms'

// One set of particulars for every form, so the claimant's e-mail or the defendant's phone is
// never known on one form and missing on the next. Blank means not known.
function partiesBlock(facts: FilingFacts, c: { client_phone?: string | null; client_email?: string | null; recipient_phone?: string | null }): string {
  const line = (p: Party | undefined, fallback: Partial<Party>) => {
    const v = (k: keyof Party) => (p?.[k] || fallback[k] || '').toString().trim() || '(not known)'
    return `Full name: ${v('name')}\nWork address: ${v('workAddress')}\nResidential address: ${v('residentialAddress')}\nTelephone: ${v('phone')}\nE-mail: ${v('email')}${p?.otherContacts ? `\nOther contacts: ${p.otherContacts}` : ''}`
  }
  return `PARTIES (use these exact particulars on every form; where one says "(not known)", leave a dotted line "……………………" in the form):
CLAIMANT
${line(facts.claimant, { phone: c.client_phone ?? undefined, email: c.client_email ?? undefined })}
DEFENDANT
${line(facts.defendant, { phone: c.recipient_phone ?? undefined })}`
}

// Every document on file, with the lawyer's note first (authoritative) and what the AI read.
function evidenceBlock(rows: { filename: string; media_type: string; extracted_facts: string | null; created_at?: string }[]): string {
  if (!rows.length) return 'EVIDENCE ON FILE: none uploaded. Do not list or rely on any document that is not described in the material.'
  let left = 16_000
  const items = rows.map((r, i) => {
    const { note, facts } = parseEvidenceText(r.extracted_facts)
    const parts = [`${i + 1}. ${r.filename} (${r.media_type}${r.created_at ? `, received ${r.created_at.slice(0, 10)}` : ''})`]
    if (note) {
      parts.push(`   LAWYER'S NOTE (authoritative): What it is: ${note.what}${note.proves ? `. What it proves: ${note.proves}` : ''}${note.dateRef ? `. Date / reference: ${note.dateRef}` : ''}${note.electronic ? `. Printed from a phone or computer: ${note.electronic}` : ''}${note.other ? `. Other: ${note.other}` : ''}`)
    }
    if (facts) {
      const take = Math.max(0, Math.min(2500, left))
      left -= take
      if (take) parts.push(`   What the AI read from it: ${facts.slice(0, take)}`)
    }
    return parts.join('\n')
  })
  return `EVIDENCE ON FILE (the documents the claim can rely on; where the lawyer's note and the AI read differ, follow the note):\n${items.join('\n')}`
}

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 10 * 60 * 1000

// One AI-assisted step in the Court filing tab. Gathers the case material (interview, demand
// letter, evidence list, service records, the filing so far, and anything staff typed for this
// step), asks Claude for the draft, and saves it as a new version. "facts" returns structured
// results that are merged into the filing's facts instead.
//
// Nothing is filed or sent from here: a practitioner checks, completes, dates and signs every
// draft. The model is told never to write a date.

function parseJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0])
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-court-draft:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) return Response.json({ error: 'Too many drafts in a short time — please wait a few minutes.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const by = authResult.user.email || 'unknown'

  let body: { caseId?: string; kind?: string; staffInput?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { caseId } = body
  const kind = body.kind as DocKind
  if (!caseId || !kind || !Object.hasOwn(DOC_KINDS, kind)) return Response.json({ error: 'Missing caseId or unknown document kind.' }, { status: 400 })

  const [{ data: c }, { data: filing, error: fErr }] = await Promise.all([
    supabaseAdmin.from('cases').select('*').eq('id', caseId).single(),
    supabaseAdmin.from('court_filings').select('*').eq('case_id', caseId).maybeSingle(),
  ])
  if (!c) return Response.json({ error: 'Case not found.' }, { status: 404 })
  if (c.agent_id !== 'small-claims' || c.brand_id) return Response.json({ error: 'Court filing is available only for Small Claims matters.' }, { status: 409 })
  if (fErr) return Response.json({ error: 'The court filing tables are not set up yet. Run add-court-filings.sql in Supabase.', setupNeeded: true }, { status: 503 })

  let f = filing
  if (!f) {
    const ins = await supabaseAdmin.from('court_filings').insert({ case_id: caseId, updated_by: by }).select('*').single()
    if (ins.error) return Response.json({ error: ins.error.message }, { status: 500 })
    f = ins.data
  }

  const [{ data: msgs }, { data: evidence }, { data: svc }] = await Promise.all([
    supabaseAdmin.from('messages').select('role, content').eq('case_id', caseId).order('created_at', { ascending: true }),
    supabaseAdmin.from('case_evidence').select('filename, media_type, extracted_facts, created_at').eq('case_id', caseId).order('created_at', { ascending: true }),
    supabaseAdmin.from('service_records').select('channel, status, dispatched_at, acknowledged_at').eq('case_id', caseId),
  ])

  // The interview, trimmed to what fits: the client's own words carry the facts.
  const interview = (msgs ?? [])
    .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'CLIENT' : 'AGENT'}: ${String(m.content).replace(/<<<[\s\S]*?>>>/g, '').trim()}`)
    .join('\n')
    .slice(-24_000)

  const filingRow = f as FilingRow & { id: string; defence_summary?: string | null; hearing_notes?: string | null; notes?: string | null }
  if (filingRow.state !== 'lagos' && filingRow.state !== 'delta') {
    return Response.json({ error: 'Court filing is currently supported only in Lagos and Delta.' }, { status: 409 })
  }
  const templatedDraft = kind === 'facts'
    || isLagosForm(kind, filingRow.state)
    || (filingRow.state === 'delta' && (kind === 'demand_form' || kind === 'garnishee'))
  if (!templatedDraft) {
    return Response.json({ error: 'There is no approved template for this document. Upload or enter a practitioner-prepared version instead.' }, { status: 409 })
  }
  // The latest saved version of the other forms in the pack (including any edited in Google
  // Docs), so this draft uses the same exhibit marks, figures and wording.
  let packSoFar = ''
  if (packKinds(filingRow.state).includes(kind)) {
    const { data: others } = await supabaseAdmin
      .from('court_filing_documents')
      .select('kind, title, body, created_at')
      .eq('filing_id', filingRow.id)
      .in('kind', packKinds(filingRow.state).filter((k) => k !== kind))
      .order('created_at', { ascending: false })
    const seen = new Set<string>()
    const latest = (others ?? []).filter((d: { kind: string }) => !seen.has(d.kind) && seen.add(d.kind)) as { kind: string; title: string; body: string }[]
    if (latest.length) {
      packSoFar = `FORMS ALREADY DRAFTED FOR THIS PACK (latest saved versions; keep this draft consistent with them — same exhibit marks, figures, dates and particulars. Where they conflict with the PARTIES, CLAIM FIGURES or EVIDENCE blocks, those blocks win; the EXHIBIT LIST's marks win over marks used elsewhere):\n${latest
        .map((d) => `--- ${d.title} ---\n${d.body.slice(0, d.kind === 'exhibits' ? 7000 : 3000)}`)
        .join('\n\n')}`
    }
  }

  const material = [
    `CASE: #${c.case_number ?? ''}, matter type ${c.agent_id}, status ${c.status}. Amount paid to the firm: ₦${(c.amount_paid ?? 0).toLocaleString()}. Client phone: ${c.client_phone ?? 'not recorded'}. Client e-mail: ${c.client_email ?? 'not recorded'}. Debtor phone: ${c.recipient_phone ?? 'not recorded'}.`,
    `STATE: ${filingRow.state}. Registry: ${filingRow.registry ?? 'not recorded'}.`,
    `FILING SO FAR: ${JSON.stringify({
      facts: filingRow.facts,
      demand_served_at: filingRow.demand_served_at, demand_service_proof: filingRow.demand_service_proof,
      claim_number: filingRow.claim_number, filed_at: filingRow.filed_at, first_hearing_at: filingRow.first_hearing_at,
      service_outcome: filingRow.service_outcome, served_at: filingRow.served_at,
      defence_type: filingRow.defence_type, defence_summary: filingRow.defence_summary,
      judgment_at: filingRow.judgment_at, judgment_outcome: filingRow.judgment_outcome, judgment_sum: filingRow.judgment_sum,
      hearing_notes: filingRow.hearing_notes, notes: filingRow.notes,
    })}`,
    // Worked out here, not by the model: the forms copy these figures exactly.
    `CLAIM FIGURES (use exactly as written; interest worked out to ${filingRow.filed_at ? 'the filing date' : 'today'}):\n${claimFiguresText(claimFigures((filingRow.facts ?? {}) as FilingFacts, filingRow.filed_at ?? undefined))}`,
    `DEADLINES: ${deadlinesFor(filingRow).map((d) => `${d.label} (${d.rule})`).join('; ') || 'none yet'}.`,
    `SERVICE RECORDS OF THE DEMAND LETTER: ${(svc ?? []).map((s: { channel: string; status: string }) => `${s.channel}: ${s.status}`).join('; ') || 'none recorded'}.`,
    partiesBlock((filingRow.facts ?? {}) as FilingFacts, c),
    evidenceBlock(evidence ?? []),
    packSoFar,
    `THE FIRM'S LETTER OF DEMAND, AS SERVED:\n${c.document_body ?? 'not on file'}`,
    `INTERVIEW:\n${interview || 'not on file'}`,
    body.staffInput?.trim() ? `INFORMATION FROM THE PRACTITIONER FOR THIS STEP:\n${body.staffInput.trim().slice(0, 8000)}` : '',
  ].filter(Boolean).join('\n\n')

  // Lagos Forms SCA 2, 3, 3A and 3B: the printed form, word for word, with the particulars filled
  // in from the record (lib/lagosForms.ts). The summons and the application need nothing from the
  // AI; the complaint and the affidavit need only their narrative part.
  if (isLagosForm(kind, filingRow.state)) {
    const input = {
      facts: (filingRow.facts ?? {}) as FilingFacts,
      clientPhone: c.client_phone,
      clientEmail: c.client_email,
      debtorPhone: c.recipient_phone,
      registry: filingRow.registry,
      claimNumber: filingRow.claim_number,
      firstHearingAt: filingRow.first_hearing_at,
      filedAt: filingRow.filed_at,
    }
    let text = fillLagosForm(kind, input)
    let aiGenerated = false
    if (lagosNarrativeNeeded(kind)) {
      const narrativeResult = await callClaude({
        route: `court-filing.${kind}`,
        caseId,
        system: courtFilingSystem(filingRow.state),
        messages: [{ role: 'user', content: `${material}\n\nTASK:\n${lagosNarrativeInstruction(kind)}` }],
        maxTokens: 3000,
      })
      if (narrativeResult.ok === false) {
        return Response.json({ error: narrativeResult.notConfigured ? 'The AI is not configured on the server (ANTHROPIC_API_KEY).' : 'The drafting assistant is temporarily unavailable. Please try again shortly.' }, { status: 502 })
      }
      const { narrative, notes } = splitNarrative(narrativeResult.text)
      if (!narrative) return Response.json({ error: 'The AI returned an empty draft. Please try again.' }, { status: 502 })
      text = fillLagosForm(kind, input, narrative) + (notes ? `\n\nPRACTITIONER NOTES\n${notes}` : '')
      aiGenerated = true
    }
    const { data: doc, error: dErr } = await supabaseAdmin
      .from('court_filing_documents')
      .insert({ filing_id: filingRow.id, kind, title: docTitle(kind, filingRow.state), body: text, ai_generated: aiGenerated, created_by: by })
      .select('*')
      .single()
    if (dErr) return Response.json({ error: dErr.message }, { status: 500 })
    return Response.json({ document: doc })
  }

  const result = await callClaude({
    route: `court-filing.${kind}`,
    caseId,
    system: courtFilingSystem(filingRow.state),
    messages: [{ role: 'user', content: `${material}\n\nTASK:\n${draftInstruction(kind, filingRow.state)}` }],
    maxTokens: kind === 'facts' ? 1500 : 6000,
  })
  if (result.ok === false) {
    return Response.json({ error: result.notConfigured ? 'The AI is not configured on the server (ANTHROPIC_API_KEY).' : 'The drafting assistant is temporarily unavailable. Please try again shortly.' }, { status: 502 })
  }
  if (!result.text.trim()) return Response.json({ error: 'The AI returned an empty draft. Please try again.' }, { status: 502 })

  if (kind === 'facts') {
    const parsed = parseJson(result.text)
    if (!parsed) return Response.json({ error: 'The AI reply could not be read. Try again.' }, { status: 502 })
    const current = (filingRow.facts ?? {}) as FilingFacts
    // Never overwrite something staff already typed: extracted values fill gaps only.
    const p = parsed as FilingFacts
    const mergeParty = (a: FilingFacts['claimant'] = {}, b: FilingFacts['claimant'] = {}) => {
      const out = { ...b }
      for (const [k, v] of Object.entries(a)) if (v) (out as Record<string, unknown>)[k] = v
      return out
    }
    const facts: FilingFacts = {
      ...p,
      ...Object.fromEntries(Object.entries(current).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))),
      claimant: mergeParty(current.claimant, p.claimant),
      defendant: mergeParty(current.defendant, p.defendant),
    }
    const { data, error } = await supabaseAdmin.from('court_filings').update({ facts, updated_at: new Date().toISOString(), updated_by: by }).eq('id', filingRow.id).select('*').single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ filing: data })
  }

  const title = docTitle(kind, filingRow.state)
  const { data: doc, error: dErr } = await supabaseAdmin
    .from('court_filing_documents')
    .insert({ filing_id: filingRow.id, kind, title, body: result.text.trim(), ai_generated: true, created_by: by })
    .select('*')
    .single()
  if (dErr) return Response.json({ error: dErr.message }, { status: 500 })
  return Response.json({ document: doc })
}
