# Phase 0: Prerequisites

**Goal:** everything the build depends on but which isn't code.

## Tasks
- [ ] Fix the Claude Code shell error (`EPERM` writing to `AppData\Local\Temp\claude\...\tasks`): restart Claude Code; if it persists, add `C:\Users\HP\AppData\Local\Temp\claude` to Windows Defender exclusions. Needed for tests, migrations and PDF ingestion.
- [ ] Create `documents/law documents/` with the sub-folders `nationwide/`, `english-statutes/`, `lagos/`, `fct/`, `western/<state>/` (Oyo, Ogun, Ondo, Osun, Ekiti, Edo, Delta), `north-east/anambra/`, `north-east/enugu/`, `north-east/cross-river/`.
- [ ] Download the PDFs for laws 1–59 (Part F only for Anambra, Enugu, Cross River). Name each file `<law no.> - <short title>.pdf`, e.g. `21 - Lagos Tenancy Law 2011.pdf`. Check the title, chapter and year against each state's current edition.
- [ ] Note any law that could not be found (e.g. the Lagos Tenancy and Recovery of Premises Bill 2025 is still a bill; skip it).
- [ ] Agree who signs off the rule texts (Layer 1) and the citable-case lists: Olusegun or another firm lawyer. Sign-off happens per area in Phases 2 and 4.
- [ ] Decide the fees still "to be set": sublease by deed, will, codicil, probate / letters of administration papers, dispute brief. Until decided they stay `null` (no price shown).
- [ ] Copy the two source documents (Scope, Schedule of Laws) into `documents/` as text or PDF too, so agents and tools can read them without Word.

## Done when
- Shell commands run in Claude Code.
- The law folders exist, and at least the Lagos, FCT and nationwide PDFs are in.
- A named reviewer has agreed to sign off the rule texts.
