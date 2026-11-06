-- ============================================================
-- Site content: the parts of the public website staff edit in Admin → Site content
-- (docs/frontend-revamp-plan.md). Photos, the announcement bar, published numbers, client
-- quotes and the founder's note. One row per group; the shape of each group is defined and
-- checked in lib/siteContentSchema.ts, and anything missing falls back to its default there.
--
-- Photos live in the PUBLIC "site-media" bucket: they are website images, meant to be seen.
-- Never put client documents there (those stay in the private case-documents / case-evidence).
--
-- Server-only: no browser access to the table (RLS on, no policies). Staff write through
-- /api/admin/site-content (requireAdmin); the public site reads through the server.
--
-- RUN ORDER: any time after supabase-schema.sql. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_content (
  key         TEXT PRIMARY KEY CHECK (key IN ('announcement', 'photos', 'stats', 'quotes', 'founder')),
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_content FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
