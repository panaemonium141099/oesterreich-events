-- ─────────────────────────────────────────────────────────────────────────
-- Lifecycle emails + IP-derived geo
-- ─────────────────────────────────────────────────────────────────────────
--
-- Adds:
--   profiles.detected_city / detected_lat / detected_lng / detected_at
--     → populated from Vercel-Edge headers (x-vercel-ip-*) at every login.
--       Provides a baseline location for ~all users, used as fallback when
--       the user did not fill in postal_code/city manually.
--   profiles.last_active_at
--     → bumped on every detect-location call (cheap proxy for "seen recently").
--       Used by the lifecycle cron to identify reactivation candidates without
--       hitting auth.users from a service role context.
--
--   notification_preferences.lifecycle_emails_enabled (DEFAULT true)
--     → opt-out flag for welcome / reactivation / weekend-picks lifecycle mails.
--   notification_preferences.lifecycle_email_sent_at
--     → timestamp of the last lifecycle email; cron uses it to enforce
--       "max 1 lifecycle email per 7 days per user" globally across cohorts.
--   notification_preferences.lifecycle_cohort_last
--     → which cohort the last mail was for (welcome | reactivation | weekend).
--       Lets us dedupe welcome (only ever 1×) and pace reactivation (max every 60 d).

-- ── profiles ──────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS detected_city  text,
  ADD COLUMN IF NOT EXISTS detected_lat   double precision,
  ADD COLUMN IF NOT EXISTS detected_lng   double precision,
  ADD COLUMN IF NOT EXISTS detected_at    timestamptz,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

COMMENT ON COLUMN profiles.detected_city IS 'City inferred from Vercel-Edge IP geo at login. Coarse (5-20km), but covers users who never filled in postal_code.';
COMMENT ON COLUMN profiles.last_active_at IS 'Bumped on /api/auth/detect-location (called from auth-context SIGNED_IN). Cheap proxy for "user was active recently".';

-- Index for cron scans (find users active in window N)
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at
  ON profiles (last_active_at DESC NULLS LAST);

-- ── notification_preferences ─────────────────────────────────────────────
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS lifecycle_emails_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lifecycle_email_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS lifecycle_cohort_last    text
    CHECK (lifecycle_cohort_last IN ('welcome', 'reactivation', 'weekend'));

COMMENT ON COLUMN notification_preferences.lifecycle_emails_enabled IS 'Master opt-out for welcome / reactivation / weekend-pick lifecycle mails. Default true; unsubscribe link sets it to false.';
COMMENT ON COLUMN notification_preferences.lifecycle_email_sent_at IS 'Last lifecycle mail timestamp. Cron enforces ≥7d gap globally + ≥60d for reactivation, ≥0 (never resend) for welcome.';

-- Index for cron filter "enabled AND (never sent OR sent > 7d ago)"
CREATE INDEX IF NOT EXISTS idx_notif_prefs_lifecycle
  ON notification_preferences (lifecycle_emails_enabled, lifecycle_email_sent_at)
  WHERE lifecycle_emails_enabled = true;
