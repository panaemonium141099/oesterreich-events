-- Add proposed_category to event_enrichment_proposals.
--
-- Why: 18k of ~68k events have category='Sonstiges' — by far the biggest bucket
-- in the frontend filter and almost useless for discovery. The agent now also
-- re-classifies these into one of the 11 real primary categories (Musik,
-- Kultur & Bühne, etc.) where it can find a confident match. Like all other
-- proposed_* fields: NULL = agent did not propose a re-categorization.
--
-- Applied to prod via MCP on 2026-05-19; this file is for reproducibility on
-- fresh databases.

ALTER TABLE event_enrichment_proposals
  ADD COLUMN IF NOT EXISTS proposed_category TEXT;

COMMENT ON COLUMN event_enrichment_proposals.proposed_category IS
  'Re-categorization proposal — populated when the agent reclassifies a Sonstiges event into one of the 11 real primary categories. NULL = no proposal.';
