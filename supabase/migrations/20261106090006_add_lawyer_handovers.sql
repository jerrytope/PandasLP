CREATE TABLE IF NOT EXISTS public.lawyer_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  conversation_key text NOT NULL,
  agent_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('legal_question', 'lawyer_review', 'client_request')),
  summary text NOT NULL,
  contact_preference text,
  contact_detail text,
  client_email text,
  client_phone text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  handled_at timestamptz,
  handled_by text
);

ALTER TABLE public.lawyer_handovers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lawyer_handovers_open
  ON public.lawyer_handovers(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lawyer_handovers_case
  ON public.lawyer_handovers(case_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_handovers_conversation
  ON public.lawyer_handovers(conversation_key, created_at DESC);

NOTIFY pgrst, 'reload schema';
