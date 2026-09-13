# 16 — Full Product Demo: Recording Guide

**What this is:** a single continuous screen recording of the real product — site → sign in →
agent interview → letter generated → payment → dashboard review → Gmail confirmation. Not the
stylized brand-film cutaways in file 07 — a straight, honest product demo, the kind you'd show
an investor to prove the thing actually works.

**Why Claude isn't recording this directly:** this session has no browser-automation or
screen-recording tool available — no way to click, type, or capture video. Everything below is
written so you (or whoever has real login/payment access) can record it in one sitting.

**Record on production**, `pandaslp.com.ng` — local `.env.local` has placeholder Supabase/Paystack
keys, so localhost can't complete a real sign-in or payment.

---

## Before you hit record

1. **Recorder:** OBS (free, 60fps) or Windows Game Bar (Win+Alt+R). Browser window only, no
   bookmarks bar, a clean profile with no extensions visible.
2. **Browser zoom 125–150%** so text reads clearly if this ever gets cut down to 1080p/vertical.
3. **Have a real inbox ready** — sign-in is a magic link (no password), so you need to actually
   receive and click that email on screen, and the payment-confirmation email lands in the same
   inbox. Use a real Gmail account you're prepared to show on camera.
4. **Decide how to handle payment** — this is the one step with a real cost:
   - **Real payment (~₦10,000):** the most honest, fully authentic recording. You can refund/void
     it afterward if needed.
   - **Zero-cost test mode:** set `ALLOW_STUB_PAYMENTS=true` in Vercel's production environment
     variables before recording, then **set it back to unset immediately after** — this flag
     exists specifically for "run production in test mode for a short window" (see the comment in
     `app/api/verify-payment/route.ts`). Left on, it means the payment endpoint trusts whatever
     amount the browser reports instead of verifying with Paystack — a real risk if forgotten, so
     treat this as a two-step action (set it, record, unset it) not a permanent config change.
5. Do the whole thing in one continuous take if you can — cuts are easy to make in editing, but a
   real unbroken walkthrough is the most convincing raw material.

---

## The recording, step by step

### 1 — Arrive at the site (~10s)
Blank tab → type `pandaslp.com.ng` → Enter. Let the hero load fully — the fade-in is part of the
shot. Don't scroll yet.

### 2 — Click the real entry point (~5s)
Move deliberately to the **"Get legal help now"** link under the hero headline and click it.
(This is the direct-to-agent path — it skips the agent picker and goes straight to Small Claims,
which is the cleanest single line for a demo. If you'd rather show the agent-picker first, use
**"Explore Our AI Agents →"** instead and select Small Claims Court Agent from the roster.)

### 3 — Sign in (~30–45s)
Since you're not signed in, the auth modal appears inline on the agent page — no redirect. Enter
your email, submit, then **switch to your Gmail tab on screen** and open the magic-link email as
it arrives (this is the beat that proves it's a real account system, not a mocked demo — don't
cut around it). Click the link, wait for the cross-tab session pickup, and you're back on the
agent page signed in.

### 4 — Speak with the agent (~90–120s, can be cut down in editing)
Type naturally, typos and pacing included — a real exchange reads better than a rehearsed one:

> **You:** a client took delivery of a full dining set and stopped picking my calls. he owes ₦450,000
> *(wait for the reply)*
> **You:** yes I have the invoice and whatsapp messages where he confirmed the order

Click **📎** and upload a real invoice or receipt if you have one — the fact-extraction step (the
agent reading the file and not re-asking questions it already answered) is a genuine
differentiator, worth 2–3 seconds on screen. Keep answering until the agent offers to draft the
Letter of Demand.

### 5 — The letter is generated (~15–20s)
When the draft appears, open the watermarked PDF preview and scroll slowly, top to bottom, one
smooth pass. Let the letterhead and panda logo at the top sit on screen for a beat before
scrolling.

### 6 — Payment (~20–30s)
Choose a tier — **₦10,000 self-serve** or **₦25,000 Pandas LP serves it** — and complete checkout
through Paystack Inline. Don't rush the confirmation screen; let the "paid" state actually render.

### 7 — Review on the dashboard (~15s)
Navigate to `/dashboard`. Show the case card: the 4-stage timeline (**Paid → Served → Filed →
Judgment**), current stage highlighted, price and case details visible.

### 8 — The Gmail confirmation (~10–15s)
Switch back to Gmail and show the payment-confirmation email that's just arrived in the inbox —
same account used to sign in. This closes the loop: sign in with an email, pay, get a real email
back, no gaps in the story.

---

## After recording

Drop the raw file in `campaign/launch-video/recordings/` as `full-demo-raw.mp4`. From there it
can be cut down (a 45–60s version for social, a 2–3 minute version for an investor deck) without
re-recording — the raw take is the valuable asset; keep it unedited as the source.
