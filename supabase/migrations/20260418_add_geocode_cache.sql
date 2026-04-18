-- Shared geocode cache, replacing the previous SQLite-only `geocode_cache`.
-- Every scraper + the OpenAI batch script reads/writes here, so cache entries
-- persist across machines and CI runs.
--
-- Cache keys follow two shapes:
--   - "query||hint"             (Nominatim-cached lookups)
--   - "gemini::location||bundesland" (OpenAI-cached lookups)
-- Both are stable and deduplicated by the script layer.

CREATE TABLE IF NOT EXISTS geocode_cache (
  query       TEXT PRIMARY KEY,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  cached_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Small partial index for "recently cached" debugging queries; main PK is enough
-- for the hot path (exact lookup by query string).
CREATE INDEX IF NOT EXISTS idx_geocode_cache_cached_at
  ON geocode_cache (cached_at DESC);

COMMENT ON TABLE geocode_cache IS
  'Shared cache of resolved coordinates. Prevents re-paying Nominatim and OpenAI for the same venue names across runs/machines/CI.';
