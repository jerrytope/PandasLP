# Debt Recovery Agent — product film

A standalone product film for the Debt Recovery Agent (the Small Claims
Court Agent, as it's actually named inside the product). Built the same way
as `../property-law-film/`: for LinkedIn, X, Instagram and Reels/TikTok,
9:16 first, with a 16:9 cutdown from the same timeline.

This is a video project only. It does not touch the PandasLP website, and no
site code was changed to produce it.

## What it is

Every scene is rendered frame-by-frame as real animated UI — the agent's
actual starter message typing on, a client's story typed into the composer,
a cursor clicking a real pricing option, a document whose fields fill in as
the facts arrive, a signature that only appears after review, a clock rail
that advances through the real Day 0/7/14/15 sequence. Nothing is a static
PNG pushed by a Ken Burns zoom.

Every fact on screen is real, pulled straight from the small-claims agent's
system prompt (`lib/agents.ts`) and the live cron job that actually runs the
clock (`app/api/cron/follow-ups/route.ts`):

- The agent's real starter line, asking for the story rather than a form
- The real delivery choice — ₦10,000 to deliver the letter yourself, ₦25,000
  for Pandas LP to serve it — exactly as the OPTIONS block in the prompt
- The real rule that both tiers are *drafted and signed* by Pandas LP; only
  delivery changes, never the signer, never the client using "I"
- The real Day 7 / Day 14 follow-up — an actual Vercel Cron job, not a
  metaphor — and the real Day 15 filing at the Small Claims Court
- A confidence beat right after the clock: most debtors pay once the letter
  lands, and if they don't, the case is already moving to court — the film
  stays inside this one agent's own flow rather than pivoting to a separate
  product

The invoice scenario (a ₦850,000 web-design debt, invoice INV-2024-118) is a
stand-in — the agent handles any invoice, loan, or goods/services debt — but
every mechanic around it is real product behaviour, not invented for the
camera.

**One deliberate departure from the system prompt**: the prompt hardcodes a
real practitioner's name and email as the letter's signatory. This film
keeps the signature as "[ practitioner signature ]" instead, following the
same call the team already made in the earlier debt-recovery film
(`../launch-video/story-2026/generate-frames.mjs`) — a real person's name in
a public marketing asset wants its own sign-off, separate from that name
living in the product's own output.

## Files

| File | What it is |
|---|---|
| `film.mjs` | The whole film — scene timeline, motion, layout |
| `render.sh` | Parallel frame renderer (`./render.sh v` or `./render.sh w`) |
| `debt-recovery-agent-vertical.mp4` | 1080×1920, 30fps, 74s — the deliverable |
| `debt-recovery-agent-wide.mp4` | 1920×1080, 30fps, 74s — the 16:9 cutdown |

Built on the same rendering engine as `../property-law-film/film.mjs`
(Satori → PNG per frame, ffmpeg to encode) — see that folder's README for how
the renderer itself works. This file only differs in content: the scenes,
copy, and product facts are specific to the Debt Recovery Agent.

```
node film.mjs plan     # print the scene list and durations
./render.sh v          # render all frames, 9:16, to frames-v/
./render.sh w          # render all frames, 16:9, to frames-w/
```

## Scene map (74.0s)

| Start | Scene | What happens |
|---|---|---|
| 0.0s | Open | "Someone owes you money. And they've gone quiet." |
| 4.6s | Agent opens | The real starter message; the client's story typed and sent |
| 11.6s | Interview | The agent asks about evidence; the client cites a signed contract and invoice |
| 21.0s | The choice | Real OPTIONS block — ₦10,000 self-serve vs ₦25,000 firm-served; cursor clicks the second |
| 26.2s | Templates | "Pandas LP signs it either way" — the two locked templates, same signer |
| 30.0s | Document | The facts flow into a real demand letter — fields, then body text, typing on |
| 39.6s | The gate | "Awaiting practitioner review" fills to a signature |
| 44.2s | Conviction beat | "Pandas LP signs every letter. Never the client." (dark) |
| 47.9s | The clock | Day 0 served → Day 7 automatic follow-up → Day 14 window closes → Day 15 filed |
| 53.5s | Confidence beat | "Most debtors pay before it gets that far. If not — Day 15, filed at court." |
| 56.4s | What this costs | A retainer + unknown hourly bill vs. quoted upfront, from ₦10,000 |
| 65.0s | The honest line | "Pandas LP drafts and signs. You choose who delivers it." |
| 68.6s | Close | Debt Recovery Agent lockup + pandaslp.com.ng (dark) |

## Sound

Shipped silent, same as the property law film — every beat carries its own
on-screen text, so it holds up muted.

## Fonts / assets reused

`../launch-video/story-2026/fonts/` and `../../lib/logoData.js` — same
palette and type system as every other film in this campaign folder.
