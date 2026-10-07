-- ============================================================
-- One payment pays for one thing.
--
-- /api/verify-payment and /api/custom-claim check a Paystack reference with Paystack, but
-- never recorded which references they had already accepted. So one real ₦25,000 payment's
-- reference could be replayed to mark any number of ₦25,000 cases paid (and one ₦10,000
-- payment could file unlimited "paid" custom claims). Every accepted reference is now
-- inserted here first; the primary key makes a second use fail, in any flow.
--
-- Written only by the server (lib/paystackVerify.ts, service-role key). RLS on with no
-- policies = the browser can't read or write it.
--
-- RUN ORDER ON PRODUCTION: run this BEFORE deploying the code that ships with it — the new
-- code refuses every payment if this table doesn't exist. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_references (
  reference   TEXT        PRIMARY KEY,
  purpose     TEXT        NOT NULL CHECK (purpose IN ('case', 'custom_claim')),
  amount      INTEGER     NOT NULL,
  -- cases.id or custom_claims.id. Null only for the moment between claiming the reference
  -- and saving the custom claim it paid for.
  target_id   UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_references ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_references FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS payment_references_target_idx ON public.payment_references (target_id);
