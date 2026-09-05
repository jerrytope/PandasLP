# Pandas LP — Project Context for Claude

## What This Is
Pandas LP is an AI-native law firm in Nigeria. It is a registered business with the CAC (Business Name, BN 9646741 — not a limited liability company registration) and has notified the NBA (Nigerian Bar Association). The product is a Next.js web app where AI agents conduct a guided legal interview, draft court-ready documents, and Pandas LP's team serves and files them on behalf of clients.

This is NOT a document template tool. Pandas LP is a law firm that can represent clients in court.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, TypeScript (`allowJs: true`), React 19 |
| AI | Anthropic Claude API (`claude-sonnet-4-6`, `max_tokens: 4096`), Edge Runtime |
| Auth | Supabase Auth — email magic link (no password) |
| Database | Supabase PostgreSQL — `cases` + `messages` tables with RLS |
| Email | Nodemailer + Gmail SMTP — follow-up emails at Day 0 / Day 7 / Day 14 after letter served (Vercel Cron drives Day 7/14, see app/api/cron/follow-ups) |
| PDF | jsPDF v4 — vector panda logo, letterhead, watermark, rich text |
| Payments | Paystack Inline (stub when key is placeholder), independently verified server-side before a case is marked paid |
| Fonts | next/font/google — Bricolage Grotesque (display), Inter (body), DM Mono (mono) |
| Animations | CSS-only IntersectionObserver scroll reveals (`Reveal.jsx`) |

---

## Environment Variables

```
ANTHROPIC_API_KEY          — Claude API key
NEXT_PUBLIC_SUPABASE_URL   — https://xpjjndslodmpgcykajlm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY  — sb_secret_... (server-side only, never in client code)
GMAIL_APP_PASSWORD         — Google App Password for pandaslegalpractitioners@gmail.com (not the regular password)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY — Paystack public key (client-side checkout)
PAYSTACK_SECRET_KEY        — Paystack secret key (server-side only — verifies payments in app/api/verify-payment/route.ts). Placeholder = stub mode, same as the public key.
NEXT_PUBLIC_SITE_URL       — Production URL (https://pandaslp.com.ng)
NEXT_PUBLIC_GA_MEASUREMENT_ID — GA4 Measurement ID (G-XXXXXXX). Unset = analytics script doesn't render at all (see app/layout.jsx).
CRON_SECRET                — Bearer token Vercel Cron sends to app/api/cron/follow-ups. Any random string.
PLUGIN_API_KEY             — Fixed key checked against the x-plugin-key header on app/api/plugin/intake. Pasted into the OpenAI Action's own auth config once that's set up. Unset = the route 503s.
ADMIN_EMAILS               — Comma-separated staff allowlist checked by lib/adminAuth.ts (isAdminEmail/requireAdmin). Singular ADMIN_EMAIL is also accepted as a fallback — the Vercel env var was originally set up under that name. Change requires a redeploy to take effect.
GOOGLE_REVIEW_URL          — Link included in the resolution email (lib/sendCaseEmail.ts) once a case closes. Omitted gracefully if unset — no fabricated URL.
ALLOW_STUB_PAYMENTS        — Set to "true" to allow stub (unverified) payments in real production (VERCEL_ENV === 'production'). Dangerous if left on — it means /api/verify-payment trusts the client-reported amount instead of checking with Paystack. Should not be set in normal operation; see app/api/verify-payment/route.ts.
NEXT_PUBLIC_CALENDLY_URL   — Calendly booking link embedded in the lawyer-consultation flow (components/LawyerConsult.jsx).
```

---

## Key Files

