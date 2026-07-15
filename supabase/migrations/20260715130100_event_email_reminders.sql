-- Anonyme Event-Reminder (User-Auftrag 2026-07-15): Events ohne Login
-- merken — E-Mail eintragen, Double-Opt-in wie Newsletter, Erinnerung
-- 2 Tage vorher + am Event-Tag über den send-reminders-Cron.
-- FK CASCADE ist gewollt: archivierte Alt-Events (>90 Tage) räumen ihre
-- längst versendeten Reminder mit ab (archive_old_events, 20260714073902).
CREATE TABLE public.event_email_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  reminded_2d_at timestamptz,
  reminded_day_at timestamptz,
  UNIQUE (email, event_id)
);

ALTER TABLE public.event_email_reminders ENABLE ROW LEVEL SECURITY; -- keine Policies: nur service_role

CREATE INDEX idx_event_email_reminders_active
  ON public.event_email_reminders (event_id)
  WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;
