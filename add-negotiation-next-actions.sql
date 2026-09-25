-- Negotiation status + next action tracking for the admin dashboard.
--
-- Each round in case_negotiations can now say where the negotiation stands after it
-- (status), what has to happen next (next_action), and by when (next_action_due). The
-- latest round is the case's current state. next_action_done_at closes an action, either
-- when staff mark it done or automatically when a newer round is logged. reminder_sent_at
-- stops the daily reminder email (app/api/cron/follow-ups/route.ts) repeating the same day.
--
-- Purely additive: ADD COLUMN IF NOT EXISTS only, safe to run more than once, nothing
-- existing is changed or deleted. Run it in the Supabase SQL editor.

ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS status TEXT
  CHECK (status IS NULL OR status IN ('awaiting_their_reply', 'awaiting_our_reply', 'agreed', 'broken_down'));
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS next_action_due DATE;
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS next_action_done_at TIMESTAMPTZ;
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- The dashboard and the reminder job only ever look for open actions with a due date.
CREATE INDEX IF NOT EXISTS idx_case_negotiations_open_actions
  ON public.case_negotiations(next_action_due)
  WHERE next_action IS NOT NULL AND next_action_done_at IS NULL;

NOTIFY pgrst, 'reload schema';

-- Check: all five columns should be listed.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'case_negotiations'
  and column_name in ('status', 'next_action', 'next_action_due', 'next_action_done_at', 'reminder_sent_at')
order by column_name;
