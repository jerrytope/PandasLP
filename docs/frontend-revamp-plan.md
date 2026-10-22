# Frontend revamp: "Ink & Brass"

**Goal:** a site that looks designed, not assembled. It is dark first like Cencori, shows the product working like CipherSense, makes dated claims like Smile ID, and copies Mobirevo's "what happens next" and confidentiality blocks. The full plan (references, structure, homepage order) was agreed on 22 Oct 2026.

## Decisions
- **Dark first;** light mode through the existing toggle (`lib/theme.ts`).
- **All four phases:** design system → public site → client app → staff screens.
- **Placeholders until the real assets exist, editable in Admin → Site content:**
  - Photos show a designed placeholder panel (a hairline grid and a brass seal), never stock photos or fake people.
  - Numbers, client quotes and the founder's note **never show** until staff fill them in and switch them on. Made-up figures or testimonials on a law firm's site would mislead clients and break the advertising rules.

## Craft rules (checked at every review)
- Every visual is a real artifact: a run-log, a document, a real photo. No stock, no emoji, no sparkle icons, no glow, gradient meshes or typewriter effects.
- Every number has a definition and an "as of" date.
- Sentence case. A mono eyebrow above each H2.
- One link vocabulary: "Start a matter", "Read more", "View all".
- No grids of identical icon cards. Each section uses a different form.
- The lawyer approves claims, the comparison and testimonials before they go live.

## Status

| Phase | What | Status |
|---|---|---|
| 0 | Content: photos, numbers, quotes, lawyer review | Waiting on the owner. Placeholders in place; edit in Admin → Site content |
| 1 | Design system | Built 22 Oct 2026 |
| 2 | Public site | Built 22 Oct 2026 |
| 3 | Client app (chat as a matter workspace, dashboard, sign-in, payment) | Built 22 Oct 2026 |
| 4 | Staff (admin sidebar, /manageai, developer docs) | Built 22 Oct 2026 |

Checked on 22 Oct 2026: type check clean, 584 tests pass, production build passes. Every public page returns 200 with the new header and footer (404 returns 404). Screenshots taken with headless Chrome, using true device emulation through the DevTools protocol (the Chrome extension could not reach localhost): homepage at 1440 and 390 (no sideways scroll) in both themes, a practice page, the blog, a location page, About, the chat (signed in), the dashboard, sign-in, Admin overview, Admin → Site content, /manageai and /developers/api. **The owner has not reviewed it yet. Nothing is committed.**

## Phase 1 checklist
- [x] Tokens in `app/globals.css`: dark canvas `#0B0A09`, cream `#EDE6D9`, brass `#E2B04A` (light: parchment `#F4F1EA`, ink `#12110F`, brass `#8A5E0F`). Every text colour checked for AA. The light-theme self-reference bug is fixed. The noise texture and gold glow are removed.
- [x] Fonts: Manrope, Inter and JetBrains Mono. Dark is the default (`lib/theme.ts`).
- [x] Building blocks in `components/ui/`, plus `/styleguide` (noindex).
- [x] Admin → Site content (`add-site-content.sql`, applied locally; listed in `scripts/deploy/migrations.txt` for the server).
- [x] The `.form-group` style, used by the sign-in, payment and custom-claim forms but never defined, is now defined.

## Phase 2 checklist
- [x] Header (`components/Navbar.jsx`): Practice mega-menu (2 open practices, 4 "opening later", debt check), For businesses, Fees, How we work, Notes; theme toggle, Talk to a lawyer, Sign in / My matters, Start a matter; a full-screen drawer on mobile; the announcement bar when a page passes one. It publishes `--site-header-h` and adds a spacer of that height (`spacer={false}` on the chat page, which sizes itself).
- [x] Footer (`components/Footer.jsx`): Practice / Businesses / Firm / Legal, the newsletter, location links folded into one "Locations" list, credentials and the disclaimer.
- [x] Homepage: `app/page.jsx` (server: site content and the latest notes, revalidated every 60 s) → `components/home/HomeApp.jsx` (the old interactive page: custom claim, payment, enforcement) → `components/LandingPage.jsx` in the agreed order. RecoveredCounter kept (it shows nothing until there is a confirmed total).
- [x] New pages: `/how-we-work`, `/about`, `/businesses` (frame: `components/site/PublicPage.tsx`; layout: `components/site/pages.module.css`); added to the sitemap.
- [x] The blog, location, legal and 404 pages now use the shared header and footer instead of their own. The blog is labelled "Notes" (URL unchanged).
- [x] Older pages (`/agents`, the practice and limits pages, location pages, debt check) moved onto the new system through overrides at the end of `globals.css`.
- [x] Share image (`app/opengraph-image.tsx`) in ink and brass.
- [x] Retired: `HeroVideo`, `OrbitVisual`, `TypewriterHeadline`, `TypingBeat`, `HowItWorks`, `HiwFlowLine`, `ServicesSection`, `ServiceCard`. `ChatPreview`, `Timeline` and `DocumentStack` remain (the practice pages and dashboard use them).
- [ ] Left out on purpose: the "us vs others" comparison section. Comparing ourselves with other firms is exactly what the advertising rules restrict. The lawyer must approve it first.

## Phase 3 checklist
- [x] Full-page chat as a matter workspace: a left panel on wide screens (matter reference, the five steps with the current one marked, "nothing is sent until a lawyer signs", My matters). The client's own messages were cream text on brass (unreadable in dark mode); they are now ink on cream / cream on ink. Pill input and buttons; the draft preview on white paper.
- [x] Dashboard heading "My matters", matching the menu.
- [x] Sign-in and payment forms: spacing fixed by the `.form-group` definition.

## Phase 4 checklist
- [x] Admin sidebar moved from the old navy to ink and brass (`AdminShell.module.css`).
- [x] Admin → Site content: placeholders contained in their frames, fields aligned.
- [x] `/manageai` and `/developers/api` checked; they needed no changes.

## Open for the owner
- Review it in both themes, on a phone and a desktop.
- Upload real photos in Admin → Site content; add numbers and quotes once the lawyer approves the wording.
- On the live server: run `sudo bash setup.sh` after pushing (it applies `add-site-content.sql`).
