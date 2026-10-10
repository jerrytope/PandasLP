-- ============================================================
-- Brand sheets, phase 5A (borrowers sent by API instead of a Google Sheet). Run AFTER
-- add-brand-billing.sql. Safe to re-run. Plan: plans/phase-5-api-intake.md.
--
-- - brands.intake_channel: 'sheet' (as today), 'api', or 'both'.
-- - brand_api_keys: one row per key. Only a SHA-256 hash of the key is stored, so a leak of this
--   table doesn't expose working keys. A 'test' key never drafts with the AI (phase 5C).
-- - brand_cases.source / external_ref / is_test: where the borrower came from, the brand's own
--   loan ID, and whether it came in on a test key. The brand's loan ID is unique per brand and
--   mode: that is the "never twice" key for API borrowers.
-- - brand_case_documents: the loan documents an API brand sends (in the JSON or as a link we
--   fetch once), stored privately in the case-evidence bucket. No Google Drive involved.
-- - brand_api_requests: an access log, one row per API call.
--
-- RUN ORDER ON PRODUCTION: run this BEFORE deploying the phase 5A code.
-- ============================================================

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS intake_channel TEXT NOT NULL DEFAULT 'sheet'
  CHECK (intake_channel IN ('sheet', 'api', 'both'));

CREATE TABLE IF NOT EXISTS public.brand_api_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  mode          TEXT        NOT NULL CHECK (mode IN ('test', 'live')),
  -- The first characters of the key (e.g. "plp_live_Ab3d"), so staff and the brand can tell keys apart.
  key_prefix    TEXT        NOT NULL,
  key_hash      TEXT        NOT NULL UNIQUE,
  label         TEXT,
  created_by    TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  revoked_by    TEXT
);
CREATE INDEX IF NOT EXISTS brand_api_keys_brand_idx ON public.brand_api_keys (brand_id);

ALTER TABLE public.brand_cases ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'sheet'
  CHECK (source IN ('sheet', 'api'));
ALTER TABLE public.brand_cases ADD COLUMN IF NOT EXISTS external_ref TEXT;
ALTER TABLE public.brand_cases ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
-- THE "never twice" guarantee for API borrowers: one case per loan ID, per brand, per mode.
CREATE UNIQUE INDEX IF NOT EXISTS brand_cases_external_ref_idx
  ON public.brand_cases (brand_id, is_test, external_ref) WHERE external_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.brand_case_documents (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_case_id  UUID        NOT NULL REFERENCES public.brand_cases(id) ON DELETE CASCADE,
  storage_path   TEXT        NOT NULL,
  filename       TEXT        NOT NULL,
  content_type   TEXT        NOT NULL,
  size_bytes     INTEGER     NOT NULL,
  -- So resending the same loan with the same files counts as a duplicate, not a change.
  content_sha256 TEXT        NOT NULL,
  -- 'inline' = sent inside the JSON; 'url' = fetched from source_url when it arrived.
  origin         TEXT        NOT NULL CHECK (origin IN ('inline', 'url')),
  source_url     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS brand_case_documents_case_idx ON public.brand_case_documents (brand_case_id);

CREATE TABLE IF NOT EXISTS public.brand_api_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        REFERENCES public.brands(id) ON DELETE CASCADE,
  key_id      UUID        REFERENCES public.brand_api_keys(id) ON DELETE SET NULL,
  mode        TEXT,
  method      TEXT        NOT NULL,
  path        TEXT        NOT NULL,
  status      INTEGER     NOT NULL,
  detail      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS brand_api_requests_brand_idx ON public.brand_api_requests (brand_id, created_at);

ALTER TABLE public.brand_api_keys       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_api_requests   ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_api_keys, public.brand_case_documents, public.brand_api_requests FROM anon, authenticated;
