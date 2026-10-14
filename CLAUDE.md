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
| Email | Nodemailer + Gmail SMTP — follow-up emails at Day 0 / Day 7 / Day 14 after letter served (a scheduler drives Day 7/14, see "Hosting and scheduled jobs" below) |
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
CRON_SECRET                — Bearer token the scheduler sends to app/api/cron/* (see "Hosting and scheduled jobs"). Any long random string.
APP_ENV                    — production | staging | development (lib/appEnv.ts). Set APP_ENV=production on the live server. If unset, a production build counts as production (fails safe: no stub payments, no fake Google Drive).
SITE_URL                   — Only for scripts/run-scheduled-job.mjs: the base URL to call (falls back to NEXT_PUBLIC_SITE_URL).
PLUGIN_API_KEY             — Fixed key checked against the x-plugin-key header on app/api/plugin/intake. Pasted into the OpenAI Action's own auth config once that's set up. Unset = the route 503s.
ADMIN_EMAILS               — Comma-separated staff allowlist checked by lib/adminAuth.ts (isAdminEmail/requireAdmin). Singular ADMIN_EMAIL is also accepted as a fallback — the env var was originally set up under that name. Change requires a redeploy to take effect.
GOOGLE_REVIEW_URL          — Link included in the resolution email (lib/sendCaseEmail.ts) once a case closes. Omitted gracefully if unset — no fabricated URL.
ALLOW_STUB_PAYMENTS        — Set to "true" to allow stub (unverified) payments in real production (isProduction() in lib/appEnv.ts). Dangerous if left on — it means /api/verify-payment trusts the client-reported amount instead of checking with Paystack. Should not be set in normal operation; see app/api/verify-payment/route.ts.
NEXT_PUBLIC_CALENDLY_URL   — Calendly booking link embedded in the lawyer-consultation flow (components/LawyerConsult.jsx).
GOOGLE_OAUTH_CLIENT_ID     — OAuth client (Web application) from the firm's Google Cloud project. Brand sheets, see "Brand sheets" below.
GOOGLE_OAUTH_CLIENT_SECRET — Its secret. Server-only.
GOOGLE_BRANDS_ROOT_FOLDER_ID — Drive folder (in the connected account) that holds every brand's folder.
GOOGLE_SHEET_TEMPLATE_ID   — The "Brand Template" sheet copied for each brand. Row 1 must be the 17 headers in lib/brandSheet.ts.
GOOGLE_TOKEN_ENCRYPTION_KEY — 64 hex chars (32 random bytes). Encrypts the stored Google refresh token and signs the OAuth state.
GOOGLE_FAKE_WORKSPACE      — "true" = in-memory pretend Google for local development (refused in production). Remove once the real Drive is connected.
```

---

## Hosting and scheduled jobs
Not hosted at the moment. Vercel has been dropped; the plan is AWS. Code: github.com/jerrytope/PandasLP (private). The app has no host-specific code:
- **Environment:** `lib/appEnv.ts` (`appEnv()`, `isProduction()`), driven by `APP_ENV`. Never read a host's own variable (such as `VERCEL_ENV`) for this.
- **Scheduled jobs:** two URLs, called with `Authorization: Bearer $CRON_SECRET`. The schedule lives in `scripts/run-scheduled-job.mjs`: `follow-ups` daily at 07:00 UTC (`0 7 * * *`), `brand-sheets` every 15 minutes (`*/15 * * * *`). Any scheduler works: a crontab line like `npm run job -- follow-ups` with `SITE_URL` and `CRON_SECRET` set, or EventBridge Scheduler / an API destination calling the URL with that header. The script exits non-zero on failure.
- **Long requests:** the brand sync routes set `maxDuration = 300`. A plain Node server (`next start`) has no limit; a host with a request time limit must allow 300 s for them.

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
- `app/api/cron/follow-ups/route.ts` — The scheduler calls this daily (see "Hosting and scheduled jobs"), authenticated via `CRON_SECRET` (not a user session — there is no user for a scheduled job). Finds every `letter_served` case whose Day 7 or Day 14 checkpoint is due and hasn't been sent yet, and sends it. This is the only thing that makes the "escalating follow-up, zero effort from you" promise on the homepage actually true — without it, Day 7/14 emails would need a human to remember to trigger them manually, which defeats the point.
- `lib/sendCaseEmail.ts` — Shared email-sending logic (resolve recipient, build template, send, mark `email_dayN_sent`) used by both `/api/send-email` (session-triggered) and `/api/cron/follow-ups` (system-triggered), so there's one implementation instead of two copies drifting apart.
- `lib/emailTemplates.ts` — HTML email templates for Day 0, Day 7, Day 14 follow-ups.

### Payments
- `app/api/verify-payment/route.ts` — Node runtime. The only place a case is ever marked `paid`. Requires the caller's session to own the case, then independently confirms the transaction with Paystack's `/transaction/verify` endpoint (or, if `PAYSTACK_SECRET_KEY` is still a placeholder, accepts the stub checkout's result — there's no real gateway to check against yet). Compares the verified amount to `cases.expected_amount` and rejects a mismatch. For `small-claims`, `delivery_option` (`self-serve` vs `pandas-serves`) is derived from the verified amount, never trusted from the client.
- `cases.expected_amount` — set ONLY by `app/api/save-document/route.ts` when a document is drafted (or re-drafted/translated) before payment. The AI's `PRICE:` line may only pick one of the fees in `lib/casePricing.ts` (`resolveCasePrice`); anything else is rejected with a 422. Judgment enforcement is computed from `cases.judgment_amount`, and flat-fee agents ignore the AI's figure. This is what `/api/verify-payment` checks the real payment against, and a case without one can't be paid. If you add an agent or change a fee, update `lib/casePricing.ts` too. TypeScript's exhaustive `never` check flags a new `AgentId` with no rule.
- `lock-case-columns.sql` (also `supabase/migrations/…_lock_case_columns.sql`) — column-level privileges. The browser (`authenticated` role) may only INSERT `user_id, agent_id, source, source_detail, parent_case_id, judgment_amount` and UPDATE `client_phone, client_email, recipient_phone` on `cases`, and may only INSERT into `messages`. Everything else (status, price, payment, review fields, document text) goes through API routes using the service-role key. A new column the browser must write needs an explicit `GRANT`, otherwise the write fails with "permission denied for table cases".
- `lib/paystackVerify.ts` — the shared server-side payment check, used by every route that takes money (`/api/verify-payment` for cases, `/api/custom-claim` for the custom-claim routing fee). `verifyPayment()` asks Paystack (or accepts the stub checkout when there's no real key and it isn't production) and checks the amount against the server's expected price, never the browser's. `claimPaymentReference()` records each accepted reference in `payment_references` (primary key = reference), so one payment can't be replayed to pay for a second case or claim. Any new paid flow must call both.
- `components/PaymentForm.jsx` / `lib/paystackHelper.js` — client-side checkout only (real Paystack Inline or the stub timeout). Never itself marks anything paid — always hands the result to `AgentChat.tsx`'s `handlePaymentDone`, which calls `/api/verify-payment`.

### Brand sheets (B2B loan recovery) — in progress
**Progress is tracked in `plans/`**: a README with a status table, plus one checklist file per phase. When a phase item is finished, tick its box and update the README's status table in the same change.

Lenders ("brands") send borrowers in bulk through their own Google Sheet, one borrower per row. The plan is in four phases, **all built**: phase 1 is the database, Google connection, Brands admin and the create-brand flow; phase 2 is the sync job (Case IDs, checks, drafting with the existing lawyer-intake agent); phase 3 is lawyer approval, serving and the borrower reminders; phase 4 is change flags, the brand's court approval, outcomes and monthly billing. Phase 2 has passed its check on the real Drive (Moniepoint, the test brand, 8 Oct 2026); phases 3 and 4 still need theirs.
- `add-brands.sql`: `brands`, `brand_cases` (one per borrower, `case_ref` like `LAPO-0001` is the identity, never the row number), `brand_case_events` (audit log; its partial unique index on one-time events is the "never process twice" guarantee) and `brand_change_flags`. Also `google_connection`, plus `cases.brand_id`. `allocate_brand_case_ref()` hands out Case IDs atomically. **The database is the source of truth, not the sheet.**
- `lib/brandSheet.ts`: the fixed 17-column layout, which columns are the brand's and which are the app's, status labels, and header validation.
- `lib/google/`: `oauth.ts` connects the firm's own Google account once. Service accounts can't own files in an ordinary Drive, so every sheet is created as that account. `googleWorkspace.ts` (the real Drive/Sheets REST calls, plain `fetch`) and `fakeWorkspace.ts` (in memory) both implement `BrandWorkspace`. `runSetupSteps` saves each step as it succeeds, so a failed setup resumes on "Retry setup". Sheets and folders are shared with named emails only, never by link. The Case ID column, the header row and the 6 agent columns are protected.
- **Edit / delete:**
  - Edit changes the name, contacts, fee and active flag. Removed contacts lose Drive access, added ones are invited, and a rename renames the folder and sheet. **The code is never editable**, because it's in every Case ID.
  - Delete is only allowed for a brand with **no borrowers**. It moves the Drive folder to the bin (30 days) and needs the code typed to confirm. A brand with borrowers can only be deactivated, which keeps the records but stops syncing.
- **Phase 2, the sync** (`lib/brandSync.ts`; plan in `plans/phase-2-sync-and-drafting.md`; schema additions in `add-brand-sync.sql`, which adds `brands.address`, `brands.owner_user_id`, `brand_cases.last_error`, `attempts` and `letter_file_id`):
  - **Schedule:** the scheduler calls `app/api/cron/brand-sheets` every 15 minutes, but it only runs once `firm_settings.brand_sync_interval_minutes` has passed. "Sync now" is `POST /api/admin/brands/sync`.
  - **One run at a time:** `runBrandSync` takes a lease (`brand_sync_lease_until`).
  - **Per brand:**
    1. assign Case IDs, re-reading the sheet before writing them
    2. claim New rows with a conditional `status='new'` → `'checking'` update
    3. check them with `checkBorrower` (`lib/brandRows.ts`, pure) and `workspace.checkDocument`
    4. draft with `draftBrandLetter` (`lib/brandLetter.ts`): the existing `SMALL_CLAIMS_LAWYER_INTAKE_PROMPT` with the row's facts relayed. OUTSTANDING QUESTIONS become Missing Documents.
    5. insert the unique `letter_drafted` event **before** saving
    6. create a `cases` row (owner is `brands.owner_user_id`; status `document_ready`; `expected_amount` = brand fee)
    7. upload a DRAFT `.docx` to Letters
    8. rewrite the drifted agent cells from the database
  - **Rows:** found by Case ID, re-read straight before every write. Cells are read UNFORMATTED (dates arrive as serials, typed dates are read day-first).
  - **Tests:** `brandSync.integration.test.ts` runs against the local database and skips if it isn't running.
- `lib/brandStore.ts`: the helpers both the sync and phase 3 use: the event log, `claimOnce` (records a one-time step before doing it), status changes, and writing a borrower's app cells to the sheet by Case ID.
- **Phase 3, approval, serving and reminders** (`lib/brandServing.ts`; schema `add-brand-serving.sql` adds `brand_cases.final_letter_at`):
  - A brand matter is never paid per letter, so `app/api/update-case-status` lets `markReviewed` and `markServed` start from `document_ready` when `cases.brand_id` is set. Every other gate is unchanged (checklist, reviewed before served). In the admin, `inReviewStage()` in `app/admin/components/types.ts` is the same rule.
  - **Approval** (`approveBrandLetter`, called after `markReviewed`): Lawyer Approved, `billable_at`, then the FINAL `.docx` replaces the DRAFT in place (same Drive file, so the Letter Link keeps working). Google failures never undo an approval; the sync retries the final letter (`retryFinalLetters`).
  - **Serving:** "Serve Borrower by Email" (`POST /api/admin/brands/serve`, `serveBrandCaseByEmail`) emails the stamped PDF (`case-documents/reviewed/<caseId>.pdf`) to the borrower with the brand in cc, then moves the matter to `letter_served` with the 14-day deadline. "Mark Served" after a WhatsApp serve calls `recordBrandServed`.
  - **Reminders** (`sendDueReminders`, run by the sync): Day 7 and Day 14 to the borrower, brand in cc, only 08:00 to 19:59 Lagos time. Each is claimed in `brand_case_events` before sending and released if the email fails. A date already in the sheet's Day 7/14 cell blocks that reminder for good (claimed as unconfirmed) and tells staff to check the Sent mail. After Day 14: `awaiting_brand_decision_at`.
  - Borrower email wording is in `lib/brandEmails.ts`. The old client follow-ups (`sendCaseEmail` follow_up, `/api/cron/follow-ups`) refuse brand matters.
  - The case drawer shows `BrandCaseTimeline` (all events) for a brand matter. Tests: `brandServing.integration.test.ts` (local database, including the real status route) and `brandEmails.test.ts`.
- **Phase 4, exceptions and billing** (schema `add-brand-billing.sql`: `brand_cases.billable_fee_kobo`, `invoices.brand_id`, `brand_change_flags.resolution`):
  - `lib/brandExceptions.ts`. `checkRowChanges` runs in every sync: from `letter_drafted` on, a change to the brand's columns is flagged (`edited_after_processing`, old and new value), never reprocessed, and the brand is emailed once per new change. Notes changes are logged (`notes_updated`). A vanished row is flagged `row_missing` and auto-closed if it comes back. `resolveFlag`: accept (the new value replaces it in `brand_cases.borrower` and the hash) or keep (the same value is never flagged again).
  - Outcomes: `setOutcome` (paid, disputed, closed; allowed stages in `OUTCOME_FROM`). Court: `recordCourtApproval` (note plus a PDF/PNG/JPG, type sniffed, at most 3 MB so the base64 body fits serverless request limits (AWS Lambda: 6 MB), stored in the private `case-evidence` bucket since `case-documents` only takes PDFs). `courtFilingAllowed` is checked by `markFiled` in `app/api/update-case-status`.
  - `lib/brandBilling.ts`: `createBrandInvoice(brandId, 'YYYY-MM')` makes a draft invoice, one line per approved, unbilled letter up to the end of that Lagos month, at `billable_fee_kobo`. Letters are claimed with a conditional `billed_invoice_id IS NULL` update; voiding the invoice (`/api/admin/invoices` PATCH) calls `releaseVoidedInvoice`.
  - API: `/api/admin/brands/cases` (POST actions `retry`, `outcome`, `court_approval`, `resolve_flag`; GET `?awaiting=1`), `/api/admin/brands/billing`. UI: flags in `BrandBorrowers`, outcome and court approval in `BrandCaseTimeline`, `AwaitingBrandDecision` in the Action Queue, `BrandBilling` on each brand card. Tests: `brandExceptions.integration.test.ts`, `brandBilling.test.ts`.
- **Phase 5A, borrowers by API** (plan `plans/phase-5-api-intake.md`; schema `add-brand-api.sql`: `brands.intake_channel` sheet/api/both, `brand_api_keys` (SHA-256 hashes only), `brand_cases.source`/`external_ref`/`is_test`, `brand_case_documents`, `brand_api_requests`). Verified locally 10 Oct 2026 (type check clean, all tests pass); not yet tried with a real brand.
  - `POST /api/v1/borrowers` (one borrower, or `{ borrowers: [...] }` up to 50, body under 5 MB) and `GET /api/v1/borrowers/{caseId or loanId}`. Auth: `Authorization: Bearer plp_live_…` / `plp_test_…`, 60 calls a minute per key, every call logged.
  - `lib/brandApiInput.ts` (pure): key format, JSON fields → the sheet's column names (so `checkBorrower` runs unchanged, with `documentsStored`), safe link rules. `lib/brandApi.ts`: auth, documents (base64 in the JSON or a link fetched once: https only, private addresses refused after DNS lookup, no redirects, 1 MB per borrower, real type sniffed), stored in the private `case-evidence` bucket.
  - Never twice: unique `(brand_id, is_test, external_ref)`. Resubmitting the same loan returns the existing case (identical details and files, compared by `brand_case_documents.content_sha256`, count as a duplicate); it corrects the borrower only while `new` (unclaimed) or `missing_documents`.
  - The sync claims API borrowers from the database (up to `maxApiDraftsPerBrand`, 20) and never drafts `is_test` ones. API brands need no Google set-up, get no Drive copy (`letter_url` null) and are skipped by `checkRowChanges` and `retryFinalLetters`. Between hourly sheet runs, `runBrandSync` still does an API-only pass if live API borrowers are waiting.
  - Staff: `/api/admin/brands/api` (set channel, create key shown once, revoke, recent calls). Tests: `brandApiInput.test.ts`, `brandApi.integration.test.ts`.
- **Phase 5B, telling the brand** (schema `add-brand-webhooks.sql`: `brand_webhooks` (live/test address, signing secret), `brand_webhook_deliveries` (the outbox), trigger `queue_brand_webhook`). Verified locally 10 Oct 2026.
  - **Webhooks are queued by the database**, not by code: the trigger on `brand_case_events` turns `missing_documents`, `awaiting_brand_decision`, `outcome` and `status_changed` to letter_drafted / lawyer_approved / served / day7_sent / day14_sent into a delivery, for API borrowers only. A new step only reaches the brand if it is logged as one of these. Claims (`served`, `day7_reminder`…) are deliberately not mapped: they're removed if the email fails.
  - `lib/brandWebhooks.ts` sends them: the brand-sheets cron (every 15 minutes, whether or not the sync is due) and `deliverForMatter`/`deliverForBorrower` straight after approve, serve and outcome. Signed by `lib/brandWebhookFormat.ts` (pure, unit-tested; `verifyWebhookSignature` is what the brand does). Retries just under 24 hours, then `failed` and one staff email. At least once: the body's `id` is stable for the brand to drop repeats. A never-tried delivery is always due (the database clock can run ahead of the app's).
  - `GET /api/v1/borrowers/{id}/letter` (once lawyer-approved: the stamped `case-documents/reviewed/<caseId>.pdf` if attached, else the approved text via `buildTextDocumentBuffer`), `POST /api/v1/borrowers/{id}/notes` (`addNote`: dated, appended; reopens Missing Documents). Resending a loan after drafting started flags changed fields via `flagEdits` in `lib/brandExceptions.ts` (shared with sheet edits); empty notes in a resend never wipe notes.
  - Staff actions on `/api/admin/brands/api`: `set_webhook` (secret returned once), `rotate_webhook_secret`, `send_test_event`, `retry_delivery`; GET includes the delivery log. Tests: `brandWebhookFormat.test.ts`, `brandWebhooks.integration.test.ts`.
- **Phase 5C, test mode, docs and admin** (schema `add-brand-test-mode.sql`: `brand_api_keys.issued_before_test_passed_reason`). Verified locally 10 Oct 2026 (388 tests); admin screens type-checked but not yet clicked through in a browser.
  - `lib/brandTestMode.ts`: test-key borrowers walk new → letter_drafted → lawyer_approved → served → day7_sent → day14_sent (awaiting) → closed, one step per cron run once 5 minutes have passed (`advanceTestBorrowers`, called by the brand-sheets cron), or at once with `POST /api/v1/borrowers/{id}/advance` (test key only). Steps are logged like real ones, so the trigger sends webhooks to the TEST address. No AI, no `cases` row, `billable_at` stays null, never emailed: the sync's reminder query, the awaiting queue, billing and the brand counts all filter `is_test = false`. Their letter is `sampleLetterPdf` (SAMPLE watermark).
  - Live keys: `testModeProgress` (test borrower sent, one reached Day 14, letter fetched with the test key, a test webhook delivered). `create_key` with mode live refuses until passed unless staff give a reason (kept on the key).
  - Docs: `lib/brandApiSpec.ts` (OpenAPI 3.1, served at `/api/v1/openapi.json`) and the human page `app/developers/api/page.tsx` (noindex). `brandApiSpec.test.ts` fails if a route under `app/api/v1/borrowers` isn't in the spec or vice versa.
  - Admin: Brands → a brand → "API" (`BrandApiPanel.tsx`): channel, test-mode checks, keys (shown once, revoke, live-key reason), webhook addresses and secret, test event, delivery log with Retry, recent calls. "New brand" asks Sheet / API / Both; an API-only brand skips Google set-up. Borrowers list: loan ID column, Real/Test switch, per-row History (`GET /api/admin/brands/cases?brandCaseId=`). A brand with only test borrowers can be deleted (they go with it).
  - `deliverDueWebhooks({ brandId })` and `advanceTestBorrowers(now, brandId)` take an optional brand so the integration tests (which run in parallel on one database) don't take each other's rows.
- `lib/brands.ts`, `app/api/admin/brands/route.ts` (list/create/update/retry/delete), `app/api/admin/google/{connect,callback}`, UI in `app/admin/components/brands/BrandsView.tsx` (sidebar "Brands").
- One-time Google setup for the owner: create the Drive folder and template sheet, then a Cloud project with the Sheets and Drive APIs enabled. Set up the OAuth consent screen as External, with the drive and spreadsheets scopes, **published to Production** (in Testing, tokens expire after 7 days). Create a Web OAuth client with redirect URIs `http://localhost:3000/api/admin/google/callback` and `https://pandaslp.com.ng/api/admin/google/callback`. Set the env vars, then Admin → Brands → Connect Google Drive.

