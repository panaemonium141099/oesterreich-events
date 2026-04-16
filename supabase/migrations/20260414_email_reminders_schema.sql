-- Migration: Email reminders schema enhancements
-- Ensures notification_preferences has reminder toggle columns and
-- adds unique partial indexes for reminder notification dedup.
--
-- Part of: email reminder system for saved events + match alerts

-- ============================================================
-- 1. Add reminder columns to notification_preferences (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_preferences' AND column_name = 'reminder_7d'
  ) THEN
    ALTER TABLE notification_preferences ADD COLUMN reminder_7d boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_preferences' AND column_name = 'reminder_1d'
  ) THEN
    ALTER TABLE notification_preferences ADD COLUMN reminder_1d boolean NOT NULL DEFAULT true;
  END IF;

  -- Additional preference columns used by NotificationSettings UI
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_preferences' AND column_name = 'city_digest_enabled'
  ) THEN
    ALTER TABLE notification_preferences ADD COLUMN city_digest_enabled boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_preferences' AND column_name = 'venue_alerts_enabled'
  ) THEN
    ALTER TABLE notification_preferences ADD COLUMN venue_alerts_enabled boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_preferences' AND column_name = 'today_near_you_enabled'
  ) THEN
    ALTER TABLE notification_preferences ADD COLUMN today_near_you_enabled boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_preferences' AND column_name = 'student_alerts_enabled'
  ) THEN
    ALTER TABLE notification_preferences ADD COLUMN student_alerts_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 2. Unique partial indexes for reminder notification dedup
-- ============================================================
-- Prevents sending the same reminder type twice for the same user+event
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_reminder_7d_dedup
  ON notifications (user_id, event_id)
  WHERE type = 'saved_event_reminder_7d';

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_reminder_1d_dedup
  ON notifications (user_id, event_id)
  WHERE type = 'saved_event_reminder_1d';
