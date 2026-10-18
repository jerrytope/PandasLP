-- ============================================================
-- /manageai: the lead lawyer's drafting instructions for each agent (stage 1).
--
-- The agents' own instructions stay in code (lib/agents.ts, lib/property/areas/). What the lead
-- lawyer publishes on /manageai is added after them (lib/agentInstructions.ts). A "target" is one
-- agent ('small-claims', 'recovery-of-premises', ...) or one area of the rebuilt Property Law
-- Agent ('property:tenancy', ...).
--
-- VERSIONS ARE NEVER CHANGED OR DELETED. Every publish adds a new version; the live one is the
-- highest version for a target. Restoring an old version publishes a copy of it as a new
-- version, so the full history always stays. A trigger refuses UPDATE and DELETE.
--
-- Server-only: no browser access (RLS on, no policies). Every read and write goes through
-- /api/manageai/*, which checks AI_MANAGER_EMAILS.
--
-- RUN ORDER: any time after supabase-schema.sql. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_instruction_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target         TEXT NOT NULL CHECK (target ~ '^[a-z][a-z:-]{1,60}$'),
  kind           TEXT NOT NULL DEFAULT 'drafting_notes' CHECK (kind IN ('drafting_notes')),
  version        INTEGER NOT NULL CHECK (version > 0),
  -- Empty = the lawyer cleared the instructions (the agent runs on its code instructions alone).
  body           TEXT NOT NULL CHECK (length(body) <= 20000),
  note           TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  -- Set when this version is a restore of an older one.
  restored_from  INTEGER,
  created_by     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target, kind, version)
);

-- One working draft per target, overwritten as the lawyer types. Not history: publishing turns
-- it into a version and removes it.
CREATE TABLE IF NOT EXISTS public.agent_instruction_drafts (
  target            TEXT NOT NULL CHECK (target ~ '^[a-z][a-z:-]{1,60}$'),
  kind              TEXT NOT NULL DEFAULT 'drafting_notes' CHECK (kind IN ('drafting_notes')),
  body              TEXT NOT NULL CHECK (length(body) <= 20000),
  based_on_version  INTEGER,
  updated_by        TEXT NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (target, kind)
);

-- "I have reviewed this agent and approve it", against the version live at the time
-- (0 = no instructions published yet, the code instructions alone). Never changed or deleted.
CREATE TABLE IF NOT EXISTS public.agent_signoffs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target       TEXT NOT NULL CHECK (target ~ '^[a-z][a-z:-]{1,60}$'),
  version      INTEGER NOT NULL CHECK (version >= 0),
  signed_by    TEXT NOT NULL,
  signed_name  TEXT NOT NULL CHECK (length(signed_name) BETWEEN 1 AND 200),
  note         TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_signoffs_target_idx ON public.agent_signoffs (target, created_at DESC);

-- History is permanent.
CREATE OR REPLACE FUNCTION public.refuse_history_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is a permanent history: rows are never changed or deleted', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS agent_instruction_versions_permanent ON public.agent_instruction_versions;
CREATE TRIGGER agent_instruction_versions_permanent
  BEFORE UPDATE OR DELETE ON public.agent_instruction_versions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_history_change();

DROP TRIGGER IF EXISTS agent_signoffs_permanent ON public.agent_signoffs;
CREATE TRIGGER agent_signoffs_permanent
  BEFORE UPDATE OR DELETE ON public.agent_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.refuse_history_change();

-- Publishes a new version (the next number for the target, allocated under a lock so two
-- people publishing at once can't take the same number) and removes the draft. Returns the
-- new version number.
CREATE OR REPLACE FUNCTION public.publish_agent_instructions(
  p_target TEXT, p_kind TEXT, p_body TEXT, p_note TEXT, p_by TEXT, p_restored_from INTEGER DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  next_version INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('agent_instructions:' || p_target || ':' || p_kind));
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
    FROM public.agent_instruction_versions WHERE target = p_target AND kind = p_kind;
  INSERT INTO public.agent_instruction_versions (target, kind, version, body, note, restored_from, created_by)
    VALUES (p_target, p_kind, next_version, p_body, COALESCE(p_note, ''), p_restored_from, p_by);
  DELETE FROM public.agent_instruction_drafts WHERE target = p_target AND kind = p_kind;
  RETURN next_version;
END;
$$;

ALTER TABLE public.agent_instruction_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_instruction_drafts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_signoffs             ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_instruction_versions, public.agent_instruction_drafts, public.agent_signoffs FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_agent_instructions(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
