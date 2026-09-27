-- Leads from the free "Is my debt recoverable?" check at /debt-check.
--
-- A row is only written when the visitor asks for a lawyer to contact them (name + phone given
-- with consent); people who just read their result leave nothing behind. `source` records which
-- link brought them (?ref= / utm_source), so the admin can see which post produced leads.
--
-- Additive only, safe to run more than once. RLS on with no policies: the public API writes with
-- the service role and only admins read, same as custom_claims.
-- Run it in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.debt_checks (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  name            TEXT         NOT NULL CHECK (length(trim(name)) > 0),
  phone           TEXT         NOT NULL,              -- normalised, 234XXXXXXXXXX
  email           TEXT,
  answers         JSONB        NOT NULL,
  amount_naira    BIGINT       NOT NULL CHECK (amount_naira > 0),
  verdict         TEXT         NOT NULL CHECK (verdict IN ('strong', 'good', 'possible', 'difficult', 'review')),
  next_step       TEXT         NOT NULL CHECK (next_step IN ('demand_letter', 'property', 'lawyer_review')),
  note            TEXT,                                -- anything the visitor added
  source          TEXT,
  source_detail   TEXT,
  consent         BOOLEAN      NOT NULL DEFAULT FALSE,
  status          TEXT         NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'not_a_fit')),
  staff_notes     TEXT,
  contacted_at    TIMESTAMPTZ,
  updated_by      TEXT,
  notified        BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_debt_checks_created_at ON public.debt_checks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debt_checks_status ON public.debt_checks(status);
ALTER TABLE public.debt_checks ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Check: should return one row, debt_checks.
select table_name from information_schema.tables where table_schema = 'public' and table_name = 'debt_checks';
