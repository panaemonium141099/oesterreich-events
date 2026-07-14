-- MASTERPLAN §9.1 / P2: tägliche Aggregate + 90-Tage-Retention der Rohdaten.
-- pg_cron-Jobs (rollup-analytics-daily 02:10, purge-analytics-raw 02:40)
-- wurden separat via cron.schedule angelegt.
CREATE TABLE IF NOT EXISTS analytics_daily (
  day date NOT NULL,
  event_type text NOT NULL,
  page_group text NOT NULL DEFAULT '',
  events bigint NOT NULL DEFAULT 0,
  sessions bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event_type, page_group)
);

CREATE OR REPLACE FUNCTION rollup_analytics_day(target_day date)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO analytics_daily (day, event_type, page_group, events, sessions)
  SELECT
    target_day,
    event_type,
    COALESCE('/' || split_part(trim(leading '/' from COALESCE(page, '')), '/', 1), ''),
    count(*),
    count(DISTINCT session_id)
  FROM analytics_events
  WHERE created_at >= target_day::timestamptz
    AND created_at < (target_day + 1)::timestamptz
  GROUP BY 2, 3
  ON CONFLICT (day, event_type, page_group)
  DO UPDATE SET events = EXCLUDED.events, sessions = EXCLUDED.sessions;
$$;
