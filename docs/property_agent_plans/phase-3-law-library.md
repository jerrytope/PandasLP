# Phase 3: Law library (Layer 2)

**Goal:** the agents can fetch the exact text of a law section when they need to quote or rely on it, instead of answering from memory or searching the web.

Search approach (decided): **exact lookup + Postgres keyword search** first. Vectors (pgvector) only if testing shows misses.

## Files
- `documents/law documents/manifest.json` (new)
- `scripts/law-ingest.mjs` (new) + `npm run laws:ingest`
- `add-law-library.sql` + copy in `supabase/migrations/`
- `lib/property/tools/lawLookup.ts` (new)

## Tasks

### Manifest
- [ ] `manifest.json`, one entry per law (1–59, minus any not obtained): `lawNo`, `title`, `file`, `jurisdictions` (states or "all"), `areas` (which sub-agents use it), `edition`, `sourceUrl`, `checkedBy`, `checkedAt`.
- [ ] Rules: Part B applies to the FCT, Anambra, Enugu, Cross River, and Lagos only where no Lagos law replaces it. Part E is per western state (each state's own file).

### Ingestion
- [ ] Extract text from each PDF; detect scanned pages (little or no text) and run OCR on them.
- [ ] Split by section (`Section 22`, `22.`, `s. 22`, plus Part/Schedule headings). Keep the heading and the section number.
- [ ] Quality report (`documents/law documents/ingest-report.md`): per law, the page count, OCR pages, sections found, and suspicious pages (too short, garbled characters).
- [ ] Load idempotently: re-running a law replaces its sections.
- [ ] Human spot-check of key sections: LUA s.22/s.26; Lagos Tenancy Law s.13; FCT Recovery of Premises Act ss.7–9; Wills Law signing formalities; PCL mortgage sections; CAMA signing of deeds.

### Tables
- [ ] `law_documents` (law_no PK, title, jurisdictions[], areas[], edition, file, checked_by, checked_at).
- [ ] `law_sections` (id, law_no FK, section, heading, text, jurisdictions[], areas[], `tsv tsvector` generated from heading + text, GIN index). Leave room for an `embedding vector` column later.
- [ ] Service role only. No browser access.

### Tools
- [ ] `get_section({ law, section })`: exact. `law` accepts the number or a known short name (e.g. "Land Use Act").
- [ ] `lookup_law({ query, limit })`: `websearch_to_tsquery` + `ts_rank`, filtered to the matter's state and area. Returns the law, section, heading and an excerpt (capped length, to control tokens).
- [ ] Citation rule enforced in the shared prompt, and checked in `emit_document`: any "section N of <law>" in a document must have been returned by a tool in this conversation; otherwise the document is rejected back to the agent.
- [ ] The Fair Market Value schedule (no. 38) is excluded from agent tools (internal only).

### Evaluation
- [ ] 10 real client-style questions per area. Record whether the right section was in the top 3 results. If misses keep happening, write it up and add vectors (separate task, needs an embeddings provider).

## Done when
- The Lagos, FCT and nationwide laws are loaded and spot-checked.
- The tools return correct sections for the evaluation set.
- A document citing an unfetched section is rejected.
