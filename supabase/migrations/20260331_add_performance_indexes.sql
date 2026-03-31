-- Performance indexes for viewport-based loading and date filtering
-- Task: fn-1-comprehensive-audit-and-feature-upgrade.9

-- Composite index on latitude/longitude for bounding box queries
-- Covers WHERE latitude >= ? AND latitude <= ? AND longitude >= ? AND longitude <= ?
CREATE INDEX IF NOT EXISTS idx_events_geo ON events (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index on start_date for date range queries and cursor pagination
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events (start_date);

-- Composite index for cursor-based pagination (start_date, id)
CREATE INDEX IF NOT EXISTS idx_events_pagination ON events (start_date ASC, id ASC);
