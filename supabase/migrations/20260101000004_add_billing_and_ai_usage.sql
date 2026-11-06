-- Billing (invoices + payments + firm billing settings) and AI usage tracking.
--
-- Money in these tables is in KOBO (BIGINT), so VAT and part-payments never round wrongly.
-- The older case columns (cases.amount_paid, recoveries.amount_recovered) stay in whole naira.
--
-- Additive only: CREATE ... IF NOT EXISTS, nothing existing is changed or deleted, safe to run
-- more than once. Every table has RLS on with no policies: all access is through the admin API
-- using the service role, the same posture as case_negotiations and recoveries.
-- Run it in the Supabase SQL editor.

-- ─── Firm billing settings (exactly one row) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.firm_settings (
  id                   SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bank_account_name    TEXT,
  bank_account_number  TEXT,
  bank_name            TEXT,
  -- Percentage, e.g. 7.5. Zero means VAT is not charged.
  vat_rate             NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  -- Printed on invoices when VAT is charged.
  tax_id               TEXT,
  -- Days from issue to due date on new invoices.
  payment_terms_days   INTEGER      NOT NULL DEFAULT 7 CHECK (payment_terms_days BETWEEN 0 AND 365),
  -- Naira per US dollar, for showing AI cost (billed in USD) in naira on the dashboard.
  usd_ngn_rate         NUMERIC(12,2) CHECK (usd_ngn_rate IS NULL OR usd_ngn_rate > 0),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by           TEXT
);
INSERT INTO public.firm_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.firm_settings ENABLE ROW LEVEL SECURITY;

-- ─── Invoices ──────────────────────────────────────────────────────────────────────────────
-- Numbered by the database, so two staff creating invoices at once can never collide.
-- Starts at 37 because PLP/INV/2026/000036 was issued by hand before this existed.
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 37;

CREATE TABLE IF NOT EXISTS public.invoices (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    TEXT         NOT NULL UNIQUE DEFAULT (
                      'PLP/INV/' || to_char(NOW() AT TIME ZONE 'Africa/Lagos', 'YYYY') || '/' ||
                      lpad(nextval('public.invoice_number_seq')::text, 6, '0')
                    ),
  case_id           UUID         REFERENCES public.cases(id) ON DELETE SET NULL,
  client_name       TEXT         NOT NULL CHECK (length(trim(client_name)) > 0),
  client_email      TEXT,
  matter            TEXT,
  -- [{ "description": text, "amount_kobo": integer }], at least one line.
  items             JSONB        NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  subtotal_kobo     BIGINT       NOT NULL CHECK (subtotal_kobo >= 0),
  vat_rate          NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  vat_kobo          BIGINT       NOT NULL DEFAULT 0 CHECK (vat_kobo >= 0),
  total_kobo        BIGINT       NOT NULL CHECK (total_kobo >= 0),
  amount_paid_kobo  BIGINT       NOT NULL DEFAULT 0 CHECK (amount_paid_kobo >= 0),
  status            TEXT         NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft', 'sent', 'part_paid', 'paid', 'void')),
  issue_date        DATE         NOT NULL DEFAULT (NOW() AT TIME ZONE 'Africa/Lagos')::date,
  due_date          DATE,
  notes             TEXT,
  sent_at           TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  voided_at         TIMESTAMPTZ,
  void_reason       TEXT,
  created_by        TEXT         NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_case_id ON public.invoices(case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON public.invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.invoices(issue_date);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- ─── Payments against invoices ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_kobo  BIGINT      NOT NULL CHECK (amount_kobo > 0),
  paid_on      DATE        NOT NULL,
  method       TEXT        NOT NULL DEFAULT 'bank_transfer'
                           CHECK (method IN ('bank_transfer', 'cash', 'pos', 'paystack', 'other')),
  reference    TEXT,
  recorded_by  TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_paid_on ON public.invoice_payments(paid_on);
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- ─── AI usage: one row per Claude call (lib/claude.ts) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  route                  TEXT          NOT NULL,
  model                  TEXT          NOT NULL,
  case_id                UUID          REFERENCES public.cases(id) ON DELETE SET NULL,
  input_tokens           INTEGER       NOT NULL DEFAULT 0,
  output_tokens          INTEGER       NOT NULL DEFAULT 0,
  cache_read_tokens      INTEGER       NOT NULL DEFAULT 0,
  cache_write_5m_tokens  INTEGER       NOT NULL DEFAULT 0,
  cache_write_1h_tokens  INTEGER       NOT NULL DEFAULT 0,
  cost_usd               NUMERIC(12,6) NOT NULL DEFAULT 0,
  latency_ms             INTEGER,
  stop_reason            TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_case_id ON public.ai_usage(case_id);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Check: four tables and one sequence should be listed.
select table_name as name from information_schema.tables
where table_schema = 'public' and table_name in ('firm_settings', 'invoices', 'invoice_payments', 'ai_usage')
union all
select sequence_name from information_schema.sequences
where sequence_schema = 'public' and sequence_name = 'invoice_number_seq'
order by name;
