# Phase 1: Runtime, matter state, calculators, fees

**Goal:** the foundation every agent needs: tool use, a saved matter record, exact money and date calculations, and fees in code. No client-visible change yet.

## Files
- `lib/claude.ts` (extend), `lib/__tests__/claude*.test.ts`
- `lib/agentRuntime/runAgent.ts`, `lib/agentRuntime/types.ts` (new)
- `add-property-matters.sql` + copy in `supabase/migrations/<next timestamp>_add_property_matters.sql`
- `lib/property/matterStore.ts` (new)
- `lib/property/calc.ts` + `lib/__tests__/propertyCalc.test.ts` (new)
- `lib/propertyPricing.ts`, `lib/casePricing.ts` (+ their tests)
- `lib/property/tools/` (new): shared tool schemas and handlers

## Tasks

### Runtime
- [x] `callClaude`: accept `tools` and `toolChoice`; return `content` blocks and `stopReason` alongside `text`. Keep `buildClaudeRequest` pure and extend its unit tests (tools present, caching layout unchanged).
- [x] `runAgent`: tool loop with `maxSteps`. It runs handlers, returns `tool_result` blocks (including `is_error` for handler failures) and stops early when a handler says so (hand-off, escalation). Every model call is recorded in `ai_usage` under `chat.property.<area>` with the case ID.
- [x] Unit tests for `runAgent` with a mocked model: a single turn, multi-step tools, a handler error, `maxSteps` reached, an early stop.

### Matter state
- [x] Migration: `property_matters` (case_id PK/FK, state, lagos_area, area, facts jsonb, status, created_at, updated_at) and `property_matter_events` (id, case_id, kind, payload jsonb, created_at). RLS on, no browser grants; service role only.
- [x] `matterStore.ts`: `getOrCreateMatter(caseId)`, `setState`, `setArea`, `mergeFacts`, `logEvent`.
- [ ] Integration test against the local database (skips if it isn't running, like the brand tests). Written (`lib/__tests__/propertyMatterStore.integration.test.ts`) but not yet run: the local Supabase setup (`supabase/`) isn't in this clone.

### Calculators (`lib/property/calc.ts`)
- [x] `mesneProfits({ annualRent, days })`. Test: ₦1,200,000 × 90 = ₦295,890.41.
- [x] `arrears({ rent, frequency, from, to })`.
- [x] `noticeToQuit(...)`. Tests:
  - [x] the agreement's period wins
  - [x] each tenancy type
  - [x] the yearly anniversary rule
  - [x] an expired fixed term (no NTQ), and rent taken after expiry (NTQ needed)
  - [x] the Lagos arrears lapse (monthly 6 months; quarterly/half-yearly 1 year)
  - [x] the Lagos excluded areas (same periods, different law named)
  - [x] a notice short by one day is invalid
- [x] `sevenDaysNoticeDate(...)`.
- [x] `advanceRentCheck(...)` for Lagos: new or sitting yearly tenant at most 1 year; sitting monthly tenant at most 6 months.

### Fees
- [x] `lib/propertyPricing.ts`: add `subleaseShort: 25_000`, `deedOfRelease: 30_000`, and `subleaseDeed`, `will`, `codicil`, `probate`, `disputeBrief` as `null`, with comments explaining `null` = a lawyer confirms.
- [x] `getFee(documentType)` returning `{ amount, label } | { amount: null }`.
- [x] `lib/casePricing.ts`: allowed list for `recovery-of-premises` built from `getFee`, not a hand-written array. Tests updated.

### Shared tools (schemas + handlers)
- [x] `calc_*` (wrapping the calculators), `get_fee`, `record_facts`, `escalate_to_lawyer`, `handoff_to(area, reason, facts)`, `emit_document`.
- [x] `emit_document` validation: no `[...]` placeholders left; the document type belongs to the area; the price comes from `getFee`; transfer deeds require a recorded fee-acceptance event; renders the existing `<<<DOCUMENT>>>` text format.

## Done when
- `npm test` and `npx tsc --noEmit` are clean.
- The migration applies on the local Supabase.
- No change in how the live agent behaves.

## Progress notes (14 Oct 2026)
- Code, unit tests and type check done: `npm test` 381 passed (71 skipped: the local-database tests), `npx tsc --noEmit` clean.
- **Still open:** apply `add-property-matters.sql` to the local Supabase (and copy it into `supabase/migrations/` with the next timestamp; that folder is gitignored and missing from this clone), then run the integration test.
- Where things landed, differing slightly from the plan:
  - `getFee`, the document list (`PROPERTY_DOCUMENTS`: type, area, fee) and `propertyOnlineFees()` live in `lib/propertyPricing.ts`. `getFee` returns `{ kind: 'flat' | 'transfer' | 'lawyer-confirms', amount, label }`.
  - A fee that is `null` (or the comprehensive search, which a lawyer quotes) is emitted as **PRICE 0** with the label "A Pandas LP lawyer will confirm the fee…". PRICE 0 is what AgentChat already treats as "nothing paid online". Leaving PRICE out would have made `resolveCasePrice` charge the default ₦25,000.
  - Extra shared tool `record_fee_acceptance` (needed by `emit_document`'s 2.5% check): logs the `fee_accepted` event with the consideration and fee.
  - `emit_document` puts the rendered `<<<DOCUMENT>>>` block on `ctx.emitted`; the orchestrator (Phase 2) appends it to the reply. The model only gets the price back, not the body.
  - Merging facts is one SQL statement (`merge_property_matter_facts`), so two tool calls in one turn can't overwrite each other.
  - Executors' assent uses the probate fee (null).
- **For the lawyer (sign-off in Phase 2):** notice periods follow the current prompt (half-yearly = 3 months everywhere). Days are counted excluding the day of receipt (Interpretation Act s.15(2)(a)); one constant in `lib/property/calc.ts` flips it. Only yearly tenancies are tied to the anniversary. A sitting quarterly/half-yearly tenant's advance-rent limit in Lagos is left to a lawyer.
- `components/AgentChat.tsx`: the Property Law Agent now creates its case before the first message, so the server always has a case to attach the matter to.
