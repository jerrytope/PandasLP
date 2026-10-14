# Phase 4: Wills & probate, Land title disputes

**Goal:** the two new, higher-risk areas. Both need stricter escalation and a lawyer's review of every template before going live. Fees stay `null` until the firm sets them.

## Files
- `lib/property/areas/willsProbate.ts`, `lib/property/areas/landDispute.ts` (new)
- Router and starter: enable the two areas

## Tasks

### Wills & probate
- [ ] Rules per group with sources:
  - Wills Law of Lagos State
  - Wills Law 1958 as re-enacted (Oyo: Wills Edict 1990)
  - Wills Act 1837 / Wills Amendment Act 1852 (FCT, Anambra, Enugu, Cross River unless the state has its own Wills Law)
  - Administration of Estates Laws
  - the High Court Rules
- [ ] Will formalities, built into the template and a signing instruction sheet:
  - in writing, signed by the testator
  - two witnesses present together; each signs in the testator's presence
  - a witness or their spouse cannot benefit
  - minimum age (18 Lagos, 21 under the 1837 Act)
  - sound mind
- [ ] Limits, which are escalation triggers:
  - Lagos family provision claims
  - customary-law property in the western states (Idehen v Idehen)
  - a Muslim testator in a state applying Islamic law (e.g. Kaduna, though not covered yet)
- [ ] Revocation rules (later will/codicil, destruction, a later Marriage Act marriage).
- [ ] Probate path chooser: probate / letters of administration / LoA with the will annexed. Where to apply. Resealing a grant from another state or country. Intestacy depends on marriage type (Marriage Act → AEL shares; otherwise customary or Islamic law, which is escalated).
- [ ] Templates (lawyer to check): Will, Codicil, a probate / LoA application document checklist and papers, Assent.
- [ ] Hand-off: land passing to a beneficiary who then sells → a new Conveyancing matter. Gift on death from Other instruments arrives here.
- [ ] Fees: `will`, `codicil`, `probate` stay `null` until set.

### Land title disputes (brief only)
- [ ] Scope: disputed ownership, declaration of title, trespass, injunction, double sales, boundaries, possession from a rival claimant. **Never drafts court papers.** The output is a structured brief for the firm's litigation lawyer.
- [ ] Rules:
  - five ways to prove title (Idundun v Okumagba)
  - win on the strength of your own case (Kodilinye v Odu)
  - which court: State High Court; customary and area courts for customary rights of occupancy; never the Federal High Court (LUA ss.39, 41)
  - limitation (generally 12 years; the state's Limitation Law decides)
  - trespass protects possession
  - double sales (earlier buyer; registered deed priority; receipt + possession = equitable interest)
  - land under litigation (lis pendens)
  - remedies
  - Lagos Properties Protection Law 2016
- [ ] Intake: how the client got title (which of the five ways), documents, possession history, the other side's claim, any court case or police report, dates (for limitation), family-land details.
- [ ] Flags in the brief: a possible limitation problem, a pending case, a land grabber (Lagos PPL), urgent injunction need.
- [ ] Template: Lawyer Brief (facts, documents held, title route claimed, other side's claim, issues, remedies to consider, limitation note, urgency).
- [ ] Fee: `disputeBrief` stays `null` until set.

### Shared
- [ ] Lawyer sign-off on both areas' rules, templates and case lists (name + date in each area file).
- [ ] Router: the occupant test now routes to Dispute instead of escalating.

## Done when
- Each new area completes its main flow locally with the flag on.
- Escalation triggers fire in the test scenarios.
- No price is shown while fees are `null`.
