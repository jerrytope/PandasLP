-- Negotiation workflow for the admin dashboard: status, next action tracking, and the
-- advise-the-client step between receiving opposing counsel's response and replying to it.
--
-- On each round in case_negotiations:
--   status               where the negotiation stands after this round
--   next_action          what has to happen next, and next_action_due by when
--   next_action_done_at  closes an action (marked done, or superseded by a newer round)
--   reminder_sent_at     stops the daily reminder email repeating the same day
-- On a round received from opposing counsel:
--   advice_note              the note advising our client on their response
--   advice_sent_at           when that note was emailed to the client
--   client_instructions      what the client instructed us to do in reply
--   instructions_received_at when those instructions were recorded
--
-- Purely additive: ADD COLUMN IF NOT EXISTS only, safe to run more than once, nothing
-- existing is changed or deleted. Run it in the Supabase SQL editor.

ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS status TEXT
  CHECK (status IS NULL OR status IN ('awaiting_their_reply', 'awaiting_our_reply', 'agreed', 'broken_down'));
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS next_action_due DATE;
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS next_action_done_at TIMESTAMPTZ;
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS advice_note TEXT;
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS advice_sent_at TIMESTAMPTZ;
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS client_instructions TEXT;
ALTER TABLE public.case_negotiations ADD COLUMN IF NOT EXISTS instructions_received_at TIMESTAMPTZ;

-- The dashboard and the reminder job only ever look for open actions with a due date.
CREATE INDEX IF NOT EXISTS idx_case_negotiations_open_actions
  ON public.case_negotiations(next_action_due)
  WHERE next_action IS NOT NULL AND next_action_done_at IS NULL;

NOTIFY pgrst, 'reload schema';

-- Check: all nine columns should be listed.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'case_negotiations'
  and column_name in ('status', 'next_action', 'next_action_due', 'next_action_done_at', 'reminder_sent_at',
                      'advice_note', 'advice_sent_at', 'client_instructions', 'instructions_received_at')
order by column_name;
