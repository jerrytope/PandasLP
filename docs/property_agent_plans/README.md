# Property Law Agent rebuild: router + 7 sub-agents

The Property Law Agent (`recovery-of-premises`) is being rebuilt from one large system prompt into a real agent system:
- a **router** sends each matter to one of **7 specialist sub-agents**
- the agents use **tools** for every exact fact (money, dates, fees, law text)
- each matter has a **saved record**, so a hand-off between sub-agents never asks the client again

Source documents (Olusegun Ayodele, 10 Oct 2026):
- `documents/Scope and applicable law.docx`: the 7 areas, the law by state, the main rules, the fees
- Schedule of Laws: the 59 laws in Parts A–F. The PDFs go in `documents/law documents/`.

Full plan: [implementation_plan.md](implementation_plan.md) · All tasks in one list: [tasks.md](tasks.md)

## Status

| Phase | File | Status |
|---|---|---|
| 0 | [Prerequisites](phase-0-prerequisites.md) | Not started |
| 1 | [Runtime, matter state, calculators, fees](phase-1-runtime-state-calculators.md) | Code done; migration not yet applied to a database |
| 2 | [Router and the 5 existing areas](phase-2-router-and-existing-areas.md) | Built behind the flag; needs a real-API run and lawyer sign-off |
| 3 | [Law library](phase-3-law-library.md) | Steps 1-2 built (tables, lookup tools, citation rule, meaning search with gte-small); web search to come |
| 4 | [Wills & probate, Land title disputes](phase-4-wills-probate-and-disputes.md) | Not started |
| 5 | [Testing and switching the live agent over](phase-5-testing-and-cutover.md) | Not started |

When a task is finished, tick it in its phase file **and** in `tasks.md`, and update this table in the same change.

## Decisions already made

| Topic | Decision |
|---|---|
| Money | Every naira figure (arrears, mesne profits, 2.5% fee, advance-rent limits) is calculated in code. The model only collects inputs and explains results. |
| Architecture | A real agent system (tool use, saved state, hand-offs), not a prompt split. |
| Law lookup | Exact section lookup + Postgres keyword search in Supabase first. The table is ready for vectors (pgvector); they are added only if testing shows misses. |
| States covered | Lagos (with the Apapa / Ikeja GRA / Ikoyi / VI exception), FCT, Oyo, Ogun, Ondo, Osun, Ekiti, Edo, Delta, **Anambra, Enugu, Cross River**. Any other state is escalated to a lawyer. |
| Governor's Consent applications | Each specialist prepares the application for its own deed, using one shared consent tool. The firm files it. |
| Deed of release | Other property instruments, ₦30,000 flat. |
| Executors' assent | Wills & probate. A later sale by the beneficiary is a new Conveyancing matter. |
| Occupant test (router) | Entered with permission → Recovery (a tenant now claiming ownership is flagged to a lawyer: tenant estoppel). No permission but claims a root of title → Land title dispute. No permission, no root (squatter, land grabber) → not covered, escalate. Family member on family land → Land title dispute. |
| Fees "to be set" | Sublease by deed, wills, probate, disputes are `null` in code. Those agents say a lawyer will confirm the fee and never show a price. |
| What clients see | Still one "Property Law Agent". `cases.agent_id` stays `recovery-of-premises`; the sub-agent is recorded separately. |
