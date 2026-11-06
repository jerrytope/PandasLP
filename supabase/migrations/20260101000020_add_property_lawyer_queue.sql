-- ============================================================
-- Property matters that need a lawyer (docs/property_agent_plans/, Phase 5 pre-launch gap).
--
-- A property matter is flagged when the agent escalates it, or when it produces a document that
-- nothing is paid for online (PRICE 0: a transfer deed invoiced by the firm, or a fee a lawyer
-- confirms: wills, probate papers, dispute briefs...). Without this, both only lived in
-- property_matters / property_matter_events and no member of staff was told.
--
-- Flagging emails the staff inbox and puts the matter in Admin → Action Queue; a member of
-- staff then takes it (lawyer_taken_at), sends it back to the agent, or closes it.
--
-- RUN ORDER: after add-law-library.sql. Safe to re-run.
-- ============================================================

ALTER TABLE public.property_matters
  ADD COLUMN IF NOT EXISTS needs_lawyer_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS needs_lawyer_reason TEXT,
  ADD COLUMN IF NOT EXISTS lawyer_taken_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lawyer_taken_by     TEXT;

-- The Action Queue: flagged and not yet taken.
CREATE INDEX IF NOT EXISTS property_matters_lawyer_queue_idx
  ON public.property_matters (needs_lawyer_at)
  WHERE needs_lawyer_at IS NOT NULL AND lawyer_taken_at IS NULL;

-- 'lawyer_taken': a member of staff took the matter (payload: by, action).
ALTER TABLE public.property_matter_events DROP CONSTRAINT IF EXISTS property_matter_events_kind_check;
ALTER TABLE public.property_matter_events ADD CONSTRAINT property_matter_events_kind_check
  CHECK (kind IN ('routed', 'handoff', 'escalated', 'fee_accepted', 'document_emitted', 'law_lookup', 'web_search', 'lawyer_taken'));
