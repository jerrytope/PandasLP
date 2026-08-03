# 13 — Small Claims Agent Explainer: Video Script (No Voiceover)

**Use:** a standalone HD explainer for the Small Claims Court Agent specifically — distinct
from the emotional brand film (file 02) and the general "How It Works" demo (file 12). This one
carries zero narration; every beat of information lands as on-screen text over cinematic visuals.
Runtime target: ~82 seconds. 16:9 master, 9:16 cutdown re-crop per file 04's conventions.

> **Type system note:** this doc uses **Instrument Sans** (display/headline text) and **Geist
> Mono** (timestamps, data, small labels) — the site's *current* type system as of the
> typography rebuild in `app/layout.jsx`. Older campaign files (00–12) reference Bricolage
> Grotesque / DM Mono, which predates that change. Use the fonts named here, not the older ones,
> for anything meant to look like it belongs to the live product.
>
> **Color note:** Navy `#182A3A` / Gold `#D6BB80` throughout — the site's actual current palette
> (`app/globals.css`). The near-black `#060605` / amber `#F5A623` combination in file 03 predates
> the navy/gold rebrand; do not reuse it here.

---

## Act 1 — What Small Claims Court Actually Is (0:00–0:10)

**Visual:** Slow aerial/establishing cinematic shot of a Nigerian courthouse exterior or a
stylized Lagos judicial-district streetscape at soft morning light (see companion Higgsfield doc,
Shot 1a). No people yet — the tone is informational, not personal.

| Time | On-screen text | Placement / Font |
|---|---|---|
| 0:00–0:04 | `SMALL CLAIMS COURT` | Centered, Instrument Sans 700, 64px, Gold on Navy scrim |
| 0:04–0:10 | Resolves monetary claims and unpaid debts under ₦5,000,000 — without a long trial. | Lower-third, Instrument Sans 500, 28px, white, max 2 lines |

---

## Act 2 — The Problem (0:10–0:24)

**Visual:** Three quick cinematic vignettes (Higgsfield shots 2a–2c in the companion doc): an
overdue invoice under a teacup, a small-business owner's disappointed phone call, a debtor
visibly avoiding a call. No dialogue, no VO — purely visual, subtitles carry the point.

| Time | On-screen text | Placement / Font |
|---|---|---|
| 0:10–0:15 | Unpaid invoices. Unreturned deposits. Debtors who stop answering. | Lower-third, Instrument Sans 600, 32px, white |
| 0:15–0:20 | Most people never chase it. The traditional route costs too much and takes too long. | Lower-third, Instrument Sans 500, 26px, muted white (`#ABB1A2`) |
| 0:20–0:24 | *(silent beat — no text, let the visual breathe)* | — |

---

## Act 3 — Introducing the Agent (0:24–0:34)

**Visual:** Hard cut to the actual product interface — a real screen capture of `pandaslp.com.ng`
resolving to `/agent/small-claims`, dark navy UI glowing on. This is the first "real app" beat;
everything before it was cinematic scene-setting.

| Time | On-screen text | Placement / Font |
|---|---|---|
| 0:24–0:28 | `PANDAS LP` | Centered, Instrument Sans 700, 56px, Gold, logo mark above it |
| 0:28–0:34 | The Small Claims Court Agent. Instant. 24/7. Drafts your Demand Letter and court forms. | Lower-third, Instrument Sans 600, 28px, white, 2 lines max |

---

## Act 4 — How It Works (0:34–1:14)

Four steps, ~10 seconds each, each opening with a Geist Mono step tag (matches the site's own
`STEP 1 —` convention) before the descriptive line.

### Step 1 — Tell it what happened (0:34–0:44)
**Visual:** Real screen capture — the chat interface, a message typed, a receipt/invoice photo
uploaded via the 📎 attach flow (see `components/AgentChat.tsx`).

| Time | On-screen text | Placement / Font |
|---|---|---|
| 0:34–0:37 | `STEP 1` | Top-left tag, Geist Mono 500, 16px, Gold, letter-spacing 0.08em |
| 0:37–0:44 | Answer a few plain-English questions. Upload your proof — invoice, receipt, chat screenshot. | Lower-third, Instrument Sans 500, 26px, white |

### Step 2 — The Demand Letter, drafted (0:44–0:54)
**Visual:** Real screen capture — the watermarked PDF preview rendering, then a Higgsfield hero
product shot of the physical letter on letterhead (companion doc, Shot 5b-equivalent, recolored
to navy/gold).

| Time | On-screen text | Placement / Font |
|---|---|---|
| 0:44–0:47 | `STEP 2` | Top-left tag, Geist Mono 500, 16px, Gold |
| 0:47–0:54 | A court-ready Demand Letter — Form SCA 1 — generated in minutes. Reviewed by a licensed lawyer before it's ever sent. | Lower-third, Instrument Sans 500, 26px, white, 2 lines |

### Step 3 — Served, and tracked (0:54–1:04)
**Visual:** Real screen capture — the dashboard's case timeline (`app/dashboard/page.tsx`'s
`CaseTimeline` component): Paid → Served lighting up, a deadline counter ticking.

| Time | On-screen text | Placement / Font |
|---|---|---|
| 0:54–0:57 | `STEP 3` | Top-left tag, Geist Mono 500, 16px, Gold |
| 0:57–1:04 | Served. Then a 14-day response window, tracked automatically — Day 0, Day 7, Day 14. | Lower-third, Instrument Sans 500, 26px, white |

### Step 4 — Escalation, if it comes to that (1:04–1:14)
**Visual:** Real screen capture — the dashboard's "Escalate to Court Filing" and "Enforce
Judgment" actions appearing once their conditions are met (per `app/dashboard/page.tsx`).

| Time | On-screen text | Placement / Font |
|---|---|---|
| 1:04–1:07 | `STEP 4` | Top-left tag, Geist Mono 500, 16px, Gold |
| 1:07–1:14 | If they still won't pay: court filing, then judgment enforcement. You don't chase anyone. | Lower-third, Instrument Sans 500, 26px, white |

---

## Act 5 — End Card / CTA (1:14–1:22)

**Visual:** Motion graphics, not Higgsfield — matches file 03's Scene 7 convention, recolored:
navy `#182A3A` background, PLP monogram draws on in a thin gold `#D6BB80` stroke, resolves to
the full logo lockup.

| Time | On-screen text | Placement / Font |
|---|---|---|
| 1:14–1:18 | `PANDASLP.COM.NG` | Centered, Instrument Sans 700, 40px, Gold |
| 1:18–1:22 | ₦10,000 self-serve · ₦25,000 served · CAC BN 9646741 | Centered below, Geist Mono 400, 18px, muted white |

---

## Subtitle production notes

- **No VO track at all** — every beat above is the *complete* text for that moment; there is no
  spoken line running underneath it. Time each card to sit on screen at minimum 1.2s per 3 words
  of English reading speed, longer for the 2-line cards.
- **Font sizes are for a 1920×1080 master** — scale proportionally for the 9:16 cutdown, don't
  just shrink the safe-margins.
- **Real screen captures (Acts 3 and 4) must be recorded from the actual live product**, not
  recreated — this is a product explainer, credibility depends on it being real footage, not a
  styled mockup. See the companion Higgsfield doc for exactly which shots are AI-generated vs.
  real capture.
- **Step tags (`STEP 1`–`STEP 4`) reuse the exact same convention already on the live site** —
  don't invent new step-numbering language that doesn't match the product.
