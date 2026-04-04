-- Add geocoding_confidence and geocoding_source columns to events table.
-- Both nullable to handle existing events gracefully (NULL = legacy/unknown = lowest priority).
--
-- Confidence precedence (highest first):
--   manual > scraper > exact > normalized > from_title > from_description > nominatim > NULL
--
-- Source values: geonames, nominatim, known_locations, scraper, manual, NULL

ALTER TABLE events ADD COLUMN IF NOT EXISTS geocoding_confidence TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS geocoding_source TEXT;

-- Index for querying events by confidence level (e.g., finding all low-confidence events)
CREATE INDEX IF NOT EXISTS idx_events_geocoding_confidence ON events (geocoding_confidence);

COMMENT ON COLUMN events.geocoding_confidence IS 'Confidence level of coordinate assignment: manual, scraper, exact, normalized, from_title, from_description, nominatim, or NULL (unknown/legacy)';
COMMENT ON COLUMN events.geocoding_source IS 'Source of coordinates: geonames, nominatim, known_locations, scraper, manual, or NULL (unknown/legacy)';
