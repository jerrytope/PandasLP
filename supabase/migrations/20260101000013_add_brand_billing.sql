-- ============================================================
-- Brand sheets, phase 4 (exceptions and monthly billing). Run AFTER add-brand-serving.sql.
-- Safe to re-run.
--
-- - brand_cases.billable_fee_kobo: the brand's per-letter fee when the letter was approved, so
--   a fee change later in the month doesn't reprice letters already approved.
-- - invoices.brand_id: the brand a monthly invoice is for (Admin → Brands → Billing).
--   brand_cases.billed_invoice_id (add-brands.sql) is what stops a letter being billed twice.
-- - brand_change_flags.resolution: what staff decided about a flag ('accepted' = the brand's
--   new value is now the record; 'kept_original' = it isn't). A flag kept as original is never
--   raised again for the same value.
--
-- RUN ORDER ON PRODUCTION: run this BEFORE deploying the phase 4 code.
-- ============================================================

ALTER TABLE public.brand_cases ADD COLUMN IF NOT EXISTS billable_fee_kobo BIGINT CHECK (billable_fee_kobo >= 0);

-- Letters approved before this column existed: today's fee for their brand.
UPDATE public.brand_cases bc
   SET billable_fee_kobo = b.per_letter_fee_kobo
  FROM public.brands b
 WHERE bc.brand_id = b.id
   AND bc.billable_at IS NOT NULL
   AND bc.billable_fee_kobo IS NULL;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);
CREATE INDEX IF NOT EXISTS invoices_brand_id_idx ON public.invoices (brand_id) WHERE brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS brand_cases_unbilled_idx ON public.brand_cases (brand_id, billable_at)
  WHERE billable_at IS NOT NULL AND billed_invoice_id IS NULL;

ALTER TABLE public.brand_change_flags ADD COLUMN IF NOT EXISTS resolution TEXT
  CHECK (resolution IN ('accepted', 'kept_original', 'row_back', 'noted'));
