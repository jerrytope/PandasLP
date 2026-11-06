-- ============================================================
-- Brand API, phase 5B (plans/phase-5-api-intake.md): we tell the brand's system what happened.
--
-- - brand_webhooks: each API brand's web address (live, and one for test-key borrowers) and the
--   shared secret every call is signed with. Server-only, like the API keys.
-- - brand_webhook_deliveries: one row per update to send (the "outbox"). lib/brandWebhooks.ts
--   sends them, retries for up to 24 hours, and alerts staff about the ones that fail.
-- - queue_brand_webhook(): a trigger on brand_case_events. Every step a borrower takes is already
--   written to that log (whichever code path takes it), so queuing here means no path can forget
--   to tell the brand. Only API borrowers are queued; sheet brands see their sheet.
--
-- RUN ORDER ON PRODUCTION: after add-brand-api.sql, BEFORE deploying the phase 5B code.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_webhooks (
  brand_id    UUID        PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  -- Where live borrowers' updates go, and where test-key borrowers' updates go. Either may be empty.
  live_url    TEXT,
  test_url    TEXT,
  -- Shown to staff once (to pass to the brand), then only used to sign. Rotated, never recovered.
  secret      TEXT        NOT NULL,
  updated_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brand_webhook_deliveries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  brand_case_id    UUID        REFERENCES public.brand_cases(id) ON DELETE CASCADE,
  -- The log entry this update is about (NULL for a staff "send test event"). Unique: one update per step.
  source_event_id  UUID        UNIQUE REFERENCES public.brand_case_events(id) ON DELETE SET NULL,
  event            TEXT        NOT NULL,
  is_test          BOOLEAN     NOT NULL DEFAULT FALSE,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The exact body sent, fixed on the first attempt so every retry sends the same thing.
  payload          JSONB,
  -- pending → delivered | failed (gave up after 24 hours) | skipped (no web address set).
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'skipped')),
  attempts         INTEGER     NOT NULL DEFAULT 0,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Held for a minute by whichever run is sending it, so two runs never send it at once.
  locked_until     TIMESTAMPTZ,
  last_http_status INTEGER,
  last_error       TEXT,
  delivered_at     TIMESTAMPTZ,
  failed_at        TIMESTAMPTZ,
  staff_alerted_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS brand_webhook_deliveries_due_idx ON public.brand_webhook_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS brand_webhook_deliveries_brand_idx ON public.brand_webhook_deliveries (brand_id, created_at);

-- Which log entries the brand hears about. Claims (served, day7_reminder…) are NOT among them:
-- they are written before the email goes and removed if it fails. The status change after it is.
CREATE OR REPLACE FUNCTION public.queue_brand_webhook() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event TEXT;
  v_brand UUID;
  v_test  BOOLEAN;
BEGIN
  v_event := CASE
    WHEN NEW.event_type = 'missing_documents' THEN 'borrower.missing_documents'
    WHEN NEW.event_type = 'awaiting_brand_decision' THEN 'borrower.awaiting_decision'
    WHEN NEW.event_type = 'outcome' THEN 'borrower.outcome'
    WHEN NEW.event_type = 'status_changed'
     AND NEW.detail->>'to' IN ('letter_drafted', 'lawyer_approved', 'served', 'day7_sent', 'day14_sent')
      THEN 'borrower.' || (NEW.detail->>'to')
    ELSE NULL
  END;
  IF v_event IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT brand_id, is_test INTO v_brand, v_test
  FROM public.brand_cases
  WHERE id = NEW.brand_case_id AND source = 'api';
  IF v_brand IS NULL THEN
    RETURN NEW; -- a sheet borrower
  END IF;

  INSERT INTO public.brand_webhook_deliveries (brand_id, brand_case_id, source_event_id, event, is_test, occurred_at)
  VALUES (v_brand, NEW.brand_case_id, NEW.id, v_event, v_test, NEW.created_at)
  ON CONFLICT (source_event_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_brand_webhook() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS brand_case_events_queue_webhook ON public.brand_case_events;
CREATE TRIGGER brand_case_events_queue_webhook
  AFTER INSERT ON public.brand_case_events
  FOR EACH ROW EXECUTE FUNCTION public.queue_brand_webhook();

ALTER TABLE public.brand_webhooks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_webhook_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_webhooks, public.brand_webhook_deliveries FROM anon, authenticated;
