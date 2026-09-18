-- Read-only. Run in Supabase → SQL Editor (Pandas LP project, not the local dev one).
-- Diagnoses "failing to load evidences" on the admin dashboard's View Evidence panel.
-- Same class of bug as check-missing-columns.sql / find-broken-paid-cases.sql: a table
-- defined in supabase-schema.sql that was never actually run against production.

-- 1. Does the case_evidence TABLE exist at all?
-- If this returns zero rows, that's the whole problem: GET /api/admin/case-evidence
-- fails with a Postgres "relation does not exist" error, which the route reports back
-- as a plain 500 "Failed to load evidence." — the exact symptom described.
select table_name
from information_schema.tables
where table_schema = 'public' and table_name = 'case_evidence';

-- 2. Does the case-evidence STORAGE BUCKET exist?
-- If the table exists but this returns zero rows, every row's signed-URL lookup fails
-- silently (the route returns url: null per row rather than erroring the whole request)
-- — evidence would show as entries with "unavailable" files, not a load failure. Worth
-- ruling out anyway.
select id, name, public, file_size_limit
from storage.buckets
where id = 'case-evidence';

-- 3. If the table exists, how many rows are actually in it, and for which cases?
-- Confirms whether uploads have been saving at all since the feature shipped, separate
-- from whether the admin panel can currently read them back.
select case_id, count(*) as evidence_count, max(created_at) as most_recent_upload
from public.case_evidence
group by case_id
order by most_recent_upload desc
limit 20;
