# 03 — Small Claims Agent: Higgsfield Shot List & Motion Prompts

**Companion to:** [13-small-claims-video-script.md](./13-small-claims-video-script.md) (exact
timings/subtitles). This doc covers only the *generation* side — Higgsfield Soul (image) prompts,
Motion prompts, camera presets, and which shots are real screen capture instead.

> **Naming note:** this campaign reuses the "03" slot already occupied by
> `03-higgsfield-storyboard-prompts.md` (the earlier brand-film). That file is untouched — this is
> a separate document for a separate campaign, per the file path given for this task. If the two
> "03" files are ever consolidated, this one should be renamed `14-small-claims-higgsfield-prompts.md`.
>
> **Palette correction vs. the older file:** file `03-higgsfield-storyboard-prompts.md` was shot
> against the pre-rebrand near-black `#060605` / amber `#F5A623` palette. This campaign uses the
> site's *current* palette — Navy `#182A3A` and Gold `#D6BB80` — per this task's explicit spec.
> Every prompt below bakes that in; do not fall back to the older hex values.

---

## Standardized Style Block

Paste this block at the start of every Soul prompt in this document (append the shot-specific
description after it):

```
Cinematic 35mm anamorphic film still, shallow depth of field, horizontal lens flare,
subtle anamorphic bokeh ovals, realistic Lagos, Nigeria lighting — warm golden-hour or
soft overcast daylight, no studio flatness. Color grade: deep navy shadows (#182A3A),
warm gold highlights (#D6BB80), muted desaturated midtones, filmic contrast curve.
24fps motion blur characteristic, fine film grain, no plastic/digital-render look,
photorealistic skin and fabric texture, no text, no watermark, no logo.
```

**Motion preset default (unless noted per-shot):** `kling3_0_turbo`, 5s duration, slow deliberate
camera movement (dolly or slow pan, never a whip or shake), 720p, standard mode.

---

## Character Consistency Block

Reused verbatim from `03-higgsfield-storyboard-prompts.md` — same two recurring characters,
same wardrobe, same professions, across both campaigns for continuity.

**OBI** — a Nigerian man in his mid-30s, dark brown skin, short neat afro fade with light beard,
calm intelligent eyes, wearing a plain charcoal-grey short-sleeve shirt, in a small furniture
workshop filled with warm wood, hand tools, wood shavings.

**AMAKA** — a Nigerian woman in her late 20s, braided hair tied back, rust-orange blouse, a
caterer in a commercial kitchen.

For this campaign, **Obi is the claimant** — a furniture maker who delivered a custom order and
was never paid the balance. Keep his workshop setting; it's the visual anchor of "small business
owner, not a big company."

---

## Shot List

### Act 1 — What Small Claims Court Is

**Shot 1a — Courthouse establishing** *(0:00–0:04, generated)*
- **Soul prompt:** `[STYLE BLOCK] + ` "Wide establishing shot of a Nigerian High Court /
  Magistrate Court building exterior, colonial-modern architecture, Nigerian flag on a pole,
  a few pedestrians crossing in the distance for scale, soft early-morning light, low angle
  looking up at the entrance steps."
- **Motion prompt:** "Extremely slow push-in dolly toward the entrance, barely perceptible,
  flag moves gently in the breeze, pedestrians walk naturally."
- **Camera preset:** Slow push, 24mm equivalent, tripod-stable.
- **Aspect ratio:** 16:9.

**Shot 1b — Gavel/ledger detail** *(cutaway, optional b-roll)*
- **Soul prompt:** `[STYLE BLOCK] + ` "Close-up macro shot of a wooden gavel resting beside a
  stack of official court forms on a mahogany desk, warm desk lamp light, gold pen resting
  diagonally across the papers."
- **Motion prompt:** "Static shot, very subtle focus breathing, dust motes drifting through the
  lamp light."

---

### Act 2 — The Problem

**Shot 2a — The unpaid invoice** *(0:10–0:15, generated)*
- **Soul prompt:** `[STYLE BLOCK] + ` "Close-up of a Nigerian small-business invoice printed on
  paper, a red 'OVERDUE' stamp partially visible, a cold cup of tea beside it, workshop wood
  shavings blurred in the background, Obi's hands (dark brown skin, calm) resting near the paper
  but not covering the text."
- **Motion prompt:** "Slow rack focus from the invoice in foreground to Obi's face softly out of
  focus in the background, then holds."

**Shot 2b — Obi, disappointed call** *(0:10–0:15, generated)*
- **Soul prompt:** `[STYLE BLOCK] + ` "Medium shot of OBI [character block] sitting at his
  workshop bench, phone held to his ear, expression of controlled frustration, workshop tools
  softly blurred behind him, warm wood-toned light."
