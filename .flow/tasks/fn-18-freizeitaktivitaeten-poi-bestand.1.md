# fn-18-freizeitaktivitaeten-poi-bestand.1 Fundament: poi_activities-Migration + Activity-Lib (Mapping/Slug/Gemeinde/Preis)

## Description
Fundament fuer alle weiteren Slices: DB-Migrationen fuer `poi_activities` + `poi_activity_runs` plus pure Library-Module (testbar ohne Netz/DB).

**Size:** M
**Files:** supabase/migrations/<ts>_poi_activities.sql (inkl. poi_activity_runs), supabase/migrations/<ts>_poi_activities_indexes.sql (separat, erst nach Bulk-Load anwenden!), src/lib/activities/taxonomy.ts, src/lib/activities/slug.ts, src/lib/activities/gemeinde-match.ts, src/lib/activities/price-hint.ts, src/lib/activities/fingerprint.ts, src/__tests__/lib/activities/*

## Approach
- ACHTUNG: Tabellenname `poi_activities` — `activities` ist die Social-Feed-Tabelle (Namens-Kollision, Epic E1).
- Basis-Migration: `poi_activities` laut Epic-Schema + Prune-/Dedup-Felder (Epic E6/E11): `last_seen_run_id`, `seen_regions text[]`, `content_fingerprint text`, `duplicate_of uuid null`, `visible boolean`. Dazu `poi_activity_runs` (run_id, started_at, finished_at, regions_ok jsonb, regions_failed jsonb, is_complete boolean). UNIQUE(source, source_id), RLS public-read. KEINE GIN/trgm-Indizes in der Basis-Migration.
- Index-Migration (separat, nach Initial-Load; jeweils mit Task-Bezug im Kommentar): `create extension if not exists pg_trgm;` · UNIQUE(slug) [Task 3 Resolver] · btree(gemeinde_slug) WHERE visible [Task 3/4] · btree(bundesland) WHERE visible [Task 3] · GIN(tags) [Task 3/6] · GIN(name gin_trgm_ops) [Task 6] · btree(lat), btree(lng) [Task 4 bbox-Nearby, Muster Events] · btree(content_fingerprint) [Task 2 Dedup] · btree(last_seen_run_id) [Task 2 Prune].
- taxonomy.ts: kuratierte Deskline-Topic-Whitelist -> bestehende TAGS-Werte (read-only-Import der Typen aus enrichment-taxonomy.ts erlaubt, Datei selbst NICHT aendern — fn-14-Konflikt, Epic E3). Whitelist deckt Action/Freizeit/Familie/Baeder/Kultur ab (Kartsport/Kartbahn, Sommerrodelbahn, Hochseilgarten, Klettersteig, Freibad, Museum, ...); Gastro/Shops/Weingueter/E-Ladestationen -> nicht importieren. Unmapped Topics -> skip + Log-Liste.
- slug.ts: slugify(name) + shortid(source_id); Slug wird beim Insert fixiert, nie regeneriert (Epic E5).
- gemeinde-match.ts: nearest-Haversine gegen ALL_GEMEINDEN (src/lib/gemeinden/data.ts, haversineKm wiederverwenden) (Epic E4).
- price-hint.ts: deterministischer Euro-Regex mit Anti-Patterns (Jahreszahlen "ab 2018", Hausnummern, kW-Angaben) — kein KI-Enrichment.
- fingerprint.ts: content_fingerprint = Hash aus normalisiertem Namen (lowercase, Mojibake-bereinigt, whitespace-kollabiert) + auf ~50 m gerundeten Koordinaten (Epic E11) — Schema bleibt korrekt, egal ob Mirror-Regionen gleiche GUIDs liefern.
## Approach
- Migration analog supabase/migrations/20260424_activities_delete_policy.sql-Stil: Tabelle laut Epic-Spec-Schema (E1), UNIQUE(source, source_id), RLS public-read, KEINE GIN/trgm-Indizes in der Basis-Migration (Epic E-Praxis: Indizes erst nach Initial-Load, zweite Migration).
- ACHTUNG: Tabellenname `poi_activities` — `activities` ist die Social-Feed-Tabelle (Namens-Kollision, Epic E1).
- taxonomy.ts: kuratierte Deskline-Topic-Whitelist -> bestehende TAGS-Werte (read-only-Import der Typen aus enrichment-taxonomy.ts erlaubt, Datei selbst NICHT aendern — fn-14-Konflikt, Epic E3). Whitelist muss Action/Freizeit/Familie/Baeder/Kultur abdecken (Kartsport/Kartbahn, Sommerrodelbahn, Hochseilgarten, Klettersteig, Freibad, Museum, ...); Gastro/Shops/Weingueter/E-Ladestationen -> nicht importieren. Unmapped Topics -> skip + Log-Liste.
- slug.ts: slugify(name) + shortid(source_id); Slug wird beim Insert fixiert, nie regeneriert (Epic E5).
- gemeinde-match.ts: nearest-Haversine gegen ALL_GEMEINDEN (src/lib/gemeinden/data.ts, haversineKm wiederverwenden) (Epic E4).
- price-hint.ts: deterministischer Euro-Regex mit Anti-Patterns (Jahreszahlen "ab 2018", Hausnummern, kW-Angaben) — kein KI-Enrichment.
## Acceptance
- [ ] Basis-Migration (poi_activities + poi_activity_runs + Prune-/Dedup-Felder) + separate Index-Migration liegen in supabase/migrations/ (Anwendung via Dashboard im Migrations-Header dokumentiert)
- [ ] Index-Migration enthaelt pg_trgm-Extension + alle in Approach gelisteten Indizes, jeweils mit Kommentar welcher Task sie braucht
- [ ] enrichment-taxonomy.ts unveraendert (git diff leer fuer die Datei)
- [ ] Vitest: Topic-Mapping (inkl. unmapped->skip), Slug-Stabilitaet + Kollisionsfreiheit, Gemeinde-Match (echte Koordinaten, z.B. Mountaincart Fulseck -> Dorfgastein), Euro-Regex inkl. Anti-Patterns, Fingerprint-Stabilitaet (gleicher POI aus 2 Regionen -> gleicher Hash; 60 m Abstand -> anderer Hash)
- [ ] Whitelist-Review: mindestens 30 gemappte Topics, dokumentiert in taxonomy.ts-Kommentarkopf
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
