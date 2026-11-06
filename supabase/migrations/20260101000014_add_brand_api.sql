-- Copy of add-brand-api.sql (root). Keep the two identical.
-- ============================================================
-- Brand sheets, phase 5A (borrowers sent by API instead of a Google Sheet). Run AFTER
-- add-brand-billing.sql. Safe to re-run. Plan: plans/phase-5-api-intake.md.
-- ============================================================

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS intake_channel TEXT NOT NULL DEFAULT 'sheet'
  CHECK (intake_channel IN ('sheet', 'api', 'both'));

CREATE TABLE IF NOT EXISTS public.brand_api_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  mode          TEXT        NOT NULL CHECK (mode IN ('test', 'live')),
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
CREATE UNIQUE INDEX IF NOT EXISTS brand_cases_external_ref_idx
  ON public.brand_cases (brand_id, is_test, external_ref) WHERE external_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.brand_case_documents (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_case_id  UUID        NOT NULL REFERENCES public.brand_cases(id) ON DELETE CASCADE,
  storage_path   TEXT        NOT NULL,
  filename       TEXT        NOT NULL,
  content_type   TEXT        NOT NULL,
  size_bytes     INTEGER     NOT NULL,
  content_sha256 TEXT        NOT NULL,
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
