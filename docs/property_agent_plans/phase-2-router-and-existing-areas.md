# Phase 2: Router and the 5 existing areas

**Goal:** the router plus the five areas the current agent already partly covers, rebuilt as sub-agents and corrected against the scope document. Runs behind a switch; the old prompt stays live.

## Files
- `lib/property/router.ts`, `lib/property/orchestrator.ts` (new)
- `lib/property/shared.ts`: shared prompt block (new)
- `lib/property/jurisdictions.ts`: supported states, groups, the Lagos areas (new)
- `lib/property/areas/recovery.ts`, `tenancy.ts`, `conveyancing.ts`, `otherInstruments.ts`, `searches.ts` (new)
- `lib/property/tools/consentApplication.ts` (new)
- `app/api/chat/route.ts`: branch for `recovery-of-premises` behind a flag (`NEXT_PUBLIC_PROPERTY_AGENT_V2=true`)
- `lib/agents.ts`: new 7-area starter (used only when the flag is on)

## Tasks

### Shared and jurisdiction
- [x] `jurisdictions.ts`:
  - groups: Lagos, FCT, Western/PCL (7 states), CA-applied (Anambra, Enugu, Cross River)
  - Lagos excluded areas (Apapa, Ikeja GRA, Ikoyi, VI) → the Rent Control Law 1997 for homes, the Recovery of Premises Law for business premises
  - unsupported state → escalate
- [x] `shared.ts`: move over from the current prompt:
  - voice (Pandas LP as solicitors)
  - conversation style and the OPTIONS block format
  - signing blocks (individual, company under CAMA, POA, illiterate jurat, family)
  - drafting standards
  - anti-hallucination rules
  - ethical limits
  - Add: the citation rule, and "never do arithmetic; call the calc tools".
- [ ] Prompt assembly order: shared (1h cache) → area (1h cache) → jurisdiction block → date. Built and unit-tested; **still to check** that cache reads appear in `ai_usage` (needs a real API key).

### Router
- [x] Starter menu: 7 area buttons + "Something else". The state is asked next (buttons by group, then the state; Lagos then asks the area for the exception).
- [x] Button → area mapping with no model call.
- [x] Free-text router prompt (Haiku 4.5) with tools `route_to`, `ask_clarifying`, `escalate_to_lawyer`. It applies the occupant test and the not-covered list.
- [x] Logs a `routed` event. The area stays fixed unless `handoff_to` is called.
- [x] Hand-off: the new area gets the saved `facts` plus the last few messages; it says one line to the client ("This is now a … matter; I have what you told me") and does not re-ask.

### Recovery of premises
- [x] Rules per group with sources: Lagos Tenancy Law s.13; FCT Recovery of Premises Act ss.7–9; the state laws.
- [x] Notice periods, the two-notice sequence, who signs, no self-help (criminal in Lagos), the arrears and mesne-profits definitions; all figures via the calc tools.
- [x] Templates: Notice to Quit, Seven Days' Notice, rent demand letter (written as Pandas LP for the landlord).
- [x] Hand-offs: a tenant who claims ownership → flag a lawyer (estoppel) and stay; a rival claimant who was never a tenant → Dispute; a new letting → Tenancy.

### Tenancy, lease and sublease
- [x] The three-year line: Tenancy Agreement vs Deed of Lease; Lagos advance-rent limits and the rent receipt; fixed term vs periodic (ask the landlord); the notice clause always included.
- [x] Sublease rules: subterm at least one day shorter than the head lease; check the head lease and get head-landlord consent if needed; over 3 years by deed with s.22 consent; repeats the head-lease covenants.
- [x] Templates: Tenancy Agreement, Deed of Lease, Deed of Sublease (new; lawyer to check).