### Property Law Agent rebuild — in progress
The `recovery-of-premises` agent is being rebuilt as a router + 7 sub-agents with tools and a saved matter record. **Plan and progress: `docs/property_agent_plans/`** (README status table, `tasks.md`, one file per phase). Tick tasks there as they finish. Phase 1 (foundation, no client-visible change) is built:
- `lib/claude.ts` takes `tools`/`toolChoice` and returns `content` blocks. `lib/agentRuntime/runAgent.ts` is the tool loop (`maxSteps`, `is_error` results, early stop on hand-off/escalation).
- `lib/property/`: `types.ts` (the 7 areas), `calc.ts` (arrears, mesne profits, Notice to Quit, Seven Days' Notice, Lagos advance rent — every naira figure and date), `matterStore.ts` (`property_matters` / `property_matter_events`, schema `add-property-matters.sql`), `tools/` (the shared tools; `emit_document` sets the price via `getFee` and renders the usual `<<<DOCUMENT>>>` block).
- `lib/propertyPricing.ts`: `PROPERTY_DOCUMENTS` (type → area, fee) and `getFee`. A fee not yet set is `null` and is emitted as PRICE 0 with "a lawyer will confirm the fee".
- `AgentChat.tsx` creates the property agent's case before its first message.

### Blog
- `lib/blogPosts.ts` — 4 debt recovery articles as TypeScript objects with inline HTML content.
- `app/blog/page.tsx` — Blog index with SEO metadata.
- `app/blog/[slug]/page.tsx` — Article page with `generateStaticParams` for static generation.

### Services & Pricing
- `lib/services.js` — `SERVICES` array, `CUSTOM_CLAIM_FEE = 10000`, `LAWYER_CONSULT_FEE = 15000`.
- `lib/agentServiceMap.ts` — Maps AgentId → service. `getAgentPayment(agentId)` returns `{amount, description, kind}`.

### Design System
- `app/globals.css` — Light ivory + gold design system (it was navy + gold before that, and dark-green/amber before that; hardcoded `rgba(245,166,35,...)`, `rgba(62,207,142,...)` or `rgba(8,12,10,...)` anywhere is leftover old-palette drift). Core tokens: `--bg-0 #FAFAF8` (canvas), `--bg-1 #F5F3F0`, `--bg-2 #FFFFFF` (cards), `--border-subtle #E8E4DF`, `--accent #B8860B`, `--text-1 #1A1A1A`, `--text-2 #6B6B6B`, `--text-3 #7D7A72`, `--ease-out cubic-bezier(0.16,1,0.3,1)`. Fonts come from `app/layout.jsx` as `--font-display` / `--font-mono`. Legacy aliases (`--bg`, `--surface`, `--border`) map onto these so older component CSS didn't need touching. The old navy (`#182A3A`) survives only as the admin sidebar, defined in `app/admin/components/shell/AdminShell.module.css`.

### Admin panel layout
- `app/admin/layout.tsx` wraps every `/admin/*` page in `AdminShell` (`app/admin/components/shell/`): a navy left sidebar, a sticky top bar, and the content area. On screens under 1024px the sidebar becomes an off-canvas drawer.
- The shell does the one signed-in check for the whole admin. Pages get the user, `setTopbarMeta` and `denyAccess` (call it on a 403) from `useAdminShell()`. Staff status is still decided only by the server (`lib/adminAuth.ts`).
- `/admin` is a single page. The visible section comes from `?section=overview|queue|leads|matters|claims|finance|waitlist` (and `&sub=invoices|settings` for Finance). `adminSections.ts` holds the list. `?caseId=` with no section opens All Matters, which keeps the staff email "review" links working. A new section means adding it to `adminSections.ts`, an icon in `AdminSidebar.tsx`, and a branch in `app/admin/page.tsx`.
- `components/Reveal.jsx` — IntersectionObserver scroll reveal wrapper. Props: `delay` (ms).

---

## The 6 Agents

| Agent ID | Name | Price |
|---|---|---|
| `small-claims` | Small Claims Court Agent | ₦10,000 (self-serve) / ₦25,000 (Pandas serves) |
| `recovery-of-premises` | Property Law Agent (tenancy/lease, recovery of premises, deeds, powers of attorney, property searches) | Not flat. See `lib/propertyPricing.ts`, the single source of truth: tenancy/lease ₦25,000 · transfer deeds 2.5% of consideration (no drafting fee) · every other document ₦30,000 · standard search ₦50,000 · comprehensive search from ₦100,000, lawyer-quoted |
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

### Local database (optional, recommended for development)
`supabase/` holds a local Supabase setup (Docker + `npx supabase`). `npx supabase start` runs Postgres/Auth/Storage locally and applies `supabase/migrations/` — copies of the root `supabase-schema.sql` + `add-*.sql`/`fix-*.sql` files, in order. A new root SQL migration must also be copied into `supabase/migrations/` (next timestamp) or the local DB won't have it. `project_id` in `supabase/config.toml` must stay a plain name (`pandaslp`) — the folder name `NAIJACLAI.-APP` is an invalid hostname and breaks startup. Locally: API `http://127.0.0.1:54321`, Studio (DB browser) `:54323`, magic-link emails land in Mailpit `:54324` instead of a real inbox.

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
