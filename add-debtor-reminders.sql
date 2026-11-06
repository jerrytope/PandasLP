-- Debtor reminder schedule and audit trail.
-- Safe to apply more than once. Reminder rows are unique per case and reminder day so
-- repeated admin requests cannot record the same notice twice.

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS letter_received_on date;

CREATE TABLE IF NOT EXISTS public.case_debtor_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  reminder_key text NOT NULL CHECK (reminder_key IN ('day7', 'day10', 'day14', 'day15')),
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'other')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'sent')),
  prepared_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  sent_by text,
  UNIQUE (case_id, reminder_key)
);

ALTER TABLE public.case_debtor_reminders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_case_debtor_reminders_case
  ON public.case_debtor_reminders(case_id, sent_at DESC);

NOTIFY pgrst, 'reload schema';
