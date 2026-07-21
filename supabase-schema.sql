-- ============================================================
-- Run this in Supabase → SQL Editor → New query
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- Cases table
CREATE TABLE IF NOT EXISTS public.cases (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number      BIGSERIAL   NOT NULL UNIQUE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id         TEXT        NOT NULL,
  service_id       TEXT,
  status           TEXT        NOT NULL DEFAULT 'draft',
  document_title   TEXT,
  document_body    TEXT,
  delivery_option  TEXT,
  -- callback number for the pandas-serves (₦25,000) tier — collected during intake so a
  -- lawyer can reach the client once payment is confirmed; see lib/agents.ts CLIENT_PHONE block
  client_phone     TEXT,
  -- the price quoted for THIS case's drafted document (varies by agent/delivery choice) —
  -- set when the document is finalized, checked against the real Paystack amount at
  -- /api/verify-payment so a client can't just declare an arbitrary amount "paid"
  expected_amount  INTEGER,
  amount_paid      INTEGER     NOT NULL DEFAULT 0,
  -- set once, in /api/verify-payment/route.ts, the moment a payment first verifies — NOT the
  -- same as created_at (a case can sit unpaid for days) or updated_at (touched by every
  -- unrelated status change via the touch_updated_at trigger below). This is what the admin
  -- ops panel's "days since paid" queue and weekly revenue numbers key off of.
  paid_at          TIMESTAMPTZ,
  deadline_at      TIMESTAMPTZ,
  -- follow-up email tracking — 14-day response period (see lib/agents.ts demand letter
  -- templates), so the checkpoints are Day 0 (served), Day 7 (reminder), Day 14 (deadline
  -- passed), not the old Day 0/3/7 cadence these columns are still named after in any
  -- database that predates the fix.
  email_day0_sent  BOOLEAN     NOT NULL DEFAULT FALSE,
  email_day7_sent  BOOLEAN     NOT NULL DEFAULT FALSE,
  email_day14_sent BOOLEAN     NOT NULL DEFAULT FALSE,
  -- fires once, when a case first reaches judgment_obtained or closed (see
  -- app/api/update-case-status/route.ts) — guards against a duplicate send if a case passes
  -- through both of those stages.
  resolution_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  -- attribution — captured client-side from ?ref=/utm_* params at first visit (see
  -- lib/attribution.ts), written in when the case is created. source is the coarse channel
  -- ('space', 'blog', 'ads', 'referral', 'direct'); source_detail is the raw ref/utm string.
  source           TEXT,
  source_detail    TEXT,
  -- escalation linkage (enforcement → original demand case)
  parent_case_id   UUID        REFERENCES public.cases(id),
  -- enforcement specifics
  judgment_amount  INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custom claims — the "describe your own claim" intake, submitted by users who may not
-- be signed in. No owner to scope RLS to, so it's written and read only via the
-- service-role API route (app/api/custom-claim/route.ts), never directly from the browser.
CREATE TABLE IF NOT EXISTS public.custom_claims (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  phone        TEXT,
  description  TEXT        NOT NULL,
  amount_paid  INTEGER     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'new',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Waitlist signups — the "notify me when this agent launches" capture on the homepage.
-- Same access pattern as custom_claims: no owner, service-role-only via app/api/waitlist
-- and app/api/admin/waitlist.
CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service    TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.cases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_claims    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
-- No policies on custom_claims or waitlist_signups: RLS with zero policies blocks anon/authenticated roles
-- entirely, while the service-role client (used only server-side) always bypasses RLS.

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "owner_cases"    ON public.cases;
DROP POLICY IF EXISTS "owner_messages" ON public.messages;

-- Users can only access their own cases
CREATE POLICY "owner_cases" ON public.cases
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can access messages that belong to their cases
CREATE POLICY "owner_messages" ON public.messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.cases WHERE id = case_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.cases WHERE id = case_id AND user_id = auth.uid())
  );

-- Auto-update updated_at on cases
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_touch ON public.cases;
CREATE TRIGGER cases_touch
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- IF YOU ALREADY RAN THE PREVIOUS SCHEMA, run only these ALTERs
-- to add the new columns without recreating the tables:
-- ============================================================
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS email_day0_sent  BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS email_day7_sent  BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS email_day14_sent BOOLEAN NOT NULL DEFAULT FALSE;
--   ^ For a database that never had any email_dayN_sent columns at all. If you already have
--     email_day3_sent/email_day7_sent from before the 14-day fix, use the RENAME migration
--     further down instead of these ADD COLUMN lines.
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS parent_case_id  UUID REFERENCES public.cases(id);
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS judgment_amount INTEGER;
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_number BIGSERIAL UNIQUE;
--   ^ Powers the "Our Ref: PLP/<year>/<case_number>" line on generated letters (see lib/agents.ts).
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS client_phone TEXT;
--   ^ Callback number for the pandas-serves (₦25,000) tier — see lib/agents.ts CLIENT_PHONE block.
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS expected_amount INTEGER;
--   ^ Quoted price for this case, checked against the real Paystack amount at payment time
--     (see app/api/verify-payment/route.ts).
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS source        TEXT;
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS source_detail TEXT;
--   ^ Attribution — see lib/attribution.ts.
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
--   ^ Set once at payment time (see app/api/verify-payment/route.ts) — powers the admin ops
--     panel's action queue and numbers strip (app/admin/page.tsx).
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS resolution_email_sent BOOLEAN NOT NULL DEFAULT FALSE;
--   ^ Guards the resolution email (judgment_obtained/closed) against firing twice for the
--     same case. See app/api/update-case-status/route.ts.
--
-- CREATE TABLE IF NOT EXISTS public.waitlist_signups (
--   id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
--   service    TEXT        NOT NULL,
--   email      TEXT        NOT NULL,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
-- ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
--   ^ Persists "notify me" signups so the admin dashboard has something to list — previously
--     these only existed as a one-off email that vanished if it failed to send.
--
-- ALTER TABLE public.cases RENAME COLUMN email_day7_sent TO email_day14_sent;
-- ALTER TABLE public.cases RENAME COLUMN email_day3_sent TO email_day7_sent;
--   ^ Run these TWO lines IN THIS EXACT ORDER (7->14 first, then 3->7) or the second RENAME
--     will collide with the still-existing email_day7_sent column — renaming 7->14 first is
--     what frees up the "email_day7_sent" name for the second rename to use. This is the fix
--     for the 7-day -> 14-day response period correction — the old column names were left
--     over from before that fix and no longer match what actually gets sent
--     (see lib/emailTemplates.ts).
--
-- ============================================================
-- ATTRIBUTION READOUT — run ad hoc in the SQL editor, not part of setup.
-- Cases by source, by week — rough funnel proxy until Build 3's ops panel
-- has a real dashboard for this.
-- ============================================================
-- SELECT
--   date_trunc('week', created_at) AS week,
--   COALESCE(source, 'unknown')    AS source,
--   COUNT(*)                        AS cases,
--   COUNT(*) FILTER (WHERE status <> 'draft')              AS reached_document,
--   COUNT(*) FILTER (WHERE status IN ('paid','letter_served','filed','judgment_obtained','closed')) AS paid
-- FROM public.cases
-- GROUP BY 1, 2
-- ORDER BY 1 DESC, 3 DESC;
