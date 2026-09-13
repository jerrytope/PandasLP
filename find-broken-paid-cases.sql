-- Read-only. Run in Supabase → SQL Editor (Pandas LP project, not the local dev one).
-- Looks up every case belonging to motayo002@yahoo.com and shows exactly why the demand
-- letter isn't viewable: letter_missing = true means document_body never actually saved
-- to the database (the bug fixed in the AgentChat.tsx saveTurn change) — status can still
-- be "paid" even though nothing was ever persisted, since payment doesn't depend on the
-- document having saved.
select
  c.id,
  c.case_number,
  c.agent_id,
  c.status,
  c.document_title,
  (c.document_body is null or c.document_body = '') as letter_missing,
  c.amount_paid,
  c.expected_amount,
  c.paid_at,
  c.reviewed_at,
  c.created_at
from public.cases c
join auth.users u on u.id = c.user_id
where u.email = 'motayo002@yahoo.com'
order by c.created_at desc;
