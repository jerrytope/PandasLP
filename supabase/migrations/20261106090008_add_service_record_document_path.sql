ALTER TABLE public.service_records
  ADD COLUMN IF NOT EXISTS document_path text;

NOTIFY pgrst, 'reload schema';
