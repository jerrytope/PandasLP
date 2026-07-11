# Pandas LP — Project Context for Claude

## What This Is
Pandas LP is an AI-native law firm in Nigeria. It is a registered company (CAC) and will notify the NBA shortly. The product is a Next.js web app where AI agents conduct a guided legal interview, draft court-ready documents, and Pandas LP's team serves and files them on behalf of clients.

This is NOT a document template tool. Pandas LP is a law firm that can represent clients in court.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, TypeScript (`allowJs: true`), React 19 |
| AI | Anthropic Claude API (`claude-sonnet-4-6`, `max_tokens: 4096`), Edge Runtime |
| Auth | Supabase Auth — email magic link (no password) |
| Database | Supabase PostgreSQL — `cases` + `messages` tables with RLS |
| Email | Nodemailer + Gmail SMTP — follow-up emails at Day 0 / Day 3 / Day 7 after letter served |
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
NEXT_PUBLIC_SITE_URL       — Production URL (https://pandaslp.ng)
```

---

## Key Files

### AI & Agents
- `lib/agents.ts` — All 6 agents: AgentId type, Agent interface, AGENTS record, system prompts, document templates
- `app/api/chat/route.ts` — Edge runtime. Receives `{messages, agentId}`, calls Claude, returns response. Injects DOCUMENT CONTEXT RULE into every system prompt.
- `app/api/extract/route.ts` — Node runtime. Receives `{fileBase64, mediaType, filename}`, sends to Claude for fact extraction from uploaded PDFs/images. Returns `{facts}` string.

### Document Flow
- `components/AgentChat.tsx` — Handles: interview, file upload (📎), document block parsing (`<<<DOCUMENT>>>`), watermarked PDF preview, payment, Supabase persistence. Takes a `fullPage` prop: `false` renders the original floating modal card (`.overlay`/`.modal` in `AgentChat.module.css`); `true` renders as a page-filling section (`.pageOuter`/`.pageModal`) with no dark backdrop, used by the dedicated chat route below.
- `lib/pdfGenerator.js` — jsPDF: panda logo, letterhead, footer, watermark, bold text rendering, ₦→N substitution.
- `DOCUMENT_BLOCK_RE` regex in AgentChat: parses `<<<DOCUMENT>>>TITLE/PRICE/PRICE_LABEL/---/body<<<END_DOCUMENT>>>`.

### Chat Page vs. Marketing Page
- `app/page.jsx` — Marketing homepage only (hero, pricing, agents, FAQ via `LandingPage.jsx`) plus the custom-claim intake, payment-gate, and judgment-enforcement judgment-amount intake steps. It no longer renders `AgentChat` directly — every "open an agent" action calls `router.push('/agent/<agentId>')`.
- `app/agent/[agentId]/page.jsx` — The chat's own route (e.g. `/agent/small-claims`). Client component: resolves `agentId` against `AGENTS`/`getAgentPayment`, redirects to `/` if invalid, shows `AuthModal` inline if signed out (no redirect-then-return — the user finishes sign-in on this same page via cross-tab session detection), and renders `AgentChat` with `fullPage`. Reads `?resume=<caseId>` (loads case + messages from Supabase, same as the old in-page flow), `?fileCourt=1` (injects the standard court-filing escalation auto-message), and `?auto=<urlencoded text>` (arbitrary auto-message — used by the judgment-enforcement handoff from `EnforcementIntake`). On approval, `lawyer-consultation` shows `LawyerConsultBooking` in place; every other agent redirects to `/dashboard`.
- Dashboard "Resume" / "Prepare Court Filing" links point at `/agent/<agentId>?resume=<id>[&fileCourt=1]`. "Enforce Judgment" still points at `/?enforceFrom=<id>` — the judgment-amount intake (`EnforcementIntake`) stays on the homepage since the agent isn't known until it creates the case, then it pushes to `/agent/judgment-enforcement?resume=<id>&auto=...`.

### Auth & Database
- `lib/supabaseClient.ts` — Browser Supabase client (anon key, localStorage session).
- `lib/supabaseAdmin.ts` — Server-only admin client (service role key). Import ONLY in API routes.
- `app/auth/callback/page.tsx` — Handles magic link redirect, waits for session, redirects to `/dashboard`.
- `supabase-schema.sql` — Full schema with RLS. Run in Supabase SQL editor. **If tables already exist, use the ALTER TABLE section at the bottom.**

### Dashboard & Follow-up
- `app/dashboard/page.tsx` — Case history. Visual 4-step timeline (Paid → Served → Filed → Judgment Won). Mark as Served button (triggers Day 0 email + sets 7-day deadline). Escalate to Court Filing CTA (appears when deadline passes). Enforce Judgment CTA (appears after judgment won).
- `app/api/send-email/route.ts` — Sends the Nodemailer/Gmail SMTP email for payment-confirmed or day 0/3/7. Requires the caller's session to match the case's owner (see Payments below for the same pattern). Updates `email_dayN_sent` on the case.
- `lib/emailTemplates.ts` — HTML email templates for Day 0, Day 3, Day 7 follow-ups.

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
| `recovery-of-premises` | Recovery of Premises Agent | ₦5,000 |
| `contracts` | Contracts & Commercial Agent | ₦5,000 |
| `cac-registration` | CAC Registration Agent | ₦15,000 |
| `judgment-enforcement` | Judgment Enforcement Agent | ₦10,000 + 5% of judgment |
| `lawyer-consultation` | Lawyer Consultation Agent | ₦15,000 |

---

## Case Status Flow

```
draft → document_ready → paid → letter_served → filed → judgment_obtained → closed
```

After `letter_served`: `deadline_at` is set to 7 days ahead. Dashboard shows countdown.
After deadline passes: "Escalate to Court Filing" button appears.
After `judgment_obtained`: "Enforce Judgment" button appears (opens `judgment-enforcement` agent).

---

## Deferred Work (Do Not Build Until Asked)

**Phase 1 — CAC Credibility Signals:** Add RC number to footer + hero trust strip. **Hold until incorporation documents arrive.**

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
#   https://pandaslp.ng/auth/callback
npm run dev
```

---

## Contact Details (Production)
- Email: pandaslegalpractitioners@gmail.com
- Phone: +234 811 808 0189
- Domain: pandaslp.ng
