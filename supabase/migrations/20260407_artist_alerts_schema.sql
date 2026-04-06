-- Artist Alerts schema: spotify_tokens, imported_spotify_artists, followed_artists,
-- artist_event_notifications, notification_preferences, matching_cursor
-- Task: fn-10-spotify-artist-alerts-follow-artists.2

-- pg_trgm extension (already enabled, idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on events.title (already exists, idempotent)
CREATE INDEX IF NOT EXISTS idx_events_title_trgm
  ON events USING gin (title gin_trgm_ops);

-- ============================================================
-- 1. spotify_tokens — server-only, NO authenticated RLS access
-- ============================================================
CREATE TABLE IF NOT EXISTS spotify_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  spotify_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE spotify_tokens ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated role — only service_role can access
-- Explicitly deny all operations for authenticated users
CREATE POLICY "Deny all for authenticated on spotify_tokens"
  ON spotify_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- 2. imported_spotify_artists — staging table for top artists
-- ============================================================
CREATE TABLE IF NOT EXISTS imported_spotify_artists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artist_name text NOT NULL,
  spotify_artist_id text NOT NULL,
  spotify_image_url text,
  genres jsonb,
  popularity int,
  rank int NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_imported_spotify_user_artist UNIQUE (user_id, spotify_artist_id)
);

ALTER TABLE imported_spotify_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own imported artists"
  ON imported_spotify_artists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own imported artists"
  ON imported_spotify_artists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own imported artists"
  ON imported_spotify_artists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own imported artists"
  ON imported_spotify_artists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. followed_artists — hard delete semantics
-- ============================================================
CREATE TABLE IF NOT EXISTS followed_artists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artist_name text NOT NULL,
  artist_name_normalized text NOT NULL GENERATED ALWAYS AS (lower(artist_name)) STORED,
  spotify_artist_id text,
  spotify_image_url text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('spotify', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_followed_user_artist UNIQUE (user_id, artist_name_normalized)
);

ALTER TABLE followed_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own followed artists"
  ON followed_artists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can follow artists"
  ON followed_artists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own followed artists"
  ON followed_artists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow artists"
  ON followed_artists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for matching engine: lookup all followed artists efficiently
CREATE INDEX IF NOT EXISTS idx_followed_artists_normalized
  ON followed_artists (artist_name_normalized);

-- ============================================================
-- 4. artist_event_notifications — per-artist match tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS artist_event_notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  artist_name text NOT NULL,
  match_score real NOT NULL DEFAULT 0,
  match_source text NOT NULL DEFAULT 'title' CHECK (match_source IN ('title', 'description')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_artist_event_notification UNIQUE (user_id, event_id, artist_name)
);

ALTER TABLE artist_event_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own artist event notifications"
  ON artist_event_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert/update/delete restricted to service_role (matching engine)
-- No INSERT/UPDATE/DELETE policies for authenticated users

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_artist_event_notif_user
  ON artist_event_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_artist_event_notif_event
  ON artist_event_notifications (event_id);

-- ============================================================
-- 5. notification_preferences — one row per user
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  artist_alerts_enabled boolean NOT NULL DEFAULT true,
  channel_in_app boolean NOT NULL DEFAULT true,
  channel_email boolean NOT NULL DEFAULT false,
  channel_sms boolean NOT NULL DEFAULT false,
  phone_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. matching_cursor — singleton for incremental state tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS matching_cursor (
  id text PRIMARY KEY DEFAULT 'artist_matching',
  last_processed_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  last_success_at timestamptz,
  events_processed int NOT NULL DEFAULT 0,
  matches_found int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE matching_cursor ENABLE ROW LEVEL SECURITY;

-- No authenticated access — service_role only
CREATE POLICY "Deny all for authenticated on matching_cursor"
  ON matching_cursor
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Seed singleton row
INSERT INTO matching_cursor (id) VALUES ('artist_matching')
  ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. Unique partial index on notifications for spotify_match dedup
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_artist_dedup
  ON notifications (user_id, event_id) WHERE type = 'spotify_match';
