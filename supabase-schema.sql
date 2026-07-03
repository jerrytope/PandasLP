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
  amount_paid      INTEGER     NOT NULL DEFAULT 0,
  deadline_at      TIMESTAMPTZ,
  -- follow-up email tracking
  email_day0_sent  BOOLEAN     NOT NULL DEFAULT FALSE,
  email_day3_sent  BOOLEAN     NOT NULL DEFAULT FALSE,
  email_day7_sent  BOOLEAN     NOT NULL DEFAULT FALSE,
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

-- Row Level Security
ALTER TABLE public.cases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

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
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS email_day0_sent BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS email_day3_sent BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS email_day7_sent BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS parent_case_id  UUID REFERENCES public.cases(id);
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS judgment_amount INTEGER;
-- ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_number BIGSERIAL UNIQUE;
--   ^ Powers the "Our Ref: PLP/<year>/<case_number>" line on generated letters (see lib/agents.ts).
