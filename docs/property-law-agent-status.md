# Property Law Agent rebuild: status report

**Date:** 16 October 2026
**Plan:** [`docs/property_agent_plans/`](property_agent_plans/README.md) (phase files and task list)

## Summary

The Property Law Agent is being rebuilt from one large prompt into an agent system: a **router** sends each matter to one of **7 specialist areas**, every naira figure and date is **worked out in code** (never by the AI), every matter has a **saved record**, and the agents can **look up the actual text of the law**.

- **The code for all the build phases (1 to 4) is done.** 489 automated tests pass and the type check is clean.
- **It is not live.** It sits behind a switch (`NEXT_PUBLIC_PROPERTY_AGENT_V2`); with the switch off, the current agent runs unchanged.
- **What blocks launch is not code:** an Anthropic API key, running 4 SQL files on Supabase, and the lawyer's review of the legal content.

| Phase | What | Status |
|---|---|---|
| 0 | Prerequisites (law documents, lawyer sign-off, fees) | Partly done: the legal team sent a law library file instead of PDFs; sign-off and fees still open |
| 1 | Tool support for the AI, saved matter record, calculators, fees in code | Built |
| 2 | Router and the 5 existing areas | Built |
| 3 | Law library: look-up, meaning search, web search fallback | Built |
| 4 | Wills & probate, Land title disputes | Built |
| 5 | Testing on Claude and switching over | Started: tested on a substitute AI; Claude testing waits for the API key |

## What has been built

### How a conversation works now
1. The client picks one of 7 areas from buttons (or types freely and a small AI model sorts it). A squatter or land-grabber case, or a client who wants to skip Governor's Consent, is sent straight to a lawyer.
2. The client picks the state (12 states covered: Lagos, FCT, Oyo, Ogun, Ondo, Osun, Ekiti, Edo, Delta, Anambra, Enugu, Cross River). For Lagos, the area too, because Ikoyi, VI, Apapa and Ikeja GRA are under different law. Any other state goes to a lawyer.
3. That area's specialist interviews the client, using tools for every exact fact, and produces the document.
4. If the matter belongs elsewhere (e.g. a "gift" that is really a sale), it is handed to the right area in the same turn, carrying everything already said.

### The 7 areas
| Area | Documents |
|---|---|
| Recovery of premises | Notice to Quit, Seven Days' Notice, rent demand letter |
| Tenancy, lease, sublease | Tenancy Agreement, Deed of Lease, Sublease Agreement, Deed of Sublease, Governor's Consent application |
| Conveyancing | Deed of Assignment (2.5% fee, client must accept first), consent application |
| Other instruments | Deed of Gift, Legal Mortgage, Power of Attorney, Agreement for Sale, Deed of Release, consent application |
| Searches | Search instruction (standard search; comprehensive goes to a lawyer) |
| Wills & probate | Will, Codicil, probate/administration application, Executors' Assent |
| Land title disputes | A brief for the litigation lawyer (never court papers) |

