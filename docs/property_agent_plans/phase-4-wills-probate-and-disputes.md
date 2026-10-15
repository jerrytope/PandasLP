# Phase 4: Wills & probate, Land title disputes

**Goal:** the two new, higher-risk areas. Both need stricter escalation and a lawyer's review of every template before going live. Fees stay `null` until the firm sets them.

## Files
- `lib/property/areas/willsProbate.ts`, `lib/property/areas/landDispute.ts` (new)
- Router and starter: enable the two areas

## Tasks

### Wills & probate
- [x] Rules per group with sources:
  - Wills Law of Lagos State
  - Wills Law 1958 as re-enacted (Oyo: Wills Edict 1990)
  - Wills Act 1837 / Wills Amendment Act 1852 (FCT, Anambra, Enugu, Cross River unless the state has its own Wills Law)
  - Administration of Estates Laws
  - the High Court Rules
- [x] Will formalities, built into the template and a signing instruction sheet:
  - in writing, signed by the testator
  - two witnesses present together; each signs in the testator's presence
  - a witness or their spouse cannot benefit
  - minimum age (18 Lagos, 21 under the 1837 Act)
  - sound mind
- [x] Limits, which are escalation triggers:
  - Lagos family provision claims
  - customary-law property in the western states (Idehen v Idehen)
  - a Muslim testator in a state applying Islamic law (e.g. Kaduna, though not covered yet)
- [x] Revocation rules (later will/codicil, destruction, a later Marriage Act marriage).
- [x] Probate path chooser: probate / letters of administration / LoA with the will annexed. Where to apply. Resealing a grant from another state or country. Intestacy depends on marriage type (Marriage Act → AEL shares; otherwise customary or Islamic law, which is escalated).
- [x] Templates (lawyer to check): Will, Codicil, a probate / LoA application document checklist and papers, Assent.
- [x] Hand-off: land passing to a beneficiary who then sells → a new Conveyancing matter. Gift on death from Other instruments arrives here.
- [x] Fees: `will`, `codicil`, `probate` stay `null` until set.

### Land title disputes (brief only)
- [x] Scope: disputed ownership, declaration of title, trespass, injunction, double sales, boundaries, possession from a rival claimant. **Never drafts court papers.** The output is a structured brief for the firm's litigation lawyer.
- [x] Rules:
  - five ways to prove title (Idundun v Okumagba)
  - win on the strength of your own case (Kodilinye v Odu)
  - which court: State High Court; customary and area courts for customary rights of occupancy; never the Federal High Court (LUA ss.39, 41)
  - limitation (generally 12 years; the state's Limitation Law decides)
  - trespass protects possession
  - double sales (earlier buyer; registered deed priority; receipt + possession = equitable interest)
  - land under litigation (lis pendens)
  - remedies
  - Lagos Properties Protection Law 2016
- [x] Intake: how the client got title (which of the five ways), documents, possession history, the other side's claim, any court case or police report, dates (for limitation), family-land details.
- [x] Flags in the brief: a possible limitation problem, a pending case, a land grabber (Lagos PPL), urgent injunction need.
- [x] Template: Lawyer Brief (facts, documents held, title route claimed, other side's claim, issues, remedies to consider, limitation note, urgency).
- [x] Fee: `disputeBrief` stays `null` until set.

### Shared
- [ ] Lawyer sign-off on both areas' rules, templates and case lists (name + date in each area file).
- [x] Router: the occupant test now routes to Dispute instead of escalating.

## Done when
- Each new area completes its main flow locally with the flag on.
- Escalation triggers fire in the test scenarios.
- No price is shown while fees are `null`.

## Progress notes (15 Oct 2026)

Built and unit-tested (`npm test` 481 passed, no API calls; `npx tsc --noEmit` clean). **Not yet run against any model**, and the rules were written from this plan's summary (the scope document is still not in the repo). Every rule, template and case list needs the lawyer's review: these are the highest-risk areas.

- **Both areas are live** (`lib/property/areas/willsProbate.ts`, `landDispute.ts`): the starter buttons route to them, the router's occupant test sends rival claimants and family-land disputes to Land disputes, Recovery can hand a rival claimant over, and Other instruments can hand a gift on death to Wills.
- **Exact answers in code** (`lib/property/estate.ts`, tools in `lib/property/tools/estateTools.ts`):
  - `choose_probate_path`: will + executors able → probate; will without them → letters of administration with the will annexed; no will after a Marriage Act marriage → letters of administration (shares by the Administration of Estates Law, not worked out by the agent); no will otherwise, or a Muslim deceased → escalate; a grant made elsewhere → reseal. Returns where to apply and the documents.
  - `check_limitation`: whole years since possession was lost, against the general 12 years, flagged `possible-limitation-bar` / `close-to-limit` / `within-time`.
- **Templates** (`lib/property/templatesNew.ts`, all new): Will, Codicil, the signing instructions (given in the message, not a document), the probate / administration application letter with its schedule, the Executors' Assent, and the Lawyer Brief for disputes. Fees stay null: each is emitted at PRICE 0 with "a lawyer will confirm the fee".
- **Escalation triggers** (Wills): a Muslim testator or deceased; family or customary-law property (the Benin Igiogbe, Idehen v Idehen); a Lagos will leaving out a spouse or dependent child; doubtful capacity, under-age or pressured testator; a testator living abroad; intestacy outside a Marriage Act marriage. (Disputes): violence or threats, building or demolition happening now, a court date within days.
- **For the lawyer to confirm** (also in code comments): the minimum age to make a will in the Western states and in Anambra, Enugu and Cross River (the plan gives 18 for Lagos and 21 under the Wills Act 1837; the agent escalates under-21s there for now); whether Anambra, Enugu or Cross River have their own Wills Law; and whether an Executors' Assent needs the Governor's consent in each state (the template only says the firm handles stamping and registration).
- **Scenarios added** to `scripts/property-scenarios.ts` (27 to 31: a will, an estate with no will after a church wedding, a customary intestacy, a double-sale dispute, an urgent dispute), not yet run.
