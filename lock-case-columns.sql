-- ============================================================
-- Lock down what a signed-in client can write from the browser.
--
-- The owner_cases / owner_messages policies are FOR ALL, and Supabase grants the
-- `authenticated` role every privilege on public tables by default. Together that let any
-- signed-in client change ANY column of their own case straight from the browser with the
-- public anon key — status = 'paid', amount_paid, reviewed_at, expected_amount (the price
-- /api/verify-payment checks against), and so on — bypassing every server-side check in
-- /api/update-case-status and /api/verify-payment.
--
-- RLS decides WHICH ROWS a user may touch; these column privileges decide WHICH COLUMNS.
-- Everything else is written by API routes with the service-role key, which is unaffected.
--
-- RUN ORDER ON PRODUCTION: deploy the app code that ships with this file FIRST (it stops the
-- browser writing document/status/price columns and uses /api/save-document instead), THEN
-- run this in the Supabase SQL editor. Running it before the deploy breaks document saving
-- for the old code still live. Safe to re-run.
-- ============================================================

-- cases: the browser may only create a case and record contact details on it.
REVOKE INSERT, UPDATE, DELETE ON public.cases FROM anon, authenticated;
GRANT INSERT (user_id, agent_id, source, source_detail, parent_case_id, judgment_amount)
  ON public.cases TO authenticated;
GRANT UPDATE (client_phone, client_email, recipient_phone)
  ON public.cases TO authenticated;

-- The sequence behind cases.case_number is still needed for the browser's INSERT.
GRANT USAGE ON SEQUENCE public.cases_case_number_seq TO authenticated;

-- messages: the browser appends conversation turns; it never edits or deletes them.
REVOKE UPDATE, DELETE ON public.messages FROM anon, authenticated;
REVOKE INSERT ON public.messages FROM anon;

-- Verify (should list only the columns granted above for INSERT/UPDATE):
-- select privilege_type, column_name from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'cases' and grantee = 'authenticated'
--   and privilege_type in ('INSERT', 'UPDATE') order by 1, 2;
