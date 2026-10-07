-- ============================================================
-- Brand sheets, phase 2 (the sync job). Run AFTER add-brands.sql. Safe to re-run.
--
-- - brands.address: the demand letter names the client "of [address]" (Template B in
--   lib/agents.ts), so every brand needs one before its letters can be drafted.
-- - brands.owner_user_id: every `cases` row needs an owning auth user. Brand matters are owned
--   by the staff member who created the brand, the same way lawyer-intake cases are owned by
--   the staff member who ran the session.
-- - brand_cases.last_error: why the last attempt on this borrower failed (shown in the admin).
-- - brand_cases.attempts: drafting attempts, so a row that keeps failing stops retrying.
--
-- RUN ORDER ON PRODUCTION: run this BEFORE deploying the phase 2 code.
-- ============================================================

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

-- Brands created before this column existed: owned by whoever created them.
UPDATE public.brands b
   SET owner_user_id = u.id
  FROM auth.users u
 WHERE b.owner_user_id IS NULL
   AND lower(u.email) = lower(b.created_by);

ALTER TABLE public.brand_cases ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.brand_cases ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
-- The letter's Drive file, so approval (phase 3) replaces the DRAFT in place and the brand's
-- Letter Link keeps working.
ALTER TABLE public.brand_cases ADD COLUMN IF NOT EXISTS letter_file_id TEXT;
