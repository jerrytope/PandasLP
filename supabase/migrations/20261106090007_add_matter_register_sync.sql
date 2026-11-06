-- Tracks Google Sheets matter-register deliveries so staff can see failures and retry safely.
-- The table has no browser-facing policies; only server routes use the service-role client.

CREATE TABLE IF NOT EXISTS public.matter_register_syncs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type     TEXT        NOT NULL CHECK (record_type IN ('case', 'recovery')),
  record_id       UUID        NOT NULL,
  status          TEXT        NOT NULL CHECK (status IN ('synced', 'failed')),
  error           TEXT,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (record_type, record_id)
);

ALTER TABLE public.matter_register_syncs ENABLE ROW LEVEL SECURITY;
