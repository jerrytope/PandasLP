# Phase 5: Testing and switching the live agent over

**Goal:** prove the new system is at least as good as the old one in every scenario, then make it the live Property Law Agent.

## Tasks

### Behaviour tests
- [ ] Update `docs/property-law-agent-test-plan.md`:
  - [ ] Re-point the 19 existing scenarios at the new system. Change scenario 18 (Deed of Sublease): it is now in scope, so the expected result is a sublease draft, not an escalation.
  - [ ] Add router scenarios: each starter button; free text for each area; an unclear request gets one clarifying question; a tenant claiming ownership stays in Recovery and is flagged; a rival claimant goes to Dispute; a squatter or land grabber is escalated; a client skipping consent is escalated; an unsupported state is escalated; the Lagos excluded areas name the right law.
  - [ ] Add scope-correction scenarios: an expired fixed term (no NTQ); the Lagos arrears lapse; advance rent over the limit; a POA "irrevocable for 5 years" with no consideration (pushback); a mortgage in a PCL state vs a CA state (different creation wording).
  - [ ] Add hand-off scenarios: Agreement for Sale → Searches; gift on death → Wills; recovery → new tenancy. Check that facts carry over and nothing is re-asked.
  - [ ] Add Wills & probate and Dispute scenarios (formalities, a witness-beneficiary, intestacy by marriage type, the dispute brief contents).
- [ ] Update `test-agent-local.mjs` (or replace it) to drive the orchestrator directly with a real key, no login.
- [ ] Run everything; record PASS/FAIL in the results log; fix and re-run until all pass. The lawyer grades legal correctness.

### Cost and quality checks
- [ ] Compare `ai_usage` per matter, old vs new, on the same scenarios: total cost, cache read share, steps per turn.
- [ ] Law lookup evaluation from Phase 3 meets its bar (or vectors added).

### End-to-end in the browser
- [ ] Local Supabase stack: a full Recovery matter (starter → state → facts → Notice to Quit → payment stub → dashboard), and a hand-off mid-chat.
- [ ] A Conveyancing matter: the 2.5% acceptance → PRICE 0 → "the firm will invoice" message.

### Cut-over
- [ ] Turn on `NEXT_PUBLIC_PROPERTY_AGENT_V2` in production.
- [ ] Watch the first live matters (`property_matter_events`, `ai_usage`, escalations).
- [ ] After a stable period, remove the old monolithic prompt from `lib/agents.ts` and the flag.
- [ ] Update `CLAUDE.md` (agents table, key files) and `lib/agentCapabilities.ts` / marketing copy (7 areas, nine-document claim).

## Done when
- All scenarios pass and the lawyer has graded them.
- The flag is on in production with no regressions for a week.
- The old prompt is removed.

## Progress notes (15 Oct 2026)

**Built before cut-over: the lawyer queue.** Until now an escalated matter, or a document nothing is paid for online (a transfer deed the firm invoices, a will, probate papers, a dispute brief; these never reach the paid-order alert), only lived in `property_matters` and its events: no member of staff was told.
- After each turn the orchestrator checks the turn's events (`lawyerReasons`): an `escalated` event, or a `document_emitted` at PRICE 0, flags the matter (`add-property-lawyer-queue.sql`: `needs_lawyer_at`, `needs_lawyer_reason`, `lawyer_taken_at`, `lawyer_taken_by`). One check at the end of the turn catches every way the agent can escalate (router, tool, unsupported state, a promise of a lawyer, a tool call written as text).
- Staff are emailed at the firm's inbox with a link to the matter (`lib/property/lawyerAlerts.ts`, client's words HTML-escaped; best effort: a failed email never fails the client's turn).
- Admin → Action Queue → "Property matters needing a lawyer" (`PropertyLawyerQueue.tsx`, `/api/admin/property-matters`): "I'll handle it", "Back to the agent" (status active, the client can carry on), "Close matter" (the client gets a closed reply). Each logs a `lawyer_taken` event.
- Tested (`lib/__tests__/lawyerQueue.test.ts`; 489 tests pass). The admin screen is type-checked but not yet clicked through in a browser.
- **To run:** `add-property-lawyer-queue.sql` in Supabase after `add-law-library.sql`.
