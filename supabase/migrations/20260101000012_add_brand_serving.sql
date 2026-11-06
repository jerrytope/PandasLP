-- ============================================================
-- Brand sheets, phase 3 (lawyer approval, serving, borrower reminders). Run AFTER
-- add-brand-sync.sql. Safe to re-run.
--
-- - brand_cases.final_letter_at: when the FINAL letter replaced the DRAFT in the brand's
--   Letters folder. Approval doesn't wait for Google; if the upload fails, the next sync
--   retries every approved letter that doesn't have this yet.
--
-- Everything else phase 3 needs already exists in add-brands.sql: served_at, day7_sent_at,
-- day14_sent_at, awaiting_brand_decision_at, billable_at, and the unique index that lets
-- 'served', 'day7_reminder' and 'day14_reminder' be recorded only once per borrower.
--
-- RUN ORDER ON PRODUCTION: run this BEFORE deploying the phase 3 code.
-- ============================================================

ALTER TABLE public.brand_cases ADD COLUMN IF NOT EXISTS final_letter_at TIMESTAMPTZ;
