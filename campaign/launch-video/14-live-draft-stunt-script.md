# 14 — "The Timer Doesn't Lie": Live Draft Stunt Script

**Use:** a standalone proof-of-work video, distinct from the cinematic brand film (file 02) and the
polished explainer (file 13). Zero cinematic footage, zero AI-generated visuals, zero cuts. One
continuous screen recording with a stopwatch burned into the corner, published as-is. The rawness
*is* the credibility — this is the "don't take our word for it, watch it happen" companion piece to
the polished ad.

> **Type/color system:** Instrument Sans (display) / Geist Mono (timer, labels), Navy `#182A3A` /
> Gold `#D6BB80` — matches the site's current system, same note as file 13.

---

## The concept, in one sentence

Someone opens the real, live site, types a real-sounding legal problem into the actual Small Claims
agent, and the video shows — one unbroken take, running stopwatch on screen — the AI interviewing,
then producing an actual downloadable, watermarked, court-ready Letter of Demand PDF. It ends the
moment that PDF appears, timer still showing.

## Why this works

Every competitor's product video is polished, which makes it automatically discounted by anyone
watching. This one is a dare instead of an ad: "we're not going to tell you it drafts a letter in
minutes, a stopwatch is going to prove it." That contrast is the entire distribution mechanism —
it reads as evidence, not marketing, which is exactly why it gets reshared with "wait, is this real?"
captions instead of scrolled past.

## What must never appear on camera

No `/admin` route, no environment variables, no terminal, no system prompts, no Supabase table
view, no internal config of any kind — this is the public product only: the chat, the PDF, the
dashboard. That boundary holds regardless of how much better a "behind the curtain" shot might look;
showing internal configuration is not part of this or any future marketing asset.

## Ethics/process note

The scenario below is an **illustrative demo**, not a real client's confidential matter — a law
firm publicly performing an actual client's dispute for a marketing stunt is a real professional
conduct problem. If asked directly whether it's a real case, the honest answer is "a realistic
demo scenario, and the AI's output and behavior are 100% real" — never claim it's an actual client
without one having actually consented to appear.

---

## Pre-production

- Record on `https://pandaslp.com.ng` (production) — reuse the recorder settings from
  [07-screen-recording-guide.md](07-screen-recording-guide.md): OBS at 60fps, 1920×1080 minimum,
  browser zoom 125–150%, clean profile, no bookmarks bar visible.
- Have a **stopwatch overlay** running in OBS (a simple text source bound to a timer, top-right
  corner, Geist Mono, gold on a small navy chip) started at the exact frame you hit Enter on the
  first message — not before.
- Do several full takes — takes are free. Pick the cleanest single unbroken one; do not
  Frankenstein-splice two takes together, since the entire premise is "unedited."
- Sign in ahead of time on a test account so the take isn't interrupted by the auth-modal magic-link
  wait — or, if you want the honest full journey, let that wait happen on camera and don't cut it;
  either is defensible, just decide before recording, not in the edit.

## The scenario to type (word for word, natural pacing, typos are fine)

Character: **Amaka**, ran a serviced apartment on a 6-month corporate let in Lagos. Moved out 45
days ago. Landlord's agent keeps saying "we're processing it" to a ₦300,000 refundable deposit.
No damage — she has the move-out inspection photos and the WhatsApp thread.

> **You:** my landlord's agent won't return my deposit. I moved out 45 days ago and they keep saying "we're processing it"
> *(wait for reply)*
> **You:** ₦300,000. I have photos from the move-out inspection showing no damage, and the whatsapp thread where the agent confirms they received it
> *(wait for reply — if it references admissible evidence or the statutory refund timeline, that's the frame to hold the shot on for a beat longer)*
> Continue answering naturally until it offers to draft the Letter of Demand. **Do not skip past
> the typing-dots beat** — let it play out on screen exactly as it happens; that hesitation is part
> of what makes it read as live, not scripted.

When the draft appears, open the watermarked PDF preview and let it render fully before ending the
recording — the letterhead and panda logo are the payoff shot.

## On-screen treatment (added in a light edit pass, not during recording)

- **Stopwatch**: top-right, running continuously, never paused or hidden, from first keystroke to
  PDF render.
- **One caption card at the very start**, on screen for 2 seconds before the recording resumes at
  normal speed: `REAL SITE. REAL AI. UNEDITED. ONE TAKE.` — Instrument Sans 700, gold on navy.
- **No other on-screen text for the rest of the video.** No lower-thirds, no step labels — the
  entire point is that nothing is added to help it along.
- **End card**, 3 seconds, after the timer stops: the final elapsed time large and center
  (Geist Mono 700, gold), `pandaslp.com.ng` below it (Instrument Sans 500, white),
  `₦10,000 · no retainer` beneath that (Geist Mono 400, muted white).

## Allowed edit (and only this)

- Trim dead air before the first keystroke and after the PDF fully renders.
- Speed up genuinely idle waiting (e.g. a slow page load) by up to 2x, visibly — the timer overlay
  should reflect real elapsed time regardless, so a sped-up section either keeps the real-time timer
  running normally (preferred, most honest) or is avoided by just not padding the take with dead time
  in the first place.
- Nothing else. No cuts mid-interview, no removing a stumble, no swapping in a cleaner take's ending.

---

## Caption / post copy (X, matching the founder voice from files 09–11)

> Told someone at [event/DM] our AI drafts a court-ready Letter of Demand in minutes.
>
> They didn't believe me. So here's the unedited proof — one take, real site, stopwatch running.
>
> [video]
>
> pandaslp.com.ng — ₦10,000, no retainer.

Alt opener, no anecdote framing:

> We keep saying the AI drafts a court-ready letter in minutes. Stopped saying it — here's a
> stopwatch instead.
>
> One take. No cuts. Real site.
>
> [video]

## Distribution

Post natively on X (video, not a link-out, for algorithmic reach) and cross-post to the existing
X-thread-graphics channel. Pin for the week it drops. If a Founder's Space (file 08/09) is scheduled
near the same window, this clip is the pre-roll — play it as the room fills, before the live demo in
file 09 section 5, so the room has already seen "unedited" once before watching it live a second time.

## What this is not

Not a replacement for file 13's polished explainer — that one sells the *system* (interview → draft
→ served → tracked → enforced). This one sells *one specific claim* (minutes, not weeks) as hard,
undeniable proof. Run both; they do different jobs.