### AI & Agents
- `lib/agents.ts` — All 6 agents: AgentId type, Agent interface, AGENTS record, system prompts, document templates
- `app/api/chat/route.ts` — Edge runtime. Receives `{messages, agentId}`, calls Claude, returns response. Injects DOCUMENT CONTEXT RULE into every system prompt.
- `app/api/extract/route.ts` — Node runtime. Receives `{fileBase64, mediaType, filename}`, sends to Claude for fact extraction from uploaded PDFs/images. Returns `{facts}` string.
- `app/api/plugin/intake/route.ts` — Node runtime. Public endpoint for the ChatGPT Actions integration (`public/openai-actions-schema.json` is the schema submitted to OpenAI). Receives `{user_query}`, auth'd via `x-plugin-key` header against `PLUGIN_API_KEY` (no user session to check — the caller is ChatGPT, not a signed-in user). Classifies the problem via `lib/legalIntakeClassifier.ts` (same Claude model/fetch pattern as `app/api/chat/route.ts`), looks up the real price via `getAgentPayment()` (never trusts the LLM for a number), and returns a `case_link` into `/agent/<agentId>?ref=chatgpt&auto=<summary>`.

### Document Flow
- `components/AgentChat.tsx` — Handles: interview, file upload (📎), document block parsing (`<<<DOCUMENT>>>`), watermarked PDF preview, payment, Supabase persistence. Takes a `fullPage` prop: `false` renders the original floating modal card (`.overlay`/`.modal` in `AgentChat.module.css`); `true` renders as a page-filling section (`.pageOuter`/`.pageModal`) with no dark backdrop, used by the dedicated chat route below.
- `lib/pdfGenerator.js` — jsPDF: panda logo, letterhead, footer, watermark, bold text rendering, ₦→N substitution.
- `DOCUMENT_BLOCK_RE` regex in AgentChat: parses `<<<DOCUMENT>>>TITLE/PRICE/PRICE_LABEL/---/body<<<END_DOCUMENT>>>`.

### Chat Page vs. Marketing Page
- `app/page.jsx` — Marketing homepage only (hero, pricing, agents, FAQ via `LandingPage.jsx`) plus the custom-claim intake, payment-gate, and judgment-enforcement judgment-amount intake steps. It no longer renders `AgentChat` directly — every "open an agent" action calls `router.push('/agent/<agentId>')`.
- `app/agent/[agentId]/page.jsx` — The chat's own route (e.g. `/agent/small-claims`). Client component: resolves `agentId` against `AGENTS`/`getAgentPayment`, redirects to `/` if invalid, shows `AuthModal` inline if signed out (no redirect-then-return — the user finishes sign-in on this same page via cross-tab session detection), and renders `AgentChat` with `fullPage`. Calls `captureAttribution()` on mount (a visitor can land directly here, e.g. from the ChatGPT plugin, skipping `app/page.jsx`'s own capture call). Reads `?resume=<caseId>` (loads case + messages from Supabase, same as the old in-page flow), `?fileCourt=1` (injects the standard court-filing escalation auto-message), and `?auto=<urlencoded text>` (arbitrary auto-message — works with or without `?resume=`; without it, a brand-new case is created lazily on first send, which is how the ChatGPT plugin below hands off a fresh visitor). On approval, `lawyer-consultation` shows `LawyerConsultBooking` in place; every other agent redirects to `/dashboard`.
- Dashboard "Resume" / "Prepare Court Filing" links point at `/agent/<agentId>?resume=<id>[&fileCourt=1]`. "Enforce Judgment" still points at `/?enforceFrom=<id>` — the judgment-amount intake (`EnforcementIntake`) stays on the homepage since the agent isn't known until it creates the case, then it pushes to `/agent/judgment-enforcement?resume=<id>&auto=...`.

### Auth & Database
- `lib/supabaseClient.ts` — Browser Supabase client (anon key, localStorage session).
- `lib/supabaseAdmin.ts` — Server-only admin client (service role key). Import ONLY in API routes.
- `app/auth/callback/page.tsx` — Handles magic link redirect, waits for session, redirects to `/dashboard`.
- `supabase-schema.sql` — Full schema with RLS. Run in Supabase SQL editor. **If tables already exist, use the ALTER TABLE section at the bottom.**

