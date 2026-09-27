-- Leads from the free "Is my debt recoverable?" check at /debt-check, and the consent ledger.
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
  marketing_consent BOOLEAN    NOT NULL DEFAULT FALSE,  -- ticked the separate marketing box
  status          TEXT         NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'not_a_fit')),
  staff_notes     TEXT,
  contacted_at    TIMESTAMPTZ,
  updated_by      TEXT,
  notified        BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_debt_checks_created_at ON public.debt_checks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debt_checks_status ON public.debt_checks(status);
-- In case an earlier version of this script already created debt_checks without this column.
ALTER TABLE public.debt_checks ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.debt_checks ENABLE ROW LEVEL SECURITY;


-- ─── Consent records (append-only) ──────────────────────────────────────────────────────────
-- Proof of consent under the NDPA: who agreed, to what exact words, for which purpose and
-- channels, when, and where. Never updated, and never deleted by the app: a withdrawal is a NEW row with
-- granted = false, and a person's current choice is their latest row for that purpose.
-- Written by /api/debt-check, /api/newsletter, /api/unsubscribe and staff in the admin.
CREATE TABLE IF NOT EXISTS public.consent_records (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  email            TEXT,                                -- lower-cased
  phone            TEXT,                                -- 234XXXXXXXXXX
  purpose          TEXT         NOT NULL CHECK (purpose IN ('matter_contact', 'marketing')),
  granted          BOOLEAN      NOT NULL,
  channels         TEXT[]       NOT NULL DEFAULT '{}',
  wording          TEXT         NOT NULL,               -- the exact text the person agreed to
  wording_version  TEXT         NOT NULL,
  source           TEXT         NOT NULL,               -- debt_check, footer_newsletter, unsubscribe_link, admin
  source_id        UUID,                                -- e.g. the debt_checks row
  recorded_by      TEXT,                                -- staff email when entered by staff
  note             TEXT,
  page_url         TEXT,
  user_agent       TEXT,
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_consent_records_email ON public.consent_records(email);
CREATE INDEX IF NOT EXISTS idx_consent_records_phone ON public.consent_records(phone);
CREATE INDEX IF NOT EXISTS idx_consent_records_purpose_time ON public.consent_records(purpose, created_at);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- Belt and braces: block edits at the database level, so a record can never be changed after the
-- fact. Deletes stay possible (by hand in Supabase) so an NDPA erasure request can be honoured;
-- the app itself never deletes.
CREATE OR REPLACE FUNCTION public.consent_records_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent_records is append-only: records cannot be edited; add a new row instead';
END;
$$ LANGUAGE plpgsql SET search_path = '';
DROP TRIGGER IF EXISTS consent_records_no_update ON public.consent_records;
CREATE TRIGGER consent_records_no_update BEFORE UPDATE ON public.consent_records
  FOR EACH ROW EXECUTE FUNCTION public.consent_records_append_only();

NOTIFY pgrst, 'reload schema';

-- Check: should return two rows, consent_records and debt_checks.
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('debt_checks', 'consent_records')
order by table_name;
