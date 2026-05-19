-- Address enrichment for event_enrichment_proposals.
--
-- 99.99% of Feratel events (15,155/15,156) have address=NULL because the
-- Deskline API doesn't expose street-level data. ~70k future events overall
-- lack an address. Without an address the coordinate trust gate (PR #46)
-- shows "Ortsangabe ungefähr" instead of a Route link — useful but a
-- regression from the user's POV.
--
-- The agent now also proposes location_name (specific venue), address
-- (street + number), postal_code. On approve the API route additionally
-- nulls event.latitude/longitude/geocoding_confidence so the existing
-- geocoding cron picks up the event next run and computes accurate coords
-- from the new address — instead of the LLM guessing lat/lng which we
-- explicitly do not want.
--
-- Applied to prod via MCP on 2026-05-19; this file is for reproducibility.

ALTER TABLE event_enrichment_proposals
  ADD COLUMN IF NOT EXISTS proposed_location_name TEXT,
  ADD COLUMN IF NOT EXISTS proposed_address TEXT,
  ADD COLUMN IF NOT EXISTS proposed_postal_code TEXT;

COMMENT ON COLUMN event_enrichment_proposals.proposed_location_name IS
  'Venue name proposal — specific venue (e.g. "Theater Phoenix"), not just town.';
COMMENT ON COLUMN event_enrichment_proposals.proposed_address IS
  'Street address proposal (street + number). On approve, also clears event.latitude/longitude/geocoding_confidence so the geocoding pipeline reruns.';
COMMENT ON COLUMN event_enrichment_proposals.proposed_postal_code IS
  'Austrian PLZ (4 digits).';