### Dashboard & Follow-up
- `app/dashboard/page.tsx` — Case history. Visual 4-step timeline (Paid → Served → Filed → Judgment Won). Mark as Served button (triggers Day 0 email + sets 14-day deadline — see "14-day response period" below for why 14, not 7). Escalate to Court Filing CTA (appears when deadline passes). Enforce Judgment CTA (appears after judgment won).
- `app/api/send-email/route.ts` — Session-triggered sends (payment-confirmed, the Day 0 "mark served" email). Requires the caller's session to match the case's owner. Thin wrapper around `lib/sendCaseEmail.ts`.
- `app/api/cron/follow-ups/route.ts` — Vercel Cron hits this daily (see `vercel.json`), authenticated via `CRON_SECRET` (not a user session — there is no user for a scheduled job). Finds every `letter_served` case whose Day 7 or Day 14 checkpoint is due and hasn't been sent yet, and sends it. This is the only thing that makes the "escalating follow-up, zero effort from you" promise on the homepage actually true — without it, Day 7/14 emails would need a human to remember to trigger them manually, which defeats the point.
- `lib/sendCaseEmail.ts` — Shared email-sending logic (resolve recipient, build template, send, mark `email_dayN_sent`) used by both `/api/send-email` (session-triggered) and `/api/cron/follow-ups` (system-triggered), so there's one implementation instead of two copies drifting apart.
- `lib/emailTemplates.ts` — HTML email templates for Day 0, Day 7, Day 14 follow-ups.

### Payments
- `app/api/verify-payment/route.ts` — Node runtime. The only place a case is ever marked `paid`. Requires the caller's session to own the case, then independently confirms the transaction with Paystack's `/transaction/verify` endpoint (or, if `PAYSTACK_SECRET_KEY` is still a placeholder, accepts the stub checkout's result — there's no real gateway to check against yet). Compares the verified amount to `cases.expected_amount` and rejects a mismatch. For `small-claims`, `delivery_option` (`self-serve` vs `pandas-serves`) is derived from the verified amount, never trusted from the client.
- `cases.expected_amount` — set in `AgentChat.tsx` when a document is finalized (`newDoc.price ?? amount`), i.e. the price actually quoted for that case. This is what `/api/verify-payment` checks the real payment against.
- `components/PaymentForm.jsx` / `lib/paystackHelper.js` — client-side checkout only (real Paystack Inline or the stub timeout). Never itself marks anything paid — always hands the result to `AgentChat.tsx`'s `handlePaymentDone`, which calls `/api/verify-payment`.

### Blog
- `lib/blogPosts.ts` — 4 debt recovery articles as TypeScript objects with inline HTML content.
- `app/blog/page.tsx` — Blog index with SEO metadata.
- `app/blog/[slug]/page.tsx` — Article page with `generateStaticParams` for static generation.

### Services & Pricing
- `lib/services.js` — `SERVICES` array, `CUSTOM_CLAIM_FEE = 10000`, `LAWYER_CONSULT_FEE = 15000`.
- `lib/agentServiceMap.ts` — Maps AgentId → service. `getAgentPayment(agentId)` returns `{amount, description, kind}`.

