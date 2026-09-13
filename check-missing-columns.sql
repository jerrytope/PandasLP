-- Read-only. Compares the live `cases` table against every column the application code
-- expects (per supabase-schema.sql). Anything NOT in this result is missing from production.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'cases'
order by column_name;

-- Expected columns (from supabase-schema.sql), for comparison:
-- id, case_number, user_id, agent_id, service_id, status, document_title, document_body,
-- delivery_option, client_phone, expected_amount, amount_paid, paid_at, deadline_at,
-- email_day0_sent, email_day7_sent, email_day14_sent, resolution_email_sent, reviewed_at,
-- reviewed_by, reviewed_document_sent_at, source, source_detail, parent_case_id,
-- judgment_amount, created_at, updated_at
