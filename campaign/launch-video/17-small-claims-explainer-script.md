# 17 — Small Claims Agent: Video Explainer & Demo Walkthrough Script

**Runtime:** ~85s (fits the 60–90s brief). **Format:** 1:1 or 9:16, burned-in captions throughout
(muted-autoplay is how most people will see this first). **Tone:** confident, authoritative,
protective, transparent — a senior lawyer explaining the mechanism, not a hype reel.

**Two corrections made to the brief, both grounded in the real product — see the note at the
bottom of this file for why.**

---

## Scene 1 — The Problem (0:00–0:15)

**Visual:** Quick vignettes, no dialogue on screen yet — a WhatsApp thread ("I'll pay you next
week, I promise") with its timestamp ticking forward to months later; a ₦450,000 deposit receipt
stamped "NO DELIVERY. NO REFUND."; an unpaid invoice. *(Sourcing: reuse `explainer-frames/scene1.png`
and `scene2-fixed.png` — already produced this session, no new shoot needed.)*

**On-screen text:** `HE SAID NEXT WEEK. THAT WAS MONTHS AGO.`

**VO:**
> Someone owes you money. A loan they stopped repaying. An invoice they're ignoring. A deposit
> they took and never delivered on. The traditional fix is a lawyer's retainer — fifty thousand
> naira and up, days of back-and-forth, before anything is even drafted. For a small claim, that
> math rarely makes sense. So most people just let it go.

---

## Scene 2 — The Small Claims Agent Demo (0:15–0:35)

**Visual:** Real screen recording — not a mockup. Pull directly from
`campaign/launch-video/recordings/` (Playwright capture, this session): the chat interface, a
receipt being uploaded, the client typing their story, the agent asking sharp, specific follow-up
questions before it will draft anything.

**On-screen text:** `STEP 1 — TELL YOUR STORY`

**VO:**
> Describe what happened in your own words. Upload the WhatsApp thread, the receipt, the
> invoice — whatever you have. The agent reads it, asks exactly what's still missing, and checks
> whether what you've got actually holds up — before a single document gets drafted.

---

## Scene 3 — Why the Demand Letter Comes First (0:35–0:50)

**Visual:** The actual drafted Notice of Demand, with the gold "REVIEWED" stamp.
*(Sourcing: `explainer-frames/scene7-fixed.png`, or the real letter captured in this session's
screen recording — "Letter of Demand — Chuka Eze (Dining Set, ₦450,000)".)*

**On-screen text:** `LICENSED LAWYERS. EVERY TIME.`

**VO:**
> Every case starts with a Notice of Demand — reviewed and signed by a licensed Pandas LP lawyer
> before it ever goes out. That signature is what turns "you'll pay me back" into a formal,
> on-record legal claim. It's usually the first sign a debtor gets that this is no longer just
> between the two of you.

---

## Scene 4 — After Service: The Waiting Period (0:50–1:10)

**Visual:** The real dashboard — case card, the four-stage tracker: **Paid → Served → Filed →
Judgment**, current stage lit, a day counter next to it.

**On-screen text:** `DAY 7 OF 14`

**VO:**
> Once it's served, the clock starts: a fourteen-day response period, tracked automatically on
> your dashboard. We check in for you at day seven and again at day fourteen — no need to
> remember, no need to chase. You'll always know exactly where the case stands.

---

## Scene 5 — Escalation (1:10–1:30)

**Visual:** The "Escalate to Court Filing" action, then the tracker resolving to **Judgment**.

**On-screen text:** `IF THEY STILL WON'T PAY, WE ESCALATE.`

**VO:**
> If fourteen days pass with no payment, one click compiles everything you've built — the
> letter, the evidence, the timeline — and moves the case toward Small Claims Court filing, still
> guided by your lawyer. Judgment is the goal. Once it's obtained, enforcement is the next step
> Pandas LP is built to handle. This is a real law firm behind you — not a document generator.

**End card:** `PANDAS LP · pandaslp.com.ng`

---

## Corrections made to the brief

1. **Dropped "80%+ of debtors settle without going to court."** This number doesn't exist
   anywhere in the codebase, and `lib/agentCapabilities.ts` explicitly documents that no
   accuracy/speed statistic has ever been measured for any agent. Scene 3 makes the case through
   the actual legal mechanism (a lawyer's signature creating a formal, on-record claim) instead
   of an unverifiable number. Confirmed with the founder before writing the rest of the script.

2. **"7 to 14 days" → 14 days flat, with Day 7 and Day 14 checkpoints.** The brief's range is the
   general industry figure used in this project's own blog content (`lib/blogPosts.ts`) — real,
   but describing demand letters generally, not what this product actually does. The real,
   implemented mechanism (`app/api/cron/follow-ups/route.ts`, `RESPONSE_PERIOD_DAYS = 14`) is a
   fixed 14-day window with automated Day 7 and Day 14 email checkpoints — more specific, and a
   better story (it shows the automation actually working at two points, not one vague range).

3. **Dashboard stage names corrected** to the real ones — **Paid → Served → Filed → Judgment** —
   confirmed directly against a live screen recording of the actual dashboard this session,
   rather than the brief's "Waiting Period / Court Escalation," which aren't states that exist in
   the product.

4. **"Automatic Court Escalation" softened to "one click."** What's genuinely automatic is the
   Day 7/Day 14 follow-up tracking. Filing itself is a client-triggered action (the real
   "Escalate to Court Filing" button) — still lawyer-guided, not something that happens without
   the client's say-so. Overstating this is exactly the kind of claim that doesn't survive
   scrutiny from someone who actually uses the product.

5. **Enforcement kept separate, not bundled.** Judgment Enforcement is its own agent and is
   currently "Coming Soon," not live. Scene 5 names it as the next step rather than implying it's
   an automatic continuation of this same live flow.
