# Pandas LP

Next.js app for Pandas LP — AI-powered legal document generation and lawyer consultation for Nigeria.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in real values:

- `ANTHROPIC_API_KEY` — required for the 5 AI legal agents (chat) to work
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` — Paystack checkout; falls back to a test-mode stub if left as placeholder
- `NEXT_PUBLIC_CALENDLY_URL` — lawyer consultation booking calendar; falls back to a stub message if left as placeholder
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — reserved for future persistence, not yet wired up

## Develop

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Structure

- `app/` — Next.js App Router pages and the `/api/chat` Edge function
- `components/` — UI components, including the 5 `AgentChat` chat modals and the existing document-intake/payment flow
- `lib/` — `agents.ts` (AI agent definitions + system prompts), `services.js` (document service definitions), `paystackHelper.js`, `pdfGenerator.js`
