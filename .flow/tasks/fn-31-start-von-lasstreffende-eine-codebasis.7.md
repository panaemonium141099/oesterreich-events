# fn-31-start-von-lasstreffende-eine-codebasis.7 Backfill der Regionsspalten und Indizes

## Description
Backfill der Regionsspalten für den Bestand und die Indizes dazu.

**Size:** M
**Files:** `src/scripts/region-backfill.ts` (neu), `package.json` (Script), `supabase/migrations/<ts>_events_region_indexes.sql` (neu), `src/__tests__/scripts/region-backfill.test.ts`

## Approach
- Muster `src/scripts/location-backfill.ts` (Kopf Zeilen 1 bis 42: `--dry-run`, `--limit`, überspringt Zeilen, deren `updated_at` sich seit dem Lesen geändert hat). Blättern nach id (`forEachPageById`), Schreib-Batches ≤ 500, `.in()` ≤ 200, wiederaufsetzbar, `--country DE|AT`.
- Ableitung nur über `regionKeys` aus Task 6, ohne Resolver-Lauf und ohne Netz.
- Bericht (JSON und Text): gefüllt, NULL je Ursache (keine Gemeinde, mehrdeutig, nicht in Stammdatei), Laufzeit.
- Zuerst DE, AT danach in einem eigenen Lauf.
- Index-Migration als eigene Datei, jede Anweisung `CREATE INDEX CONCURRENTLY IF NOT EXISTS`, außerhalb einer Transaktion, danach `ANALYZE events`. Partiell auf veröffentlichte Zeilen (nur unveränderliche Bedingungen, kein `now()`): `(country, region_id, start_date)`, `(gemeinde_key, start_date)`, `(kreis_key, start_date)`. Nach dem Lauf ungültige Indizes prüfen (`pg_index.indisvalid`).
- Vor dem Indexbau: freier Plattenplatz aus Task 1 gegen die geschätzte Größe.

## Key context
- Nie während Deploy oder Nachtlauf (AT 03:17, DE 22:17 Wien) starten.
- Jede aktualisierte Zeile hinterlässt eine tote Zeile: Platte ist knapp, nach dem Lauf `VACUUM (ANALYZE)` einplanen.
- Voraussetzung: Index `(country, start_date)` aus PR #467 ist in Prod.
## Acceptance
- [ ] Probelauf (`--dry-run`) gegen Prod mit Bericht im PR
- [ ] Backfill DE gelaufen, Bericht nennt gefüllte und NULL-Zeilen je Ursache
- [ ] Indizes in Prod angelegt und gültig, `ANALYZE` gelaufen
- [ ] `EXPLAIN` für Liste je Land, je Gemeinde und je Kreis nutzt die neuen Indizes (Ausgabe im PR)
- [ ] Skript ist wiederaufsetzbar (Test: zweiter Lauf schreibt nichts)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
