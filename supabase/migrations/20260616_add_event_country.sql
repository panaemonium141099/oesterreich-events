-- Add country to events. Existing rows are Austria-focused -> default 'AT'.
-- The Eventim importer sets real country (AT/DE/CH) from the feed.
-- Applied to prod via Supabase MCP on 2026-06-16 (additive, idempotent).
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'AT';

CREATE INDEX IF NOT EXISTS idx_events_country ON public.events (country);

-- Backfill the rare existing non-AT rows (e.g. Feratel border events) by coords.
UPDATE public.events SET country = 'DE'
  WHERE latitude BETWEEN 47.2 AND 55.1 AND longitude BETWEEN 5.8 AND 15.0
    AND NOT (latitude BETWEEN 46.3 AND 49.1 AND longitude BETWEEN 9.5 AND 17.2);
UPDATE public.events SET country = 'CH'
  WHERE latitude BETWEEN 45.8 AND 47.8 AND longitude BETWEEN 5.9 AND 10.5
    AND NOT (latitude BETWEEN 46.3 AND 49.1 AND longitude BETWEEN 9.5 AND 17.2);
