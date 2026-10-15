# Tasks: Property Law Agent rebuild

All tasks in one list. Details for each are in the phase files. Tick here **and** in the phase file, and update the README status table.

## Phase 0: Prerequisites ([details](phase-0-prerequisites.md))
- [ ] 0.1 Fix the Claude Code shell `EPERM` error (restart; Defender exclusion if needed)
- [ ] 0.2 Create the `documents/law documents/` folder tree (nationwide, english-statutes, lagos, fct, western/<7 states>, north-east/anambra|enugu|cross-river)
- [ ] 0.3 Download the PDFs for laws 1–59 (Part F: Anambra, Enugu, Cross River only), named `<no> - <title>.pdf`
- [ ] 0.4 List any laws not found
- [ ] 0.5 Name the lawyer who signs off rule texts and case lists
- [ ] 0.6 Decide the fees "to be set" (sublease by deed, will, codicil, probate, dispute brief)
- [ ] 0.7 Save the Scope and Schedule documents as text/PDF in `documents/`

## Phase 1: Runtime, matter state, calculators, fees ([details](phase-1-runtime-state-calculators.md))
- [x] 1.1 `callClaude`: tools support, content blocks returned; tests
- [x] 1.2 `runAgent` tool loop (`lib/agentRuntime/`); tests with a mocked model
- [x] 1.3 Migration: `property_matters`, `property_matter_events` (`add-property-matters.sql`; the copy into `supabase/migrations/` is still to do, that folder is missing from this clone)
- [ ] 1.4 `lib/property/matterStore.ts` + integration test (store written; test not yet run against the local database)
- [x] 1.5 `mesneProfits` (test: ₦295,890.41)
- [x] 1.6 `arrears`
- [x] 1.7 `noticeToQuit` + all edge-case tests
- [x] 1.8 `sevenDaysNoticeDate`
- [x] 1.9 `advanceRentCheck` (Lagos)
- [x] 1.10 New fees in `lib/propertyPricing.ts` + `getFee`
- [x] 1.11 `lib/casePricing.ts` allowed list from `getFee`; tests
- [x] 1.12 Shared tools: `calc_*`, `get_fee`, `record_facts`, `escalate_to_lawyer`, `handoff_to`
- [x] 1.13 `emit_document` with validation (placeholders, area, price from code, fee acceptance)

## Phase 2: Router and the 5 existing areas ([details](phase-2-router-and-existing-areas.md))
- [x] 2.1 `lib/property/jurisdictions.ts` (groups, Lagos excluded areas, unsupported → escalate)
- [x] 2.2 `lib/property/shared.ts` (shared block moved over + citation and "use calc tools" rules)
- [ ] 2.3 Prompt assembly + cache check in `ai_usage` (assembly built and tested; cache check needs a real API key)
- [x] 2.4 Starter menu (7 areas) + state/Lagos-area buttons
- [x] 2.5 Button → area mapping (no model call)
- [x] 2.6 Free-text router (Haiku 4.5) with occupant test and not-covered list
- [x] 2.7 Hand-off mechanics (facts carried over, nothing re-asked)
- [x] 2.8 Recovery of premises sub-agent
- [x] 2.9 Tenancy, lease and sublease sub-agent (+ Deed of Lease and Deed of Sublease templates)
- [x] 2.10 Conveyancing sub-agent + 2.5% acceptance flow
- [x] 2.11 `prepare_consent_application` shared tool
- [x] 2.12 Other instruments sub-agent (mortgage by state, POA irrevocability rule, Deed of Release)
- [x] 2.13 Searches & due diligence sub-agent
- [x] 2.14 `orchestrator.ts` + `/api/chat` branch behind `NEXT_PUBLIC_PROPERTY_AGENT_V2`
- [ ] 2.15 Lawyer sign-off for the 5 areas recorded

## Phase 3: Law library ([details](phase-3-law-library.md))
- [ ] 3.1 `manifest.json` for all obtained laws (on hold: the legal team sent `docs/pandaslp-law-library-seed.sql` instead, 6 laws in, 9 not sourced)
- [ ] 3.2 `scripts/law-ingest.mjs`: extraction, OCR fallback, section splitting
- [ ] 3.3 Ingest quality report
- [x] 3.4 Migration: `law_documents`, `law_sections` (tsvector + GIN), matching the legal team's seed (`add-law-library.sql`; not yet run on Supabase)
- [ ] 3.5 Load Lagos, FCT, nationwide, then the remaining states
- [ ] 3.6 Human spot-check of key sections
- [x] 3.7 `get_section` and `lookup_law` tools (state filtered)
- [x] 3.8 Citation rule enforced in `emit_document`
- [ ] 3.9 Evaluation set (10 questions per area); decide on vectors (21 questions on the 6 laws in `scripts/law-search-eval.ts`; vectors decided: yes. Grows as laws are added)
- [x] 3.10 Identify the seed's embedding model (384 dims) and turn on vector search (step 2): gte-small, meaning search is the default
- [x] 3.11 Web search fallback for laws not in the library: trusted sites only, logged (step 3; built and unit-tested; needs a TAVILY_API_KEY to run for real, and the lawyer's approval of the site list)

## Phase 4: Wills & probate, Land title disputes ([details](phase-4-wills-probate-and-disputes.md))
- [ ] 4.1 Wills & probate rules per group
- [ ] 4.2 Will and Codicil templates + signing instruction sheet
- [ ] 4.3 Probate path chooser + application papers + Assent
- [ ] 4.4 Wills escalation triggers (family provision, customary property, Islamic law, non-Marriage Act intestacy)
- [ ] 4.5 Land title dispute rules + intake
- [ ] 4.6 Lawyer Brief template + flags (limitation, pending case, land grabber, urgency)
- [ ] 4.7 Router: occupant test routes to Dispute
- [ ] 4.8 Lawyer sign-off for both areas recorded

## Phase 5: Testing and cut-over ([details](phase-5-testing-and-cutover.md))
- [ ] 5.1 Update the test plan: the 19 scenarios re-pointed (scenario 18 now in scope)
- [ ] 5.2 Router, scope-correction, hand-off and new-area scenarios added
- [ ] 5.3 Local test script drives the orchestrator
- [ ] 5.4 All scenarios run and graded by the lawyer
- [ ] 5.5 `ai_usage` comparison, old vs new
- [ ] 5.6 Browser end-to-end: Recovery matter, hand-off, Conveyancing 2.5% flow
- [ ] 5.7 Flag on in production; monitor first matters
- [ ] 5.8 Remove the old prompt and the flag
- [ ] 5.9 Update `CLAUDE.md`, `lib/agentCapabilities.ts` and marketing copy
