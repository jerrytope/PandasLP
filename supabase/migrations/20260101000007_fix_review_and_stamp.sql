-- Fixes "Mark Reviewed" and "Upload Stamped Document" / "Attach Stamp" in the admin page.
--
-- Mark Reviewed writes reviewed_at, reviewed_by and review_checklist in one update
-- (app/api/update-case-status/route.ts). fix-missing-columns.sql added the first two but
-- never review_checklist, so if that column is missing the whole update fails and the case
-- never becomes reviewed. The stamp buttons only appear once a case is reviewed, so they
-- disappear with it. The upload itself also needs the private case-documents bucket.
--
-- Everything here is IF NOT EXISTS / ON CONFLICT DO NOTHING: purely additive, safe to run
-- more than once, nothing existing is changed or deleted. Run it in the Supabase SQL editor.

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS reviewed_document_sent_at TIMESTAMPTZ;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS review_checklist JSONB;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS second_reviewer_email TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS second_reviewed_at TIMESTAMPTZ;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-documents', 'case-documents', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Tell the API layer about the new columns straight away instead of waiting for its cache.
NOTIFY pgrst, 'reload schema';

-- Check: all six column names should be listed, and the bucket row should appear.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'cases'
  and column_name in ('reviewed_at', 'reviewed_by', 'reviewed_document_sent_at',
                      'review_checklist', 'second_reviewer_email', 'second_reviewed_at')
order by column_name;

select id, public, file_size_limit from storage.buckets where id = 'case-documents';
