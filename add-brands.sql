-- ============================================================
-- Brands: B2B lenders (microfinance banks etc.) who send borrowers in bulk through their own
-- Google Sheet. One sheet + Drive folder per brand, one borrower per row, one brand_cases row
-- per borrower. See lib/brandSheet.ts and lib/google/.
--
-- THE DATABASE IS THE SOURCE OF TRUTH, NOT THE SHEET. The sheet is a view the brand types
-- into; every status/date shown in it is copied from here.
--
-- Everything here is server-only: RLS on with no policies, and no privileges for the
-- browser's roles. Written by API routes / the sync job with the service-role key.
--
-- RUN ORDER ON PRODUCTION: run this BEFORE deploying the code that ships with it. Safe to re-run.
-- ============================================================

-- The one connected Google account that owns every brand sheet and folder (the firm's Drive).
-- The refresh token is AES-GCM encrypted with GOOGLE_TOKEN_ENCRYPTION_KEY before it gets here.
CREATE TABLE IF NOT EXISTS public.google_connection (
  id                      SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  account_email           TEXT        NOT NULL,
  refresh_token_encrypted TEXT        NOT NULL,
  scopes                  TEXT        NOT NULL,
  connected_by            TEXT        NOT NULL,
  connected_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error              TEXT,
  last_error_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.brands (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL CHECK (length(trim(name)) > 0),
  -- Prefix of every Case ID for this brand, e.g. LAPO -> LAPO-0001. Never reused or changed.
  code                  TEXT        NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{2,8}$'),
  -- The ONLY people the sheet and folder are shared with. Never "anyone with the link".
  contact_emails        TEXT[]      NOT NULL CHECK (array_length(contact_emails, 1) >= 1),
  per_letter_fee_kobo   BIGINT      NOT NULL CHECK (per_letter_fee_kobo >= 0),
  -- Google workspace for the brand, filled in step by step so a failed setup can resume
  -- where it stopped (see lib/google/brandWorkspace.ts).
  drive_folder_id       TEXT,
  documents_folder_id   TEXT,
  letters_folder_id     TEXT,
  sheet_id              TEXT,
  sheet_url             TEXT,
  sheet_tab_id          INTEGER,
  sheet_protected_at    TIMESTAMPTZ,
  shared_with           TEXT[]      NOT NULL DEFAULT '{}',
  setup_completed_at    TIMESTAMPTZ,
  -- Next number handed out by allocate_brand_case_ref(). Never decremented, so a deleted
  -- row's Case ID is never handed to a different borrower.
  next_case_seq         INTEGER     NOT NULL DEFAULT 1 CHECK (next_case_seq >= 1),
  active                BOOLEAN     NOT NULL DEFAULT TRUE,
  last_synced_at        TIMESTAMPTZ,
  last_sync_error       TEXT,
  created_by            TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hands out the next Case ID for a brand in one statement, so two sync runs at the same
-- moment can never get the same number.
CREATE OR REPLACE FUNCTION public.allocate_brand_case_ref(p_brand_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
  v_seq  INTEGER;
BEGIN
  UPDATE public.brands
     SET next_case_seq = next_case_seq + 1, updated_at = NOW()
   WHERE id = p_brand_id
  RETURNING code, next_case_seq - 1 INTO v_code, v_seq;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Unknown brand %', p_brand_id;
  END IF;
  RETURN v_code || '-' || lpad(v_seq::text, 4, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.allocate_brand_case_ref(UUID) FROM PUBLIC, anon, authenticated;

-- A recovery matter is still an ordinary `cases` row (letter, lawyer review, serving all reuse
-- the existing flow); brand_id marks it as coming from a brand sheet.
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);
CREATE INDEX IF NOT EXISTS cases_brand_id_idx ON public.cases (brand_id) WHERE brand_id IS NOT NULL;

-- One row per borrower. case_ref is THE identity of a borrower — never the sheet row number,
-- which changes when the brand sorts or deletes rows.
CREATE TABLE IF NOT EXISTS public.brand_cases (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                    UUID        NOT NULL REFERENCES public.brands(id),
  case_ref                    TEXT        NOT NULL UNIQUE,
  case_id                     UUID        REFERENCES public.cases(id) ON DELETE SET NULL,
  status                      TEXT        NOT NULL DEFAULT 'new' CHECK (status IN (
                                'new', 'checking', 'missing_documents', 'letter_drafted', 'lawyer_approved',
                                'served', 'day7_sent', 'day14_sent', 'paid', 'disputed', 'closed')),
  missing_items               TEXT[]      NOT NULL DEFAULT '{}',
  -- The brand's columns as they were when the case was picked up; later edits are compared
  -- against snapshot_hash and flagged, never reprocessed.
  borrower                    JSONB,
  snapshot_hash               TEXT,
  last_notes                  TEXT,
  claimed_at                  TIMESTAMPTZ,
  served_at                   TIMESTAMPTZ,
  day7_sent_at                TIMESTAMPTZ,
  day14_sent_at               TIMESTAMPTZ,
  awaiting_brand_decision_at  TIMESTAMPTZ,
  -- Nothing goes to court without the brand's written approval.
  court_approved_at           TIMESTAMPTZ,
  court_approved_by           TEXT,
  court_approval_note         TEXT,
  court_approval_evidence_path TEXT,
  letter_url                  TEXT,
  billable_at                 TIMESTAMPTZ,
  billed_invoice_id           UUID        REFERENCES public.invoices(id) ON DELETE SET NULL,
  row_missing_since           TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS brand_cases_brand_status_idx ON public.brand_cases (brand_id, status);

-- Audit log: every letter, reminder, reply and status change, per Case ID.
CREATE TABLE IF NOT EXISTS public.brand_case_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_case_id  UUID        NOT NULL REFERENCES public.brand_cases(id) ON DELETE CASCADE,
  case_ref       TEXT        NOT NULL,
  event_type     TEXT        NOT NULL,
  detail         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  actor          TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS brand_case_events_case_idx ON public.brand_case_events (brand_case_id, created_at);
-- THE "never twice" guarantee: each of these can be recorded once per borrower, and the row
-- is inserted BEFORE the work is done. A second run's insert fails, so it skips the work.
CREATE UNIQUE INDEX IF NOT EXISTS brand_case_events_once_idx
  ON public.brand_case_events (brand_case_id, event_type)
  WHERE event_type IN ('letter_drafted', 'served', 'day7_reminder', 'day14_reminder');

-- A brand edited its own columns after the row was picked up. Not reprocessed; a human decides.
CREATE TABLE IF NOT EXISTS public.brand_change_flags (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_case_id  UUID        REFERENCES public.brand_cases(id) ON DELETE CASCADE,
  brand_id       UUID        NOT NULL REFERENCES public.brands(id),
  case_ref       TEXT,
  kind           TEXT        NOT NULL CHECK (kind IN ('edited_after_processing', 'row_missing', 'unknown_case_id', 'duplicate_case_id')),
  column_name    TEXT,
  old_value      TEXT,
  new_value      TEXT,
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ,
  resolved_by    TEXT,
  note           TEXT
);
CREATE INDEX IF NOT EXISTS brand_change_flags_open_idx ON public.brand_change_flags (brand_id) WHERE resolved_at IS NULL;

-- Sync schedule (configurable, default hourly) and a lease so two runs never overlap.
ALTER TABLE public.firm_settings ADD COLUMN IF NOT EXISTS brand_sync_interval_minutes INTEGER NOT NULL DEFAULT 60
  CHECK (brand_sync_interval_minutes BETWEEN 15 AND 1440);
ALTER TABLE public.firm_settings ADD COLUMN IF NOT EXISTS brand_sync_lease_until TIMESTAMPTZ;
ALTER TABLE public.firm_settings ADD COLUMN IF NOT EXISTS brand_sync_last_run_at TIMESTAMPTZ;

DROP TRIGGER IF EXISTS brands_touch ON public.brands;
CREATE TRIGGER brands_touch BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS brand_cases_touch ON public.brand_cases;
CREATE TRIGGER brand_cases_touch BEFORE UPDATE ON public.brand_cases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.google_connection  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_cases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_case_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_change_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_connection, public.brands, public.brand_cases, public.brand_case_events, public.brand_change_flags
  FROM anon, authenticated;
