-- Zurückgezogene Events: die Quelle listet das Event nicht mehr.
--
-- Gesetzt vom nächtlichen Schritt withdraw-stale-events (zusammen mit
-- publish_status = 'suppressed'), zurückgesetzt vom Schreibpfad
-- supabase-sync, sobald die Quelle das Event wieder listet. Regeln:
-- src/lib/quality/withdrawal.ts.
--
-- Nullable ohne Default: reine Metadaten-Änderung, kein Table-Rewrite.
-- MUSS vor dem Code-Deploy laufen — der Schreibpfad schreibt die Spalte
-- bei jedem Upsert, ohne sie scheitert jeder Scrape-Batch.

ALTER TABLE events ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;

COMMENT ON COLUMN events.withdrawn_at IS
  'Quelle listet das Event nicht mehr (withdraw-stale-events); NULL = zuletzt gelistet';
