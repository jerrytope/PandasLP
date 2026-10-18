# /manageai: the lead lawyer decides how the agents draft

**Why:** the agents' legal content was written by developers and has never been signed off. The lead lawyer knows the law better, so he decides how each agent drafts its letters, deeds and forms, without waiting for a code change.

**Agreed (18 Oct 2026):**
- Only the owner and the lead lawyer can open `/manageai` (`AI_MANAGER_EMAILS`, comma-separated). Both can do everything: edit, publish, restore, sign off.
- He can read real client conversations there.
- The scope is how documents are drafted, for all 6 agents, with Small Claims and Property first. How the agent talks to clients during the interview is not part of it.
- No email when someone publishes (the two work together).
- **Versions are permanent.** A new change never deletes an old one: every publish is a new version, restoring an old one publishes a copy of it, and the database refuses to change or delete any version.

## Status

| Stage | What | Status |
|---|---|---|
| 1 | Plain-English drafting instructions per agent and property area; draft, test chat, publish; permanent versions and restore; sign-off; real conversations | Built 18 Oct 2026. Tested locally (unit, database and a real test chat); not yet clicked through by the lead lawyer |
| 2 | Edit the document templates themselves, with checks that the blanks the app needs are still there | Not started |
| 3 | AI helper: he writes a correction, Claude shows it as a before and after | Not started |

## Stage 1 checklist
- [x] `add-agent-instructions.sql`: versions (permanent), drafts, sign-offs, `publish_agent_instructions()`
- [x] `AI_MANAGER_EMAILS` and `requireAiManager()` (`lib/adminAuth.ts`)
- [x] Instructions added after the code's instructions, for every agent: chat, property areas, document regeneration, brand letters
- [x] Falls back to the code's instructions if the database can't be read
- [x] API: list, detail, draft (autosaved), publish (with a note), restore, sign-off
- [x] Test chat with the draft (nothing saved; property runs on a practice matter)
- [x] Real conversations: list per agent, transcript, document, property facts, "write a correction from this case"
- [x] Tests: `agentInstructionTargets.test.ts`, `agentInstructions.integration.test.ts`
- [ ] Run `add-agent-instructions.sql` on the live Supabase, and set `AI_MANAGER_EMAILS` on the server, when this branch goes live
- [ ] The lead lawyer gets an account and his email is added to `AI_MANAGER_EMAILS`
- [ ] The lead lawyer tries it and says what's missing

## Stage 2 notes (for later)
- The 5 older agents keep their templates inside one long prompt in `lib/agents.ts`. They need moving into named pieces first, as the property agent already does (`template()` in `lib/property/templates.ts`), with tests confirming the prompt comes out identical.
- Before a template is published: every `[PLACEHOLDER]` and `{{REF_NUMBER}}` the code needs is still there, no `<<<DOCUMENT>>>` or `TEMPLATE START/END` markers, not empty.

## Stage 3 notes (for later)
- A correction about a calculation (notice periods, rent limits, fees) can't be made here. The helper should say so and pass it to the developer.
