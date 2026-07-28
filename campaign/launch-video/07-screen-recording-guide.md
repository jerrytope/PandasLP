# 07 — Screen Recording Guide (the 4 real-app captures)

These four captures complete the film. Record on **https://pandaslp.com.ng** (production — the
local `.env.local` currently has empty values, so localhost won't run until you re-pull env
vars with `vercel env pull .env.local`).

## Recorder settings (all captures)

- Tool: OBS (free) or Windows Game Bar (Win+Alt+R) — OBS preferred for 60fps
- Capture the browser window only, hide bookmarks bar, use a clean profile (no extensions)
- Browser zoom **125–150%** so UI text survives the 720p→1080p edit
- Resolution: record at your native display, minimum 1920×1080, 60fps
- Mouse: move slowly and deliberately; every hesitation reads as intent on film
- Do several takes of each — takes are free, unlike Higgsfield credits

## Capture A — Scene 3b: Opening the site (needs ~10s of footage, film uses 3s)

1. Start recording on a blank tab → type `pandaslp.com.ng` → Enter
2. Let the hero load fully (the fade-in animations are the shot)
3. Slowly move to **"Recover your money →"** and click
4. Stop after the chat modal opens

## Capture B — Scene 4: The AI interview (needs ~90s, film uses 14s, sped up)

Type this exchange into the Small Claims agent, naturally, typos-and-all pacing.
(The AI's live replies will differ from the script — that's fine and more authentic;
the film only shows fragments.)

> **You:** a client took delivery of a full dining set and stopped picking my calls. he owes ₦450,000
> *(wait for reply)*
> **You:** yes I have the invoice and whatsapp messages where he confirmed the order
> *(wait for reply — if it references admissible evidence, that's your hero frame)*
> Continue answering until it offers to draft the Letter of Demand. **Capture the typing
> dots** before each AI reply — the edit uses them.

Also click **📎 upload** and attach any invoice PDF — the "AI reads your document" beat
needs 2 seconds of that flow.

## Capture C — Scene 5a: The PDF preview (needs ~15s, film uses 3s)

When the draft letter appears, open the watermarked PDF preview and **scroll slowly** top
to bottom — one smooth pass. The letterhead and panda logo at the top matter most; start
the scroll only after the first page has fully rendered.

## Capture D — Scene 5e: Dashboard "Served" status (needs ~10s, film uses 2s)

1. Log into `/dashboard` with a test case in `letter_served` status
   (create one via the flow, or set `status = 'letter_served'` and `deadline_at = now() + interval '7 days'` on a test row in Supabase)
2. Record the case card: the 4-step timeline with **✓ Served · Day X of 7** countdown
3. Hover the Escalate button briefly — don't click

## Export & handoff

Drop the four files into `campaign/launch-video/recordings/` as `A-open-site.mp4`,
`B-interview.mp4`, `C-pdf-preview.mp4`, `D-dashboard.mp4`. They cut against the Higgsfield
clips in [06-generated-clips-manifest.md](06-generated-clips-manifest.md) per the timings in
[02-master-script.md](02-master-script.md).

## Overlays reminder (built in the edit, not recorded)

- Clip 1b: WhatsApp thread — "I'll pay you next week, I promise." timestamped 3 months back, grey ticks
- Clip 6b: bank notification — "Credit Alert: ₦450,000.00" in green #3ECF8E
