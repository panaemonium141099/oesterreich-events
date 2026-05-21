-- Detail-fetch tracking columns + indexes.
-- See docs/superpowers/specs/2026-05-21-detail-fetch-system-design.md §11.

ALTER TABLE events
  ADD COLUMN last_detail_fetch_at    timestamptz,
  ADD COLUMN last_detail_fetch_status text
    CHECK (last_detail_fetch_status IN
      ('success','no_change','http_error','timeout','invalid_html','parse_empty')),
  ADD COLUMN address_confidence      text
    CHECK (address_confidence IN ('high','medium','low'));

CREATE INDEX IF NOT EXISTS idx_events_detail_fetch_at
  ON events (last_detail_fetch_at);

-- Partial index without CURRENT_DATE (not IMMUTABLE).
-- Query-side filter handles start_date >= CURRENT_DATE.
CREATE INDEX IF NOT EXISTS idx_events_backfill_eligible
  ON events (source_name, last_detail_fetch_at)
  WHERE source_url IS NOT NULL;
