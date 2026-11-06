-- Small Claims Court filing workflow for the admin dashboard (Court filing tab).
--
-- court_filings: one row per case that goes to court. Holds the facts the court forms need
-- (parties, amount, particulars) and the dates of each step, from which the dashboard works
-- out every deadline in the Practice Direction (see lib/courtFiling.ts).
-- court_filing_documents: every form or court document drafted for that filing (AI drafts
-- and staff edits), kept as a history rather than overwritten.
--
-- Purely additive: CREATE ... IF NOT EXISTS only, safe to run more than once, nothing
-- existing is changed. Run it in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.court_filings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID        NOT NULL UNIQUE REFERENCES public.cases(id) ON DELETE CASCADE,
  -- State whose Small Claims Practice Direction applies: 'lagos', 'delta', ...
  state                 TEXT        NOT NULL DEFAULT 'lagos',
  -- Magisterial district / registry where the claim is filed.
  registry              TEXT,
  -- Parties, amount and particulars used to fill every form. Extracted by AI from the
  -- interview and the demand letter, then checked and edited by staff.
  facts                 JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Step 1: the letter of demand (Form 1) must be served before filing.
  demand_served_at      DATE,
  demand_service_proof  TEXT,

  -- Step 3: filing at the registry.
  filed_at              DATE,
  claim_number          TEXT,
  filing_fee            INTEGER,
  summons_issued_at     DATE,
  first_hearing_at      DATE,

  -- Step 4: service of the summons by the court bailiff.
  service_outcome       TEXT CHECK (service_outcome IS NULL OR service_outcome IN ('served', 'not_served', 'substituted_ordered', 'served_substituted')),
  served_at             DATE,

  -- Step 5: what the defendant filed (Form 5), within 7 days of service.
  defence_type          TEXT CHECK (defence_type IS NULL OR defence_type IN ('none', 'admission', 'defence', 'counterclaim')),
  defence_received_at   DATE,
  defence_summary       TEXT,

  -- Step 6: mediation and hearing.
  settled_at            DATE,
  hearing_notes         TEXT,

  -- Step 7: judgment.
  judgment_at           DATE,
  judgment_outcome      TEXT CHECK (judgment_outcome IS NULL OR judgment_outcome IN ('won', 'part', 'lost', 'struck_out', 'consent')),
  judgment_sum          INTEGER,

  -- Step 8: enforcement.
  enforcement_started_at DATE,

  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by            TEXT
);

CREATE TABLE IF NOT EXISTS public.court_filing_documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id     UUID        NOT NULL REFERENCES public.court_filings(id) ON DELETE CASCADE,
  -- 'complaint', 'summons', 'substituted_service', 'reply', 'hearing_pack',
  -- 'settlement', 'garnishee', 'appeal_note', 'letter_check'
  kind          TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  ai_generated  BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_court_filing_documents_filing ON public.court_filing_documents(filing_id, kind, created_at DESC);

-- Service role only, same posture as case_negotiations: the admin API reads and writes these
-- with the service key; no browser policies.
ALTER TABLE public.court_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_filing_documents ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Check: both tables should be listed.
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('court_filings', 'court_filing_documents')
order by table_name;
