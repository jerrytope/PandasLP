# PRD: PandaDocument — the AI agent platform behind Pandas LP

**Status:** Draft v1 — strategic direction, not yet reviewed/approved
**Owner:** [Founder Name]
**Last updated:** 1 August 2026

> **Framing note:** this PRD treats "PandaDocument" as the underlying AI agent/document
> platform that Pandas LP is built on top of — the six agents already live today
> (`small-claims`, `recovery-of-premises`, `contracts`, `cac-registration`,
> `judgment-enforcement`, `lawyer-consultation`) are PandaDocument's first releases, not a
> separate product. If "PandaDocument" was meant as something distinct from Pandas LP, tell me
> and I'll re-scope this — everything below assumes it's the platform layer underneath what's
> already shipped.

---

## 1. Vision

**A Nigeria where trust between two people making a deal doesn't depend on how much money or
patience either of them has.**

Right now, whether an agreement gets honored — a debt gets paid, a tenant gets their deposit
back, a vendor delivers what was paid for — often comes down to whether the wronged party can
afford ₦50,000 and three weeks of waiting to make it matter. Most people can't, so most broken
promises just stay broken. That absorbed loss doesn't disappear; it becomes the next person who
won't do business on trust alone, the next handshake deal nobody believes in.

PandaDocument exists to close that gap — not by making law cheaper as an act of charity, but
because a country where agreements are actually enforceable is one where people can trust each
other's word again, and an economy runs on that trust.

## 2. Mission

Pair AI-driven intake with licensed Nigerian lawyers so that acting on a broken agreement — a
letter, a filing, an enforcement action — takes minutes and costs a fraction of the traditional
route, without cutting the licensed-lawyer review that makes the output real and enforceable.

## 3. What PandaDocument actually is

A platform of narrow, specialized **AI agents**, where each agent:
1. Runs the exact intake interview a senior lawyer would run for one specific situation (plain
   English, ~10 minutes)
2. Drafts a court-ready document from that interview
3. Routes the draft to a licensed lawyer for review, sign-off, and (where applicable) service —
   no client ever receives an unreviewed document
4. Is priced transparently, shown before payment, with the actual drafted document visible
   (watermarked) before the client pays anything

This is the one architectural principle that doesn't move as the agent catalog grows: **AI
drafts, a licensed human reviews and releases.** That's not a disclaimer bolted on for
liability — it's the actual design, and it's what makes "AI-native" compatible with "real law
firm" instead of a contradiction.

## 4. Current state (v1 — shipped)

| Agent | Handles | Price |
|---|---|---|
| Small Claims Court Agent | Debt recovery via demand letter → court | ₦10,000 (self-serve) / ₦25,000 (served) |
| Recovery of Premises Agent | Landlord recovering property from a tenant | ₦5,000 |
| Contracts & Commercial Agent | Drafting NDAs, service agreements, MoUs, etc. | ₦5,000 |
| CAC Registration Agent | Business name / company registration | ₦15,000 |
| Judgment Enforcement Agent | Garnishee orders, Writs of Execution | ₦10,000 + 5% of judgment |
| Lawyer Consultation Agent | Direct consultation booking | ₦15,000 |

All six are live in production as of this document. Payments run through Paystack (live keys as
of this week), email/reminder infrastructure is wired, and the mandatory-review gate shipped
recently — no case reaches a client without a named reviewer's sign-off first.

## 5. Problem statement

Three groups keep showing up in the same trap, for the same underlying reason:

- **People owed money** who can't justify a ₦50,000 retainer to chase a ₦450,000 debt, so they
  don't, and the debtor learns that not paying has no real cost.
- **SMEs and individuals who paid for goods that were never delivered**, then get handed store
  credit instead of a refund and told that's final — because until now, disputing it meant the
  same unaffordable legal process.
- **Landlords and tenants** with no fast, credible way to enforce the terms either side actually
  agreed to.

In every case, the actual legal right usually already exists. What's missing is a way to act on
it that costs less than the thing being recovered and takes less time than most people are
willing to spend being angry about it.

## 6. Goals

**Primary (next 2 quarters):**
- Prove the mandatory-review model holds up at real volume without becoming a staffing
  bottleneck (this is the thing most likely to break first as case volume grows)
- Get the first agent category beyond debt recovery to real product-market fit, not just a launch
  spike