- **Motion prompt:** "Obi lowers the phone slowly from his ear and sets it face-down on the
  bench, exhales, looks down at the invoice. No dialogue — his face carries it."

**Shot 2c — The debtor avoiding the call** *(0:15–0:20, generated)*
- **Soul prompt:** `[STYLE BLOCK] + ` "Medium shot of a Nigerian man in a modest office setting,
  looking at his ringing phone screen (screen glow only, no readable UI), letting it ring,
  turning it face-down, mild guilt in his expression, fluorescent office light contrasted
  against the warm grade."
- **Motion prompt:** "Phone visibly buzzing on the desk, man glances at it twice, then turns it
  over face-down and looks away."

---

### Act 3 — Introducing the Agent

**Shot 3a — Product interface, first reveal** *(0:24–0:34, REAL SCREEN CAPTURE — do not generate)*
- Record directly from `pandaslp.com.ng`, dark navy theme, resolving to the Small Claims agent
  chat entry point. Capture at 1920×1080, 60fps for a clean slow-mo option in the edit if needed.
- No Higgsfield shot substitutes for this — it must be the real product, per the established
  convention in file 03 (brand film) of never faking the UI.

---

### Act 4 — How It Works

**Step 1 — Chat + upload** *(0:34–0:44, REAL SCREEN CAPTURE — do not generate)*
- Record the live chat flow: a question typed, an answer given, the 📎 attach control used to
  upload a photo of an invoice. Use a real (redacted/placeholder) invoice image as the upload —
  do not use a client's actual document.

**Step 2 — Demand Letter generated** *(0:44–0:54, MIXED: screen capture + one generated cutaway)*
- **2a (real capture):** the PDF preview panel rendering the watermarked Demand Letter / Form
  SCA 1 document in the browser.
- **2b (generated cutaway) — the physical letter:**
  - **Soul prompt:** `[STYLE BLOCK] + ` "Close-up of an official legal demand letter on cream
    letterhead paper resting on a dark navy desk mat, a small gold wax-look seal or embossed
    monogram in the corner, a fountain pen resting beside it, shallow depth of field blurring
    the letter body text so it reads as texture, not legible content."
  - **Motion prompt:** "Slow overhead-to-angled pan revealing the letter, pen rocks slightly as
    if just set down."
  - **Important:** letter body text must stay illegible/abstracted in the generated shot — real
    legible copy only ever appears in the actual screen-captured PDF preview, never in an
    AI-generated image (avoids AI-generated legal text appearing as if real).

**Step 3 — Served + tracked** *(0:54–1:04, REAL SCREEN CAPTURE — do not generate)*
- Record the dashboard's case-timeline component showing the status progression and the 14-day
  countdown. If the real dashboard doesn't yet have test data showing this state, seed one demo
  case with Paid → Served → Day 3-of-14 for the recording, then reset it after capture.

**Step 4 — Escalation** *(1:04–1:14, REAL SCREEN CAPTURE — do not generate)*
- Record the dashboard's "Escalate to Court Filing" / "Enforce Judgment" actions becoming
  available. Same demo-case seeding approach as Step 3.

---

### Act 5 — End Card

**Shot 5a — Logo resolve** *(1:14–1:22, MOTION GRAPHICS — not Higgsfield, not screen capture)*
- Build in After Effects / a `next/og`-derived static frame animated in the NLE: navy `#182A3A`
  background, the Pandas LP monogram draws on in a thin gold `#D6BB80` stroke, holds, then the
  full wordmark lockup and pricing/CTA text fade in beneath it. See
  `generate-small-claims-frames.mjs` for the underlying static frame this animates from.

---

## Continuity Checklist

- [ ] Obi's wardrobe (charcoal-grey shirt) and workshop setting match every shot he appears in.
- [ ] No generated shot ever contains legible on-screen text, UI chrome, or fake app interfaces —
      those are screen-capture-only per the markers above.
- [ ] Every generated shot uses the Navy/Gold style block above, not the older near-black/amber
      block from `03-higgsfield-storyboard-prompts.md`.
- [ ] The physical-letter cutaway (Shot 2b) keeps body text illegible/abstracted — never render
      AI-generated "fake" legal copy that could be mistaken for real document contents.
- [ ] Demo case data used for Steps 3–4 screen captures is reset/deleted after recording — do not
      leave synthetic cases in the production database (see the admin-dashboard cleanup
      precedent already established for this project).
