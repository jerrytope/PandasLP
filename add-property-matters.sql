-- ============================================================
-- Property Law Agent matter state (docs/property_agent_plans/, Phase 1).
--
-- One property_matters row per property case: the state the property is in, which of the
-- seven areas is handling it, and the facts the client has already given, so a hand-off
-- between areas never asks the client again. cases.agent_id stays 'recovery-of-premises';
-- the area lives here.
--
-- property_matter_events is the log: every route, hand-off, escalation, fee acceptance and
-- document emitted.
--
-- Everything here is server-only: RLS on with no policies, and no privileges for the
-- browser's roles. Written by /api/chat (lib/property/matterStore.ts) with the service-role key.
--
-- Needs public.touch_updated_at() from supabase-schema.sql.
-- RUN ORDER ON PRODUCTION: run this BEFORE deploying the code that ships with it. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.property_matters (
  case_id     UUID        PRIMARY KEY REFERENCES public.cases(id) ON DELETE CASCADE,
  -- The state the property is in, e.g. 'Lagos', 'FCT', 'Oyo'.
  state       TEXT,
  -- Lagos only: the area, for the Apapa / Ikeja GRA / Ikoyi / Victoria Island exception.
  lagos_area  TEXT,
  -- Which of the seven areas is handling the matter. Same list as lib/property/types.ts.
  area        TEXT        CHECK (area IS NULL OR area IN (
                'recovery', 'tenancy', 'conveyancing', 'other-instruments',
                'searches', 'wills-probate', 'land-dispute')),
  facts       JSONB       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(facts) = 'object'),
  status      TEXT        NOT NULL DEFAULT 'routing' CHECK (status IN ('routing', 'active', 'escalated', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.property_matter_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID        NOT NULL REFERENCES public.property_matters(case_id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL CHECK (kind IN ('routed', 'handoff', 'escalated', 'fee_accepted', 'document_emitted')),
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS property_matter_events_case_idx ON public.property_matter_events (case_id, created_at);

DROP TRIGGER IF EXISTS property_matters_touch ON public.property_matters;
CREATE TRIGGER property_matters_touch BEFORE UPDATE ON public.property_matters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Merges new facts into a matter in one statement, so two tool calls in the same turn can't
-- overwrite each other's facts. Top-level keys in p_facts replace the same keys.
CREATE OR REPLACE FUNCTION public.merge_property_matter_facts(p_case_id UUID, p_facts JSONB)
RETURNS JSONB
LANGUAGE sql
AS $$
  UPDATE public.property_matters
     SET facts = facts || p_facts
   WHERE case_id = p_case_id
  RETURNING facts;
$$;

ALTER TABLE public.property_matters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_matter_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_matters, public.property_matter_events FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_property_matter_facts(UUID, JSONB) FROM PUBLIC, anon, authenticated;
