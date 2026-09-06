-- fn-23: eventStatus für schema.org/Event (Absagen & Verschiebungen).
--
-- Angewendet auf Prod (Hetzner, /opt/supabase) am 2026-09-06:
--   docker compose exec -T db psql -U supabase_admin -d postgres
-- Danach `NOTIFY pgrst, 'reload schema'` — ohne den Reload liefert PostgREST
-- die neuen Spalten trotz Migration nicht aus.
--
-- Bisher stand `eventStatus` im JSON-LD hart auf `EventScheduled`, weil es
-- keine Spalte gab, in der eine Absage überhaupt gepflegt werden konnte.
-- Google verlangt bei abgesagten/verschobenen Events, dass die Seite
-- ONLINE BLEIBT und der Status im Markup gepflegt wird — sonst verliert
-- man die Rich Results (und bei wiederholten Falschangaben das Vertrauen
-- für die gesamte Domain).
--
-- Mapping in src/lib/seo/event-schema.ts:
--   scheduled     -> https://schema.org/EventScheduled
--   cancelled     -> https://schema.org/EventCancelled     (+ offers.availability = SoldOut)
--   postponed     -> https://schema.org/EventPostponed     (Termin bleibt stehen, wenn unbekannt)
--   rescheduled   -> https://schema.org/EventRescheduled   (+ previousStartDate, Pflichtfeld)
--   moved_online  -> https://schema.org/EventMovedOnline   (+ OnlineEventAttendanceMode, VirtualLocation)
--
-- Nullable/DEFAULT ADD COLUMN ist ab PG 11 metadata-only — kein Table-Rewrite
-- auf den ~280k Zeilen. Die CHECK-Constraint wird bewusst als NOT VALID
-- angelegt und danach separat validiert: ein sofortiger Validierungs-Scan
-- über die volle Tabelle läuft auf der Supabase-Micro-Instanz ins
-- Statement-Timeout (siehe MASTERPLAN §10.1).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS previous_start_date timestamptz;

COMMENT ON COLUMN public.events.event_status IS
  'schema.org-Eventstatus: scheduled|cancelled|postponed|rescheduled|moved_online. Gepflegt via PATCH /api/admin/events/[id]/event-status.';
COMMENT ON COLUMN public.events.previous_start_date IS
  'Ursprünglicher Termin vor einer Verschiebung. Von Google als previousStartDate bei EventRescheduled verlangt.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_event_status_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_event_status_check
      CHECK (event_status IN ('scheduled', 'cancelled', 'postponed', 'rescheduled', 'moved_online'))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.events VALIDATE CONSTRAINT events_event_status_check;

-- Partial-Index: nur die Handvoll nicht-planmässiger Events. Speist den
-- Admin-Überblick "welche Events sind aktuell abgesagt/verschoben?", ohne
-- einen Index über alle 280k Zeilen zu bezahlen.
CREATE INDEX IF NOT EXISTS events_non_scheduled_idx
  ON public.events (event_status, start_date)
  WHERE event_status <> 'scheduled';