- Build a repeatable process for shipping a new agent (intake design → template library → review
  SOP) instead of hand-crafting each one from scratch

**Secondary:**
- Attribution/funnel clarity — which channel actually produces paid cases, not just traffic
  (already instrumented via `lib/attribution.ts`; needs a real dashboard, not ad hoc SQL)
- Reduce time-to-review so "AI drafts in 10 minutes" isn't followed by a multi-day wait for the
  human half

## 7. Proposed next agents (for discussion, not committed)

Picking the next 2–3 agents should follow the same test every existing one already passes: *is
there a real right being routinely ignored because enforcing it is currently too expensive or
slow for the amount at stake?* Candidates that pass that test:

- **Vendor Non-Delivery / Refund Agent** — the exact SME scam pattern from the pre-launch
  anticipation thread (`campaign/launch-video/11-...`): payment taken, goods never delivered,
  refund refused in favor of forced store credit. Same shape as small-claims but a distinct
  enough intake (evidence is usually a payment receipt + a promise, not an existing debt) to
  warrant its own agent rather than folding into small-claims.
- **Unpaid Wages / Wrongful Termination Agent** — employment disputes follow a very similar
  demand-letter-first shape, and the "can't afford a lawyer for a ₦200,000 unpaid salary" gap is
  at least as common as the debt-recovery one.
- **Tenant-Side Deposit Recovery Agent** — `recovery-of-premises` already serves landlords;
  tenants whose deposits get withheld on move-out have no equivalent today, and it's the same
  underlying relationship viewed from the other side.
- **Freelancer/Contractor Non-Payment Agent** — gig and contract work in Nigeria has grown faster
  than any dispute-resolution option for it; largely the same shape as small-claims with
  different evidence norms (invoices, scope-of-work messages, delivered files/screenshots).

Whichever ships next, the sequencing rule should be: **don't add a fourth intake shape until
the review team can handle the existing three at real volume** — the bottleneck is never going
to be drafting, it's always going to be licensed-human throughput.

## 8. Non-negotiables (product principles)

- No document ever reaches a client without a licensed lawyer's review and sign-off. This does
  not get relaxed for speed, cost, or scale.
- The client sees the actual drafted document (watermarked) before paying — never a sample,
  never a template preview.
- Pricing is shown in full before payment; no surprise fees after the fact.
- Every agent stays scoped to what it can respond to accurately. An agent that doesn't know
  something says so and redirects to a lawyer consultation — it does not guess.
- "AI-native" is never allowed to read as "not a real law firm." Every piece of copy, every
  agent interaction, is written to make that distinction disappear, not paper over it.

## 9. Non-goals

- **Not a general legal-advice chatbot.** Each agent is scoped to one workflow; PandaDocument
  does not attempt to answer arbitrary legal questions outside an agent's specific intake.
- **Not pursuing criminal law, family law, or immigration** in this phase — the agent model
  (fast document, low stakes-per-case, high volume of similar situations) fits commercial/civil
  disputes; it doesn't obviously fit those categories yet.
- **Not removing the human review step to cut cost**, even under growth pressure. If review
  throughput becomes the bottleneck, the fix is hiring/process, not removing the gate.

## 10. Success metrics

| Metric | What it actually tells us |
|---|---|
| Paid cases per agent, per month | Which categories have real demand vs. launch novelty |
| Time from payment to reviewed-and-released | Whether the review gate is scaling with volume |
| Repeat use rate (client returns for a second case, any agent) | Real trust built, not just a one-time transaction |
| % of cases where the client never has to contact a human before payment | Whether the AI intake is actually doing its job |
| Cost-to-serve per case vs. traditional-lawyer baseline (₦50,000+) | Whether the core "from ₦10,000" promise is holding as agents diversify |

## 11. Open questions

- Does a new agent category need its own pricing logic, or does the existing
  `lib/agentServiceMap.ts` pattern extend cleanly? (Likely yes for most candidates in §7, but
  Judgment Enforcement's percentage-of-recovery pricing suggests not every agent fits a flat fee.)
- At what case volume does review become the real constraint, and what's the hiring plan before
  that happens rather than after?
- Should agent expansion be sequenced by "closest to existing legal-team expertise" or by
  "biggest addressable pain point"? §7 is ordered by the second; worth explicitly deciding which
  the team is actually optimizing for.
