-- MASTERPLAN §10.1: DB-Notentlastung — nachweislich unbenutzte Indizes entfernen.
-- idx_scan-Werte am 2026-07-07: embedding_ivfflat 50, location_trgm 10, address_trgm 3,
-- created_by 3, category_version 18, detail_fetch_at 21, country 46, backfill_eligible 44,
-- enrichment_version 346 (nur vom stillgelegten Enrichment-Pfad benutzt).
DROP INDEX IF EXISTS idx_events_embedding_ivfflat_future;
DROP INDEX IF EXISTS idx_events_location_trgm;
DROP INDEX IF EXISTS idx_events_address_trgm;
DROP INDEX IF EXISTS idx_events_created_by;
DROP INDEX IF EXISTS idx_events_category_version;
DROP INDEX IF EXISTS idx_events_detail_fetch_at;
DROP INDEX IF EXISTS idx_events_country;
DROP INDEX IF EXISTS idx_events_backfill_eligible;
DROP INDEX IF EXISTS events_enrichment_version;
