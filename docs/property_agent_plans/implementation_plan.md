# Implementation plan: Property Law Agent (router + 7 sub-agents + law library)

## Context
Today the Property Law Agent is one ~600-line system prompt (`lib/agents.ts`, the `recovery-of-premises` entry). It is sent through a single text-only API call (`app/api/chat/route.ts` → `callClaude` in `lib/claude.ts`, no tools).

Problems:
- It is too big to test or change safely. Every chat loads all 9 templates, so rules bleed between documents.
- It contradicts the firm's scope document in places:
  - notice rules: an expired fixed term needs no Notice to Quit; the Lagos arrears-lapse rule; the Lagos areas where the Tenancy Law does not apply; the advance-rent limits
  - the Power of Attorney irrevocability rule
  - legal mortgages are created differently by state
- It refuses subleases, wills, probate and land disputes, which are now in scope.
- The model does arithmetic itself (arrears, the 2.5% fee), which the test plan flags as a risk.

Goal: a real agent system that follows `documents/Scope and applicable law.docx` and the Schedule of Laws, both by Olusegun Ayodele, 10 Oct 2026.

## Architecture

```
AgentChat.tsx ──POST /api/chat (agentId=recovery-of-premises)──► property orchestrator
                                                                   │
              load matter state (property_matters) ◄───────────────┤
                                                                   ▼
                       no area yet? → ROUTER  ── route_to(area) / ask state / escalate
                       area set?   → SUB-AGENT[area] (rules for client's state + tools)
                                                                   │ tool loop (max N steps)
     tools: lookup_law · get_section · calc_* · get_fee · record_facts · prepare_consent_application
            emit_document · handoff_to(area) · escalate_to_lawyer
                                                                   ▼
                       save state + messages; return text + document in the format AgentChat already parses
```

### 1. Agent runtime (`lib/agentRuntime/`)
- Extend `lib/claude.ts`:
  - `ClaudeCallOptions` gains `tools` (and optional `toolChoice`).
  - The result returns the raw `content` blocks as well as the joined text.
  - Usage recording (`ai_usage`) and caching keep working exactly as now.
- `runAgent({ route, systemBlocks, tools, messages, handlers, maxSteps, caseId })` runs the loop:
  1. Call the model.
  2. For every `tool_use` block, run its handler and send back a `tool_result`.
  3. Repeat until the model stops asking for tools, or `maxSteps` is reached (return a safe error message).
- Each tool is a JSON schema plus a server-side handler. Handlers are pure where possible and unit-tested.
- A handler may end the turn early: a hand-off switches the agent, an escalation stops drafting.

### 2. Matter state (new SQL migration, also copied into `supabase/migrations/` with the next timestamp)
- `property_matters`:

  | Column | Meaning |
  |---|---|
  | `case_id` | PK, FK to `cases` |
  | `state` | the property's state |
  | `lagos_area` | for the Apapa / Ikeja GRA / Ikoyi / VI exception |
  | `area` | one of the 7 |
  | `facts` | jsonb |
  | `status` | `routing` / `active` / `escalated` / `closed` |
  | timestamps | |

- `property_matter_events`: one row per route, hand-off (with reason and facts carried over), escalation (with reason), fee acceptance (the 2.5% confirmation) and document emitted.
- Service-role access only (like the other server-written tables). The browser never writes these.
- `cases.agent_id` stays `recovery-of-premises`, so payments, the dashboard and admin are unchanged.

### 3. Router (`lib/property/router.ts`)
- **No AI where it isn't needed:**
  - The starter menu has one button per area, and a button maps directly to an area.
  - State is chosen from buttons, plus the Lagos area where relevant.
- **AI only for free text or "Something else":**
  - A small prompt with tools `route_to(area, reason)`, `ask_clarifying(question, options)`, `escalate_to_lawyer(reason)`.
  - It can run on a cheaper model (Haiku 4.5), since it only classifies.
- Built-in rules:
  - the occupant test (see README)
  - the "not covered" list: squatters, a client who wants to skip Governor's Consent, unsupported states
- Once routed, the area is saved and kept. Only `handoff_to` changes it.

### 4. Sub-agents (`lib/property/areas/<area>.ts`)
Each area is a config holding:
- `id`, `title`, starter text
- `rules`: Layer 1 rule text per jurisdiction group (Lagos, FCT, Western/PCL, CA states, Anambra/Enugu/Cross River). Each rule cites its source section.
- `templates`: moved over from the current prompt, then corrected against the scope document
- `tools`: the tools this area may use
- `citableCases`: case name plus a one-line principle (lawyer-approved)
- `feeKeys`: which fees from `lib/propertyPricing.ts` apply
- `escalation`: area-specific escalation triggers
- `handoffs`: which areas it may hand to, and when

How the system prompt is built (cache order matters, see `lib/claude.ts`):
1. **Shared block**, cached 1h: voice, conversation style, signing blocks, drafting standards, anti-hallucination, document protocol.
2. **Area block**, cached 1h: rules, templates, cases.
3. **Jurisdiction block**: only the rules for the client's state.
4. Today's date (uncached).

| Area | Main documents | Hand-offs |
|---|---|---|
| Recovery of premises | Notice to Quit, Seven Days' Notice, rent demand letter | → Tenancy (new letting), → Dispute (rival claimant) |
| Tenancy, lease, sublease | Tenancy Agreement, Deed of Lease, Deed of Sublease | → Recovery |
| Conveyancing | Deed of Assignment, Governor's Consent application | → Searches (before paying) |
| Other instruments | Deed of Gift, Legal Mortgage/Charge (form by state), Power of Attorney, Agreement for Sale of Land, Deed of Release | → Searches, → Wills (gift on death) |
| Searches & due diligence | Search Instruction (standard / comprehensive) | → Conveyancing |
| Wills & probate | Will, codicil, probate / letters of administration papers, assent | → Conveyancing |
| Land title dispute | Lawyer brief (never court papers) | none |

