ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS resolution_type text
    CHECK (resolution_type IS NULL OR resolution_type IN ('recovered', 'settled')),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by text;

NOTIFY pgrst, 'reload schema';