### Design System
- `app/globals.css` — Navy + gold design system (rebranded from an earlier dark-green/amber palette — if you see hardcoded `rgba(245,166,35,...)`, `rgba(62,207,142,...)`, or `rgba(8,12,10,...)` anywhere, that's leftover old-palette drift, not intentional). Core tokens: `--bg-0 #182A3A`, `--bg-1 #1F3446`, `--bg-2 #28455A`, `--accent #D6BB80` (glow `rgba(214,187,128,0.3)`), `--accent-hover #C7A968`, `--secondary #8FAEC6`, `--danger #EF4444`, `--text-1 #F3EFE3`, `--ease-out cubic-bezier(0.16,1,0.3,1)`. Legacy aliases (`--bg`, `--surface`, `--border`) map onto these so older component CSS didn't need touching.
- `components/Reveal.jsx` — IntersectionObserver scroll reveal wrapper. Props: `delay` (ms).

---

## The 6 Agents

| Agent ID | Name | Price |
|---|---|---|
| `small-claims` | Small Claims Court Agent | ₦10,000 (self-serve) / ₦25,000 (Pandas serves) |
| `recovery-of-premises` | Property Law Agent (tenancy/lease, recovery of premises, deeds, powers of attorney, property searches) | Not flat. See `lib/propertyPricing.ts`, the single source of truth: tenancy/lease ₦25,000 · transfer deeds 2.5% of consideration (no drafting fee) · deed of gift ₦30,000 · legal mortgage ₦30,000 · PoA and agreement for sale ₦5,000 · standard search ₦50,000 · comprehensive search from ₦100,000, lawyer-quoted |
| `contracts` | Contracts & Commercial Agent | ₦5,000 |
| `cac-registration` | CAC Registration Agent | ₦15,000 |
| `judgment-enforcement` | Judgment Enforcement Agent | ₦10,000 + 5% of judgment |
| `lawyer-consultation` | Lawyer Consultation Agent | ₦15,000 |

---

## Case Status Flow

```
draft → document_ready → paid → letter_served → filed → judgment_obtained → closed
```

After `letter_served`: `deadline_at` is set to 14 days ahead (Form SCA 1's prescribed response period for a letter of demand — see lib/agents.ts). Dashboard shows countdown.
After deadline passes: "Escalate to Court Filing" button appears.
After `judgment_obtained`: "Enforce Judgment" button appears (opens `judgment-enforcement` agent).

---

## Deferred Work (Do Not Build Until Asked)

**Phase 7 — Accounting Integrations:** Wave, QuickBooks, Sage — detect overdue invoices automatically. **Hold until user is ready to scale.**

---

## Important Constraints

- `SUPABASE_SERVICE_ROLE_KEY` is **never** used in client components — only in `app/api/` routes.
- `NEXT_PUBLIC_*` vars are safe for browser. Non-prefixed vars are server-only.
- The jsPDF Helvetica font does not support the ₦ glyph — always use `normalizeForPdf()` which substitutes `₦` → `N` before rendering.
- The `document` variable name shadows `window.document` — always use `draftDoc` for the draft document state.
- Edge runtime (`export const runtime = 'edge'`) cannot use Node.js built-ins. Use Node runtime for Resend and Supabase admin calls.
- `/api/extract` uses `anthropic-beta: pdfs-2024-09-25` header for PDF support.

---

## Setup After Clone

```bash
npm install
# Copy .env.local and fill in all keys
# Run supabase-schema.sql in Supabase SQL editor
# Add redirect URLs in Supabase → Auth → URL Configuration:
#   http://localhost:3000/auth/callback
#   https://pandaslp.com.ng/auth/callback
npm run dev
```

---

## Claude Code Tooling Notes

- **HIGGSFIELD MCP connector** — used for the launch campaign brand film (`campaign/launch-video/`): character stills via Higgsfield Soul (character sheet in `01-concept-and-visual-direction.md`), then image-to-video motion generation from the scene-by-scene prompts in `03-higgsfield-storyboard-prompts.md`. Needed again for any future campaign/video work, not for the app itself.
- **No separate design/dataviz skill or tool was used for `campaign/x-thread-graphics/generate-small-claims-journey.mjs`** — it's a plain Node script using Next.js's `next/og` `ImageResponse` (Satori), reusing the same rendering path as `app/opengraph-image.tsx` so the brand look stays consistent. Don't reach for an external image-gen tool here; extend this script instead.
- The core app (Next.js/TypeScript, Supabase, Paystack, jsPDF, Nodemailer, Radix UI) was built with standard Claude Code engineering — no other skills, plugins, or MCP connectors were involved.

---

## Contact Details (Production)
- Email: pandaslegalpractitioners@gmail.com
- Phone: +234 811 808 0189
- Domain: pandaslp.com.ng
- CAC registration: BN 9646741 (Business Name, not a limited liability company registration — this is a different CAC registration type than "RC"; site copy says "registered business," not "registered company," for this reason). Shown in the hero trust strip, the homepage trust badges marquee, and the footer.