### 5. Calculations in code (`lib/property/calc.ts`, pure, unit-tested)
- `arrears({ rent, frequency, from, to })`: arrears up to the day the tenancy ended.
- `mesneProfits({ annualRent, days })` = annual rent ÷ 365 × days, to the kobo. Test: ₦1,200,000 × 90 days = ₦295,890.41.
- `noticeToQuit({ tenancyType, agreementPeriod, fixedTermEnd, rentTakenAfterExpiry, state, lagosArea, arrears, receivedOn })` returns whether a Notice to Quit is needed, its period and the quit date. Rules:
  - The agreement's own period wins.
  - Tenancy type follows how rent is paid.
  - Yearly: serve at least 6 months before the tenancy year ends; quit on its last day.
  - An expired fixed term needs no NTQ, unless rent was taken after expiry.
  - Lagos arrears lapse: monthly tenant owing 6 months, or quarterly/half-yearly owing 1 year.
  - Time counts from the day the tenant receives the notice.
- `sevenDaysNoticeDate(...)`
- `advanceRentCheck({ state, tenantType, monthsDemanded })` (Lagos limits)
- `transferFee(consideration)`: already in `lib/propertyPricing.ts`, reused.

### 6. Fees (`lib/propertyPricing.ts`, `lib/casePricing.ts`)
- Add `subleaseShort` (≤3 years, ₦25,000), `subleaseDeed` (`null`), `deedOfRelease` (₦30,000), `will`, `probate`, `disputeBrief` (all `null`).
- `get_fee(documentType)` is the only source of a price.
- `emit_document` sets PRICE from code, never from the model.
- Update `resolveCasePrice`'s allowed list.
- A `null` fee means: no PRICE line, and "a lawyer will confirm the fee".

### 7. Documents
- `emit_document({ type, title, body })`: the server checks that no `[PLACEHOLDER]` is left and that the type belongs to the area, fills in the price from code, and renders the existing `<<<DOCUMENT>>>TITLE/PRICE/PRICE_LABEL/---/body<<<END_DOCUMENT>>>` text.
- Nothing changes for `components/AgentChat.tsx`, `/api/save-document`, `lib/pdfGenerator.js` or payments.
- The 2.5% rule stays: transfer deeds are emitted with PRICE 0 only after a recorded fee acceptance event.

### 8. Law library (Layer 2)
- Folder `documents/law documents/`, organised by the Schedule's parts:
  ```
  nationwide/                 Part A (1–12)
  english-statutes/           Part B (13–20)
  lagos/                      Part C (21–38)
  fct/                        Part D (39–44)
  western/<state>/            Part E (45–53), each state's own edition
  north-east/anambra|enugu|cross-river/   Part F (54–59)
  manifest.json               law no. → file, jurisdictions, areas, edition/date, checked_by
  ```
- `scripts/law-ingest.mjs`:
  - extract PDF text, with OCR for scanned pages
  - split by section
  - write a quality report listing pages that came out badly
  - load the database idempotently (re-running replaces that law's sections)
- Tables:
  - `law_documents` (law no., title, jurisdiction, edition, source file, checked_by, checked_at)
  - `law_sections` (`law_no`, `section`, `heading`, `text`, `jurisdictions[]`, `areas[]`, `tsv tsvector` with a GIN index; an `embedding` column can be added later without a rebuild)
- Tools:
  - `get_section(law, section)`: exact lookup
  - `lookup_law(query)`: keyword search with ranking

  Both are filtered automatically to the matter's state and area.
- **Citation rule:** an agent may cite a section only if a tool returned it in this conversation, and a case only if it is on the area's `citableCases` list.
- The Fair Market Value schedule (no. 38) is internal only. Agents never quote government charges.

### 9. Chat route and starter
- `app/api/chat/route.ts`: when `agentId === 'recovery-of-premises'`, call `runPropertyOrchestrator(...)`. The other 5 agents are untouched.
- The starter message in `lib/agents.ts` becomes the 7-area menu.
- The old monolithic prompt stays behind a switch until Phase 5 cut-over, then is removed.

## Phases
| Phase | Content |
|---|---|
| 0 | Prerequisites: shell fixed, PDFs in place, lawyer review arranged |
| 1 | Runtime, matter state, calculators, fees |
| 2 | Router + Recovery, Tenancy (incl. sublease), Conveyancing, Other instruments, Searches |
| 3 | Law library: ingestion, tables, lookup tools, citation rule |
| 4 | Wills & probate, Land title disputes |
| 5 | Testing and switching the live agent over |

Details and tasks are in each phase file.

## Verification (overall)
- `npm test`: calculators (including ₦295,890.41 and NTQ date edge cases), fees, router mapping, tool handlers, document validation, runtime loop (with a mocked model).
- `npx tsc --noEmit`: clean.
- The 19 scenarios in `docs/property-law-agent-test-plan.md`, run against the new system with a real key, plus router and new-area scenarios.
- Law lookup checks: real client questions per area. Did the right section come back? That decides whether vectors are needed.
- `ai_usage`: cost per conversation before and after, and cache reads happening.
- A browser click-through on the local Supabase stack: a full Recovery matter and a hand-off mid-chat.
