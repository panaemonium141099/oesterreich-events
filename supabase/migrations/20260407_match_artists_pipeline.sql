-- Artist-event matching pipeline: pg_cron + pg_net + Vault secrets
-- Enables automated matching every 5 minutes as fallback to post-scrape hook.
-- Task: fn-10-spotify-artist-alerts-follow-artists.7

-- ============================================================
-- 1. Enable required extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- 2. Store project URL and publishable key in Vault
--    The publishable (anon) key is used for Edge Function gateway auth.
--    The Edge Function itself uses SUPABASE_SERVICE_ROLE_KEY env var
--    (automatically available) for database operations.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_url') THEN
    PERFORM vault.create_secret(
      'https://booljdtrktpotsenbnut.supabase.co',
      'project_url'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'publishable_key') THEN
    PERFORM vault.create_secret(
      'REPLACE_WITH_ANON_KEY',
      'publishable_key'
    );
  END IF;
END $$;

-- ============================================================
-- 3. pg_cron job: invoke match-artists Edge Function every 5 min
-- ============================================================
SELECT cron.schedule(
  'match-artists-pipeline',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/match-artists',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
    ),
    body := jsonb_build_object(
      'source', 'pg_cron',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 150000
  ) AS request_id;
  $$
);
