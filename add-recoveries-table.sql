-- Paste this whole block into the Supabase SQL editor and run it once.
-- Safe to re-run: every statement is IF NOT EXISTS.
--
-- RECOVERIES  (added 2026-09-05)
--
-- Confirmed money actually recovered for a client. This is the source of the
-- public "recovered for clients" figure on the homepage, so it is deliberately
-- strict: every row needs a named confirmer, a proof note, and, when the client
-- did not get everything they were owed, a written reason why.
--
-- A case can have more than one row (a debtor paying in instalments), so the
-- public total is a SUM over rows, not a per-case field.
--
-- If your database already exists, run just this block.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.recoveries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  -- naira, whole units, same convention as cases.amount_paid / cases.expected_amount
  amount_recovered  INTEGER     NOT NULL CHECK (amount_recovered > 0),
  -- what the client was actually claiming, captured at confirmation time so "full or
  -- partial" stays meaningful even if the claim is edited later
  claim_amount      INTEGER,
  is_full           BOOLEAN     NOT NULL,
  -- required whenever is_full is false. The CHECK is the point of this table: you cannot
  -- record a partial recovery without saying why the rest was not recovered.
  shortfall_reason  TEXT,
  -- how the recovery was evidenced: a transfer reference, a bank narration, a court
  -- payment receipt number. Free text, but never empty.
  proof_note        TEXT        NOT NULL CHECK (length(trim(proof_note)) > 0),
  -- optional supporting file in the case-documents bucket, path recovery-proof/<id>.<ext>
  proof_path        TEXT,
  confirmed_by      TEXT        NOT NULL,
  confirmed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- stamped only once the confirmation email has actually left, so "client notified" in the
  -- admin UI means sent, not intended. Null means no email was sent for this recovery.
  client_notified_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT partial_recovery_needs_a_reason
    CHECK (is_full OR (shortfall_reason IS NOT NULL AND length(trim(shortfall_reason)) > 0))
);

CREATE INDEX IF NOT EXISTS idx_recoveries_case_id      ON public.recoveries(case_id);
CREATE INDEX IF NOT EXISTS idx_recoveries_confirmed_at ON public.recoveries(confirmed_at DESC);

-- RLS on, with no client-facing policy: every read and write goes through the admin API
-- using the service role. Nothing here is ever queried with the anon key.
ALTER TABLE public.recoveries ENABLE ROW LEVEL SECURITY;

-- Safe to run whether or not the table already existed without this column.
ALTER TABLE public.recoveries ADD COLUMN IF NOT EXISTS client_notified_at TIMESTAMPTZ;
