-- fn-14.2 Migration A: events table — image dimensions, lifecycle flags,
-- and 3 new boolean facets (dog-friendly, wheelchair-accessible, outdoor).
--
-- Why
--   * image_width/image_height: persisted Bildgrößen (Codex-Finding —
--     image quality requires storing dims so the UPSERT-Guard can compare
--     "new candidate vs. existing best image"; sync extractImageUrl()
--     remains string-only, async helper fills these in supabase-sync).
--   * last_seen_at: every UPSERT touches this (supabase-sync write-path).
--     The partial index drives the soft-delete sweep
--     (last_seen_at < now()-30d) and excludes already-tombstoned rows.
--   * enrichment_failed / enrichment_failure_count: poison-pill counter
--     so a row that fails Zod validation 3× gets permanently skipped.
--     Selection contract reads `WHERE enrichment_failed IS NOT TRUE`.
--   * is_dog_friendly / is_wheelchair_accessible / is_outdoor: 3 new
--     boolean facets the Claude prompt populates (fn-14.3 Interview).
--     All default FALSE — only set TRUE on explicit evidence in the
--     scraped text.
--
-- Idempotency
--   ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS make this safe
--   to re-apply. The backfill UPDATE only touches rows where
--   last_seen_at IS NULL, so a second apply is a no-op.
--
-- Postgres ≥ 11 makes ADD COLUMN with DEFAULT a metadata-only operation
-- (no full table rewrite), so this is fast even on the ~183k events row
-- count.

ALTER TABLE events ADD COLUMN IF NOT EXISTS image_width INT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_height INT;

-- last_seen_at is added WITHOUT a default first, so existing rows read as
-- NULL (not NOW()). We then backfill from updated_at, and only after that
-- attach DEFAULT NOW() so future INSERTs/UPSERTs get the right behavior.
--
-- Why this ordering matters
--   On Postgres 11+, ADD COLUMN with a DEFAULT is metadata-only — it does
--   *not* materialise that default into the heap; readers immediately see
--   the default value. So if we had used `DEFAULT NOW()` on ADD, every
--   existing row would instantly read NOW() (= migration time), and the
--   subsequent `UPDATE ... WHERE last_seen_at IS NULL` would match zero
--   rows. Existing rows would look "newly seen at migration time" and
--   the soft-delete sweep would never expire them.
--   Codex-Review-Finding (Major) on this fn-14.2 task.
--
-- Idempotency
--   ADD COLUMN IF NOT EXISTS handles re-apply on the events.last_seen_at
--   column itself. The backfill UPDATE only touches NULL rows, so a
--   second apply is a no-op once the column is populated. SET DEFAULT is
--   idempotent (re-stating the same default).
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
UPDATE events
   SET last_seen_at = updated_at
 WHERE last_seen_at IS NULL;
ALTER TABLE events ALTER COLUMN last_seen_at SET DEFAULT NOW();

ALTER TABLE events ADD COLUMN IF NOT EXISTS enrichment_failed BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS enrichment_failure_count INT DEFAULT 0;

-- 3 new boolean facets (fn-14.3 Interview-Decision)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_dog_friendly BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_wheelchair_accessible BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_outdoor BOOLEAN DEFAULT FALSE;

-- Stale-event sweep index. Partial WHERE excludes rows already tombstoned
-- by the soft-delete pass — keeps the index small (only "alive" rows).
CREATE INDEX IF NOT EXISTS events_stale_idx ON events(last_seen_at)
  WHERE publish_status NOT IN ('expired','duplicate','suppressed');