### Safeguards built in code (not left to the AI)
- **Calculators** for arrears, mesne profits, Notice to Quit periods and quit dates (including the yearly anniversary rule, expired fixed terms, and Lagos's arrears rule), Seven Days' Notice dates, Lagos advance-rent limits, the 2.5% fee, completion dates and balances, which grant an estate needs, and land limitation periods.
- **Prices come only from code.** The AI cannot set a price; a fee not yet agreed shows "a Pandas LP lawyer will confirm the fee".
- **Documents are checked before the client sees them:** no unfilled blanks, the right area, the right price, the 2.5% fee accepted first, no vague Power of Attorney ("to manage my property"), and no section of a law cited unless it was actually looked up.
- **Replies are checked:** if the AI types a document or a tool call into its message instead of using the tool, it is made to redo the turn; if it tells a client "a lawyer will contact you" without escalating, the system escalates for real.
- **Lawyer queue:** an escalated matter, or a document nothing is paid for online (transfer deeds, wills, dispute briefs...), emails the firm's inbox and appears in Admin → Action Queue, where staff take it, return it to the agent, or close it. (Before this, these were invisible to staff, in the old agent too.)

### The law library
- The legal team sent a database file with the text of **6 laws** (Land Use Act, Lagos Tenancy Law 2011, and four federal land laws; 239 sections) and **9 more listed but not yet sourced**. It is loaded as-is.
- The agents look up the exact section (`get_section`) or search by meaning (`lookup_law`). We identified the model that produced the file's search vectors (**gte-small**) and run the same model inside our server: no API cost per search.
- **Search quality:** on 21 client-style questions, meaning search finds the right section in its top 3 for 15/21, keyword search 8/21.
- **Web search fallback** for laws not in the library: only trusted law sites, results marked unverified, never cited in a document, every search logged for the lawyer. Switches on with a Tavily API key.
- **It has already caught an error:** Lagos Tenancy Law s.13(4) says notices to yearly tenants need not end on the tenancy anniversary; our calculator had applied that rule in Lagos. Fixed (pending the lawyer's confirmation).

### Testing so far
- **489 automated tests**, run with no AI cost.
- **A test harness** that runs the agent locally (SQLite instead of Supabase, Groq instead of Claude): `npm run property:chat` to chat, `npm run property:scenarios` to run the test plan.
- **The test plan** (19 original scenarios plus 12 new ones) was run twice on Groq's model:

  | Run | Pass | Partial | Fail / stalled |
  |---|---|---|---|
  | 1 | 11 | 5 | 8 (+2 errors) |
  | 2 (after fixes) | 20 | 6 | 0 |

  The partials are small (e.g. a deed dated today instead of left blank, "signature" instead of "thumbprint" for an illiterate party). Results are logged in [`docs/property-law-agent-test-plan.md`](property-law-agent-test-plan.md). **Groq is a substitute: these runs prove the plumbing, not Claude's legal drafting quality.**

## What still needs to be done

### Blockers (outside the code)
| Item | Who | Why it matters |
|---|---|---|
| Anthropic API key | Team | Needed to test on Claude and to run in production |
| Run 4 SQL files on Supabase, in order: `add-property-matters.sql`, `add-law-library.sql`, `docs/pandaslp-law-library-seed.sql`, `add-property-lawyer-queue.sql` | Team | The new agent's tables don't exist until then |
| Lawyer review and sign-off of every area's rules and templates (all marked "pending sign-off") | Lawyer | Legal correctness; wills and disputes are the highest risk |
| Server can reach huggingface.co once (to download the search model) | Team / hosting | Law search falls back to keywords without it |

### Decisions needed
**From the lawyer:**
- Confirm Lagos s.13(4): no anniversary rule for Lagos yearly notices.
- Confirm arrears for a yearly tenant are the full year (rent is paid in advance), not pro-rated.
- Minimum age to make a will outside Lagos; whether Anambra, Enugu or Cross River have their own Wills Law.
- Whether an Executors' Assent needs Governor's Consent; the root-of-title period in Lagos.
- Approve the trusted web-search sites (in `lib/property/webSearch.ts`).
- Send the remaining law texts (about 53 of the 59 scheduled laws are not in the library yet).

**From the business:**
- Fees not yet set: deed of sublease, will, codicil, probate papers, assent, dispute brief, consent application.
- A Tavily API key (web search; free tier available).

### Remaining work (once the blockers are cleared)
1. Run all 31 scenarios on Claude; check prompt caching and compare cost with the current agent.
2. Lawyer grades the results.
3. Browser end-to-end test: a full matter, a hand-off, the 2.5% fee flow, and the Action Queue screen.
4. Re-check the 6 partial scenarios on Claude.
5. Switch on in production; watch the first live matters.
6. After a stable period: remove the old prompt and the switch; update `CLAUDE.md`, the agent description and marketing copy (7 areas).

### Small improvements available now (no keys needed)
- Show a property matter's details (area, state, saved facts, history) in the admin case drawer.

## Risks
- **Legal content is unreviewed.** Rules were written from the plan and the current prompt; the scope document they should be checked against is not in the repo.
- **Not yet run on Claude.** Behaviour on Groq was good after fixes, but Claude must be tested before launch.
- **Thin law library.** Only 6 laws have text; the rest rely on the agents' rules and web search, which is unverified.
- **Hosting:** the search model download needs outbound internet and a writable cache path (or packaging the model with the deployment).

## Where to look
- Plan and per-phase progress: `docs/property_agent_plans/`
- Test plan and results: `docs/property-law-agent-test-plan.md`
- Code: `lib/property/` (areas, tools, calculators, law library), `lib/agentRuntime/` (tool loop), `app/api/chat/route.ts` (entry point)
- Developer notes: `CLAUDE.md`, section "Property Law Agent rebuild"