### Conveyancing
- [x] Rules: LUA ss.1, 22, 26 (Minister in the FCT); sign then apply (Awojugbagbe); pre-1978 land (Savannah Bank v Ajilo); root of title 40 years (CA) / 30 years (PCL); family land; signing; the Nigeria Tax Act 2025 (CGT is the seller's); government charges never quoted.
- [x] Deed of Assignment template (moved over) + the 2.5% fee acceptance flow (recorded event, PRICE 0, invoiced by the firm).
- [x] `prepare_consent_application` shared tool (used by Conveyancing, Other instruments, Tenancy for leases or subleases over 3 years).

### Other property instruments
- [x] Deed of Gift (a gift on death → hand off to Wills).
- [x] Legal Mortgage / Charge, with the creation method by group (CA: assignment with a proviso for reassignment, or a sub-demise; PCL: sub-demise or a charge by way of legal mortgage; Lagos MPL 2010: demise/sub-demise or charge). Consent, CAC registration within 90 days for a company, stamp and register, Lagos deposit-of-deeds rule, power-of-sale conditions.
- [x] Power of Attorney: not a transfer (Ude v Nwara); by deed if the attorney will sign a deed; **irrevocable only if for valuable consideration and stated as irrevocable, or stated irrevocable for a fixed period of no more than 1 year**; signed before a notary abroad.
- [x] Agreement for Sale of Land: no consent at this stage; recommend a search first (→ Searches).
- [x] Deed of Release (new template; lawyer to check).

### Property searches and due diligence
- [x] Standard search vs comprehensive (the list of extra checks). Collect the address, title document copy, survey plan and seller's name. Search before any money is paid; a search is not a guarantee.
- [x] Search Instruction template (moved over). Standard ₦50,000; comprehensive from ₦100,000, quoted by a lawyer.

### Wiring
- [x] `orchestrator.ts`: load the matter → router or area → `runAgent` → save state → return `{ response }` exactly as `/api/chat` does now.
- [x] `/api/chat` branch behind `NEXT_PUBLIC_PROPERTY_AGENT_V2`.
- [ ] Lawyer sign-off recorded for each area's rule text and case list (name + date in the area file's header comment).

## Done when
- With the flag on locally, a client can go from the starter to a finished document in each of the 5 areas, including one hand-off.
- Unit tests for router mapping, the occupant test, and jurisdiction lookup pass.
- The old agent still works with the flag off.

## Progress notes (14 Oct 2026)
- Built behind `NEXT_PUBLIC_PROPERTY_AGENT_V2` (one flag for the browser's starter menu and the server; the old prompt is untouched while it's off). `npm test` 420 passed, `npx tsc --noEmit` clean. Tested with a scripted model; **not yet run against the real API or a database**.
- **Blocked on the scope document:** `documents/Scope and applicable law.docx` is not in the repo, so the area rules were written from this plan's summaries plus the current prompt. Every area file says PENDING LAWYER SIGN-OFF; the lawyer should read them against the scope document. Open points flagged in code comments: the Lagos root-of-title period; non-Lagos half-yearly notice (3 months, from the current prompt).
- Where things landed:
  - `lib/property/starter.ts`: the 7-area menu (+ "Something else"), button → area with no model call (old starter labels still map), the state and Lagos-area questions. The state is one list of buttons, not a group step first.
  - `lib/property/router.ts`: free text → `claude-haiku-4-5` with `route_to` / `ask_clarifying` / `escalate_to_lawyer`, the occupant test and the not-covered list. Falls back to a question if the model decides nothing.
  - `lib/property/orchestrator.ts`: route → state → (Lagos) area → sub-agent. Once the state is known the sub-agent answers in the same turn. One hand-off per turn, answered straight away by the new area with a HAND-OFF note and the saved facts.
  - `lib/property/areas/`: one config per area (rules, per-group rules, templates, citable cases, hand-offs, `signOff`). Wills & probate and Land disputes are disabled until Phase 4: picking them escalates, and no area may hand off to them (the tool says to escalate).
  - Every area gets the same tool list, so the cached tools + shared block prefix is shared across areas. The matter record (facts) and the date go in the last, uncached system block.
  - `prepare_consent_application` (`lib/property/tools/consentApplication.ts`) and a `consent-application` document type, emitted by Conveyancing, Other instruments or Tenancy, fee not set (lawyer confirms).
  - Templates: the current ones copied into `lib/property/templates.ts` (Notice to Quit now names the quit date; Power of Attorney irrevocability corrected). New, lawyer to check: rent demand letter, Deed of Lease, sublease agreement, Deed of Sublease, Deed of Release, consent application (`lib/property/templatesNew.ts`).
- **Gap to decide before cut-over:** an escalated matter only sets `property_matters.status` and logs an event. Nothing tells staff yet (no email, nothing in the admin Action Queue).
