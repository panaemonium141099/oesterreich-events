-- Event enrichment proposals — review queue for AI-agent-generated field suggestions.
--
-- The agent (src/scripts/agent-enrich.ts) writes proposals here; a human reviewer
-- approves or declines each, and on approval the proposed values are merged into
-- the `events` table. This deliberately decouples the agent from live data so
-- LLM hallucinations cannot pollute production without human gating.
--
-- Lifecycle:
--   1. agent-enrich.ts INSERTs row with status='pending'
--   2. Admin UI (or CLI) lists pending → human reviews
--   3. On approve: UPDATE events SET <fields> = proposed_<fields>, set status='approved'
--   4. On decline: set status='declined' with optional reason
--
-- Constraints:
--   - Only ONE pending proposal per event (unique partial index). Re-running the
--     agent on the same event overwrites the pending row via upsert.
--   - Approved/declined rows are kept for audit; never deleted unless event is.

CREATE TABLE IF NOT EXISTS event_enrichment_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  decline_reason TEXT,

  -- Proposed values — NULL means agent did not propose this field.
  proposed_image_url TEXT,
  proposed_description TEXT,
  proposed_price_text TEXT,
  proposed_price_min NUMERIC,
  proposed_price_max NUMERIC,
  proposed_tags TEXT[],

  -- Provenance
  image_source TEXT,         -- 'source-og' | 'source-img' | 'google-search' | 'wikipedia' | …
  agent_model TEXT,          -- e.g. 'claude-opus-4-7'
  agent_reasoning TEXT,      -- short note about what the agent did and where data came from
  agent_run_id UUID          -- groups proposals from one batch run for debugging
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS eep_status_created_idx
  ON event_enrichment_proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS eep_event_id_idx
  ON event_enrichment_proposals (event_id);

-- One pending proposal per event — agent re-runs upsert into this slot.
CREATE UNIQUE INDEX IF NOT EXISTS eep_one_pending_per_event
  ON event_enrichment_proposals (event_id)
  WHERE status = 'pending';

-- ── RLS ──
-- Service-role bypasses RLS, so enabling it here just locks out anon/authenticated
-- until we know the admin-role pattern in Phase 2 (Web-UI). At that point we'll
-- add a SELECT/UPDATE policy gated on the admin role.
ALTER TABLE event_enrichment_proposals ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE event_enrichment_proposals IS
  'Review queue for AI-agent-generated event field enrichment. See src/scripts/agent-enrich.ts.';
