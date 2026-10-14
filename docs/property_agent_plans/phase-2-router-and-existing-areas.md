# Phase 2: Router and the 5 existing areas

**Goal:** the router plus the five areas the current agent already partly covers, rebuilt as sub-agents and corrected against the scope document. Runs behind a switch; the old prompt stays live.

## Files
- `lib/property/router.ts`, `lib/property/orchestrator.ts` (new)
- `lib/property/shared.ts`: shared prompt block (new)
- `lib/property/jurisdictions.ts`: supported states, groups, the Lagos areas (new)
- `lib/property/areas/recovery.ts`, `tenancy.ts`, `conveyancing.ts`, `otherInstruments.ts`, `searches.ts` (new)
- `lib/property/tools/consentApplication.ts` (new)
- `app/api/chat/route.ts`: branch for `recovery-of-premises` behind a flag (e.g. `PROPERTY_AGENT_V2=true`)
- `lib/agents.ts`: new 7-area starter (used only when the flag is on)

## Tasks

### Shared and jurisdiction
- [ ] `jurisdictions.ts`:
  - groups: Lagos, FCT, Western/PCL (7 states), CA-applied (Anambra, Enugu, Cross River)
  - Lagos excluded areas (Apapa, Ikeja GRA, Ikoyi, VI) → the Rent Control Law 1997 for homes, the Recovery of Premises Law for business premises
  - unsupported state → escalate
- [ ] `shared.ts`: move over from the current prompt:
  - voice (Pandas LP as solicitors)
  - conversation style and the OPTIONS block format
  - signing blocks (individual, company under CAMA, POA, illiterate jurat, family)
  - drafting standards
  - anti-hallucination rules
  - ethical limits
  - Add: the citation rule, and "never do arithmetic; call the calc tools".
- [ ] Prompt assembly order: shared (1h cache) → area (1h cache) → jurisdiction block → date. Check that cache reads appear in `ai_usage`.

### Router
- [ ] Starter menu: 7 area buttons + "Something else". The state is asked next (buttons by group, then the state; Lagos then asks the area for the exception).
- [ ] Button → area mapping with no model call.
- [ ] Free-text router prompt (Haiku 4.5) with tools `route_to`, `ask_clarifying`, `escalate_to_lawyer`. It applies the occupant test and the not-covered list.
- [ ] Logs a `routed` event. The area stays fixed unless `handoff_to` is called.
- [ ] Hand-off: the new area gets the saved `facts` plus the last few messages; it says one line to the client ("This is now a … matter; I have what you told me") and does not re-ask.

### Recovery of premises
- [ ] Rules per group with sources: Lagos Tenancy Law s.13; FCT Recovery of Premises Act ss.7–9; the state laws.
- [ ] Notice periods, the two-notice sequence, who signs, no self-help (criminal in Lagos), the arrears and mesne-profits definitions; all figures via the calc tools.
- [ ] Templates: Notice to Quit, Seven Days' Notice, rent demand letter (written as Pandas LP for the landlord).
- [ ] Hand-offs: a tenant who claims ownership → flag a lawyer (estoppel) and stay; a rival claimant who was never a tenant → Dispute; a new letting → Tenancy.

### Tenancy, lease and sublease
- [ ] The three-year line: Tenancy Agreement vs Deed of Lease; Lagos advance-rent limits and the rent receipt; fixed term vs periodic (ask the landlord); the notice clause always included.
- [ ] Sublease rules: subterm at least one day shorter than the head lease; check the head lease and get head-landlord consent if needed; over 3 years by deed with s.22 consent; repeats the head-lease covenants.
- [ ] Templates: Tenancy Agreement, Deed of Lease, Deed of Sublease (new; lawyer to check).

### Conveyancing
- [ ] Rules: LUA ss.1, 22, 26 (Minister in the FCT); sign then apply (Awojugbagbe); pre-1978 land (Savannah Bank v Ajilo); root of title 40 years (CA) / 30 years (PCL); family land; signing; the Nigeria Tax Act 2025 (CGT is the seller's); government charges never quoted.
- [ ] Deed of Assignment template (moved over) + the 2.5% fee acceptance flow (recorded event, PRICE 0, invoiced by the firm).
- [ ] `prepare_consent_application` shared tool (used by Conveyancing, Other instruments, Tenancy for leases or subleases over 3 years).

### Other property instruments
- [ ] Deed of Gift (a gift on death → hand off to Wills).
- [ ] Legal Mortgage / Charge, with the creation method by group (CA: assignment with a proviso for reassignment, or a sub-demise; PCL: sub-demise or a charge by way of legal mortgage; Lagos MPL 2010: demise/sub-demise or charge). Consent, CAC registration within 90 days for a company, stamp and register, Lagos deposit-of-deeds rule, power-of-sale conditions.
- [ ] Power of Attorney: not a transfer (Ude v Nwara); by deed if the attorney will sign a deed; **irrevocable only if for valuable consideration and stated as irrevocable, or stated irrevocable for a fixed period of no more than 1 year**; signed before a notary abroad.
- [ ] Agreement for Sale of Land: no consent at this stage; recommend a search first (→ Searches).
- [ ] Deed of Release (new template; lawyer to check).

### Property searches and due diligence
- [ ] Standard search vs comprehensive (the list of extra checks). Collect the address, title document copy, survey plan and seller's name. Search before any money is paid; a search is not a guarantee.
- [ ] Search Instruction template (moved over). Standard ₦50,000; comprehensive from ₦100,000, quoted by a lawyer.

### Wiring
- [ ] `orchestrator.ts`: load the matter → router or area → `runAgent` → save state → return `{ response }` exactly as `/api/chat` does now.
- [ ] `/api/chat` branch behind `PROPERTY_AGENT_V2`.
- [ ] Lawyer sign-off recorded for each area's rule text and case list (name + date in the area file's header comment).

## Done when
- With the flag on locally, a client can go from the starter to a finished document in each of the 5 areas, including one hand-off.
- Unit tests for router mapping, the occupant test, and jurisdiction lookup pass.
- The old agent still works with the flag off.
