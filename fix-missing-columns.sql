-- Adds back the 5 columns missing from the live `cases` table. All ADD COLUMN IF NOT EXISTS
-- — purely additive, safe to run, nothing existing is touched or deleted. This is the same
-- migration already documented (but apparently never run) in supabase-schema.sql.
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS expected_amount INTEGER;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS reviewed_document_sent_at TIMESTAMPTZ;

-- Verify it worked — should now show all 27 expected columns.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'cases'
order by column_name;
