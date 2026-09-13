# Property Law Agent — product film

A standalone product film for the Property Law Agent. Built for LinkedIn, X,
Instagram and Reels/TikTok — 9:16 first, with a 16:9 cutdown from the same
timeline.

This is a video project only. It does not touch the PandasLP website, and no
site code was changed to produce it.

## What it is

Not a screen recording, not a slideshow of feature bullets. Every scene is
rendered frame-by-frame as real animated UI — a chat that actually types, a
cursor that actually clicks an option, a document whose fields fill in one at
a time as the client's answers land, checkmarks that tick on, a timeline rail
that fills as it's narrated. Nothing is a static PNG pushed by a Ken Burns
zoom.

Every fact on screen is real, pulled straight from the product:

- The agent's actual 9-option starter message (`lib/agents.ts`)
- The real notice-period rule (monthly tenancy → one month, Lagos State
  Tenancy Law 2011)
- The real Notice to Quit template language
- The real two-notice sequence (Notice to Quit → 7 Days' Notice → court)
- The real pricing: ₦25,000 tenancy/recovery documents, ₦50,000 standard
  search, "from ₦100,000, set by a lawyer" comprehensive search
  (`lib/propertyPricing.ts`)
- The real gate: every document sits "awaiting practitioner review" before a
  signature appears — nothing leaves unsigned

No invented features, no fabricated screenshots of the live app — the whole
film is built as motion graphics in the brand's own visual system, so nothing
here can drift out of sync with the product the way a screen recording would
the next time pricing or copy changes.

## Files

| File | What it is |
|---|---|
| `film.mjs` | The whole film — scene timeline, motion, layout. One source of truth for both aspect ratios. |
| `render.sh` | Parallel frame renderer (`./render.sh v` or `./render.sh w`) |
| `property-law-agent-vertical.mp4` | 1080×1920, 30fps, 67s — the deliverable |
| `property-law-agent-wide.mp4` | 1920×1080, 30fps, 67s — the 16:9 cutdown, same timeline |

## How it's built

Rendered through Satori (`next/@vercel/og`'s `ImageResponse`) — the same
renderer the brand already uses for `app/opengraph-image.tsx` and the
debt-recovery film in `../launch-video/story-2026/`. Real DOM/CSS in, a real
PNG out — crisp type, not an AI-generated frame.

Each of the film's ~2,010 frames (at 30fps) is a pure function of time: given
a timestamp, it computes exactly what should be on screen — which characters
of a sentence have been "typed," how far a field has slid in, where the
cursor is on its way to a click, how much of the timeline rail is filled.
That's the whole reason this doesn't reuse `story-2026/generate-frames.mjs`:
that script renders one still PNG per scene and lets ffmpeg's `zoompan`
fake the motion. Here every element moves on purpose, because the frame
generator was told to move it.

```
node film.mjs plan              # print the scene list and durations
./render.sh v                   # render all frames, 9:16, to frames-v/
./render.sh w                   # render all frames, 16:9, to frames-w/
```

Then encode:

```
ffmpeg -framerate 30 -i frames-v/%05d.png -c:v libx264 -preset slow -crf 17 \
  -pix_fmt yuv420p -movflags +faststart property-law-agent-vertical.mp4
```

## Rendering a 16:9 (or any) version later

`film.mjs` already carries two layout presets (`v` = 1080×1920, `w` =
1920×1080) driving the same scene functions — nothing about the story,
timing or copy is duplicated per aspect ratio. To add a square (1:1) cut or
retime anything, add a `LAYOUTS` entry / edit `SCENES` in `film.mjs` and
re-run `render.sh`; there is nothing else to rebuild.

## Scene map (67.0s)

| Start | Scene | What happens |
|---|---|---|
| 0.0s | Open | "Your tenant has stopped paying." — the problem, cold |
| 4.2s | Agent opens | The real starter message; cursor clicks "Recover possession from a tenant" |
| 9.5s | Interview | The agent asks state + tenancy type; the client types the answer live |
| 19.4s | The rule | Notice periods by tenancy type; the monthly-tenancy rule lights up gold |
| 23.3s | Document | The answers flow into a real Notice to Quit — fields, then body text, typing on |
| 32.9s | The gate | "Awaiting practitioner review" fills to a signature |
| 37.5s | Conviction beat | "A licensed practitioner signs every page." (dark) |
| 40.9s | The sequence | Notice to Quit → expiry → 7 Days' Notice → court, on a timeline rail |
| 46.5s | Pivot | "Buying instead? Search it first." |
| 49.4s | The two searches | Standard (₦50,000) vs Comprehensive (from ₦100,000), checkmarks ticking on |
| 58.0s | The honest line | "The agent takes the instruction. The firm does the searching." |
| 61.6s | Close | Property Law Agent lockup + pandaslp.com.ng (dark) |

## Sound

Shipped silent. The film is built to be understood with the sound off (every
beat carries its own on-screen text), per the brief. If you want a scored
version — soft UI accents on the click/type/checkmark beats, restrained
music underneath — that's a separate pass layered onto this same picture
edit; ask and it can be added without touching the visuals.

## Fonts / assets reused

`../launch-video/story-2026/fonts/` (Playfair, Adobe Source Sans, IBM Plex
Mono — static instances, not variable, because Satori can't parse `fvar`)
and `../../lib/logoData.js` for the mark. Same palette as the debt-recovery
film, lifted from the live site's `:root` block.
