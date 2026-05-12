-- fn-14.4 fix: add '48-stunden' to events.duration_type allowed values.
--
-- Code-Vokabular in src/lib/category-classifier/enrichment-taxonomy.ts:344-347
-- enthält '48-stunden' (für 48h-Festivals, Hackathons, 48-Stunden-Neukölln-Style
-- Events), aber die DB-Check-Constraint listete den Wert nicht — Validator hat
-- '48-stunden' durchgewunken, RPC bulk_update_event_enrichment knallte mit
-- check constraint violation, [fatal-abort] killte den ganzen Bulk-Run.
--
-- Fix: DB an Code anpassen (Code/TAXONOMY.md sind SoT für das Vokabular).
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_duration_type_check;

ALTER TABLE events
  ADD CONSTRAINT events_duration_type_check
  CHECK (
    duration_type IS NULL
    OR duration_type = ANY (ARRAY[
      'kurz'::text,
      'abend'::text,
      'ganztag'::text,
      'mehrtägig'::text,
      'dauerausstellung'::text,
      'nacht-bis-morgen'::text,
      '24-stunden'::text,
      '48-stunden'::text
    ])
  );
