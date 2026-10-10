-- ============================================================
-- Brand API, phase 5C (plans/phase-5-api-intake.md): test mode and live keys.
--
-- A live key is only issued once the brand's integration has passed with the test key
-- (lib/brandTestMode.ts testModeProgress). Staff may issue one earlier, with a written reason,
-- which is kept on the key.
--
-- RUN ORDER ON PRODUCTION: after add-brand-webhooks.sql, BEFORE deploying the phase 5C code.
-- ============================================================

ALTER TABLE public.brand_api_keys ADD COLUMN IF NOT EXISTS issued_before_test_passed_reason TEXT;
